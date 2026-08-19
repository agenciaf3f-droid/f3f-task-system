import { NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createCalendarMeeting } from "@/lib/google-calendar";
import { scheduleMeetingReminders } from "@/lib/meeting-reminders";
import { getClientSession } from "@/lib/client-session";
import { resolvePlanCalendarId } from "@/lib/plan-calendar";
import {
  generateMonthlyOccurrences,
  generateWeeklyOccurrences,
  getWeekOfMonth,
  isBeforeEarliestBookable,
  nowInBrazil,
  type RecurrenceRule,
} from "@/lib/meeting-recurrence";
import {
  getMeetingDurationMinutes,
  getMeetingRecurrence,
  MIN_ADVANCE_MINUTES,
  RECURRING_INSTANCES_AHEAD,
} from "@/lib/meeting-duration";

function addMinutes(time: string, minutes: number): string {
  let [h, m] = time.split(":").map(Number);
  m += minutes;
  h += Math.floor(m / 60);
  m = m % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

type BlockingMeeting = {
  date: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
};

function blocksSlot(meeting: BlockingMeeting, date: string, startTime: string, endTime: string) {
  if (meeting.date > date || (meeting.endDate ?? meeting.date) < date) return false;
  if (meeting.isAllDay || date > meeting.date || date < (meeting.endDate ?? meeting.date)) return true;

  return timeToMinutes(startTime) < timeToMinutes(meeting.endTime)
    && timeToMinutes(endTime) > timeToMinutes(meeting.startTime);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body: { date?: string; startTime?: string; weekOfMonth?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "body inválido" }, { status: 400 });
  }

  const { date, startTime, weekOfMonth: clientWeekOfMonth } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "date inválida" }, { status: 400 });
  }
  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
    return NextResponse.json({ ok: false, error: "startTime inválido" }, { status: 400 });
  }
  if (isBeforeEarliestBookable(date)) {
    return NextResponse.json(
      { ok: false, error: "Reuniões só podem ser marcadas a partir do dia seguinte." },
      { status: 400 },
    );
  }

  const [user, session] = await Promise.all([
    prisma.user.findFirst({
      where: { OR: [{ calendarSlug: token }, { calendarToken: token }] },
      select: { id: true, name: true, isActive: true },
    }),
    getClientSession(),
  ]);

  if (!user || !user.isActive) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  // ─── Ler sessão do cliente ─────────────────────────────────────
  if (!session.clientName || session.bookingToken !== token) {
    return NextResponse.json({ ok: false, error: "Sessão inválida ou expirada" }, { status: 401 });
  }

  // Mapear plano → Google Calendar ID via tabela de alias + agendas live.
  // "Low-Ticket" → "Clientes - LT", "1/3 FASES" → "Clientes - F1", etc.
  // undefined = sem agenda específica → cai no calendar primary "Clientes".
  const calendarId = await resolvePlanCalendarId(session.clientPlan);
  if (session.clientPlan && !calendarId) {
    console.warn(`[book] sem agenda mapeada pro plano "${session.clientPlan}". Fallback p/ primary.`);
  }

  const [y, mo, d] = date.split("-").map(Number);
  const pickedDate = new Date(y, mo - 1, d);
  const dayOfWeek = pickedDate.getDay();

  const availability = await prisma.calendarAvailability.findUnique({
    where: { userId_dayOfWeek: { userId: user.id, dayOfWeek } },
  });
  if (!availability) {
    return NextResponse.json({ ok: false, error: "Dia não disponível." }, { status: 400 });
  }
  if (startTime < availability.startTime || startTime >= availability.endTime) {
    return NextResponse.json({ ok: false, error: "Horário fora da disponibilidade." }, { status: 400 });
  }

  // Antecedência mínima de 1h: se for hoje, slot precisa começar >= agora + 60min
  const nowBR = nowInBrazil();
  if (date === nowBR.date && timeToMinutes(startTime) < timeToMinutes(nowBR.time) + MIN_ADVANCE_MINUTES) {
    return NextResponse.json(
      { ok: false, error: `Reuniões precisam ser marcadas com ${MIN_ADVANCE_MINUTES} min de antecedência.` },
      { status: 400 },
    );
  }

  const durationMinutes = getMeetingDurationMinutes(session.clientPlan);
  const endTime = addMinutes(startTime, durationMinutes);
  if (endTime > availability.endTime) {
    return NextResponse.json({ ok: false, error: "Horário não cabe na disponibilidade." }, { status: 400 });
  }

  // A recorrência é obrigatória e depende exclusivamente do plano salvo na sessão.
  // O cliente não envia nem pode sobrescrever esta regra.
  const recurrenceType = getMeetingRecurrence(session.clientPlan);
  const rule: RecurrenceRule =
    recurrenceType === "weekly"
      ? { type: "weekly", dayOfWeek }
      : {
          type: "monthly_nth_weekday",
          weekOfMonth: clientWeekOfMonth || getWeekOfMonth(pickedDate),
          dayOfWeek,
        };

  const dates =
    rule.type === "weekly"
      ? generateWeeklyOccurrences(date, rule, RECURRING_INSTANCES_AHEAD)
      : generateMonthlyOccurrences(date, rule, RECURRING_INSTANCES_AHEAD);

  if (dates.length === 0) {
    return NextResponse.json({ ok: false, error: "Não foi possível gerar ocorrências." }, { status: 400 });
  }

  // Considera toda a duração de eventos com vários dias e também reuniões em que
  // o gestor participa como responsável adicional. A primeira ocorrência aborta
  // a série quando conflita; conflitos posteriores são ignorados individualmente.
  const existingMeetings = await prisma.meeting.findMany({
    where: {
      date: { lte: dates.at(-1) },
      status: "confirmed",
      AND: [
        { OR: [{ endDate: { gte: dates[0] } }, { endDate: null, date: { gte: dates[0] } }] },
        {
          OR: [
            { userId: user.id },
            { visibleTo: { some: { userId: user.id } } },
            { user: { calendarSlug: "admin" } },
          ],
        },
      ],
    },
    select: { date: true, endDate: true, startTime: true, endTime: true, isAllDay: true },
  });
  const conflictingDates = new Set(
    dates.filter((occurrenceDate) =>
      existingMeetings.some((meeting) => blocksSlot(meeting, occurrenceDate, startTime, endTime)),
    ),
  );
  if (conflictingDates.has(dates[0])) {
    return NextResponse.json({ ok: false, error: "Primeiro horário já reservado." }, { status: 409 });
  }
  let parent: { id: string };
  try {
    parent = await prisma.meeting.create({
      data: {
        userId: user.id,
        date: dates[0],
        startTime,
        endTime,
        status: "confirmed",
        recurrenceRule: rule as object,
        clientName: session.clientName,
        clientGroupId: session.clientGroupId,
        clientPlan: session.clientPlan,
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Horário já reservado." }, { status: 409 });
    }
    throw error;
  }
  const parentId = parent.id;

  const childDates = dates.slice(1);
  const survivorDates = childDates.filter((occurrenceDate) => !conflictingDates.has(occurrenceDate));
  const skippedCount = childDates.length - survivorDates.length;

  const createdChildren = survivorDates.length
      ? await prisma.meeting.createManyAndReturn({
        skipDuplicates: true,
        data: survivorDates.map((d) => ({
          userId: user.id,
          date: d,
          startTime,
          endTime,
          status: "confirmed",
          recurrenceRule: rule as object,
          recurrenceParentId: parentId,
          clientName: session.clientName,
          clientGroupId: session.clientGroupId,
          clientPlan: session.clientPlan,
        })),
        select: { id: true, date: true },
      })
    : [];

  const createdMeetings: { id: string; date: string }[] = [
    { id: parentId, date: dates[0] },
    ...createdChildren,
  ];

  // Google Calendar em paralelo, fora da transação.
  const results = await Promise.allSettled(
    createdMeetings.map((m) =>
      createCalendarMeeting({
        date: m.date,
        startTime,
        endTime,
        ownerName: user.name,
        clientName: session.clientName,
        clientGroupId: session.clientGroupId,
        calendarId,
      }).then((googleEventId) =>
        googleEventId ? { id: m.id, googleEventId } : null,
      ),
    ),
  );
  const successfulUpdates: { id: string; googleEventId: string }[] = [];
  let googleFailures = 0;
  for (const r of results) {
    if (r.status === "rejected") {
      googleFailures++;
    } else if (r.value) {
      successfulUpdates.push(r.value);
    }
  }
  if (successfulUpdates.length > 0) {
    await prisma.$transaction(
      successfulUpdates.map((u) =>
        prisma.meeting.update({ where: { id: u.id }, data: { googleEventId: u.googleEventId } }),
      ),
    );
  }
  if (googleFailures > 0) {
    console.error(`[Booking] ${googleFailures} Google Calendar syncs falharam (DB OK).`);
  }

  // Depois da resposta: o cliente não deve esperar as chamadas à UAZAPI. Se
  // alguma falhar, a linha fica como failed e o reconciliador diário refaz.
  after(async () => {
    for (const meeting of createdMeetings) {
      try {
        await scheduleMeetingReminders(meeting.id);
      } catch (error) {
        console.error("[Booking] falha ao agendar lembretes", { meetingId: meeting.id, error });
      }
    }
  });

  return NextResponse.json({
    ok: true,
    recurring: true,
    created: createdMeetings.length,
    skipped: skippedCount,
  });
}
