import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCalendarMeeting } from "@/lib/google-calendar";
import { getClientSession } from "@/lib/client-session";
import {
  generateMonthlyOccurrences,
  getWeekOfMonth,
  isPastDate,
  type MonthlyNthWeekdayRule,
} from "@/lib/meeting-recurrence";

const RECURRING_INSTANCES_AHEAD = 12;

function addMinutes(time: string, minutes: number): string {
  let [h, m] = time.split(":").map(Number);
  m += minutes;
  h += Math.floor(m / 60);
  m = m % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body: { date?: string; startTime?: string; recurring?: boolean; weekOfMonth?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "body inválido" }, { status: 400 });
  }

  const { date, startTime, recurring, weekOfMonth: clientWeekOfMonth } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "date inválida" }, { status: 400 });
  }
  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
    return NextResponse.json({ ok: false, error: "startTime inválido" }, { status: 400 });
  }
  if (isPastDate(date)) {
    return NextResponse.json({ ok: false, error: "Data no passado." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ calendarSlug: token }, { calendarToken: token }] },
    select: { id: true, name: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  // ─── Ler sessão do cliente ─────────────────────────────────────
  const session = await getClientSession();
  if (!session.clientEmail || session.bookingToken !== token) {
    return NextResponse.json({ ok: false, error: "Sessão inválida ou expirada" }, { status: 401 });
  }

  // Mapear plano para Google Calendar ID
  let calendarId: string | undefined;
  if (session.clientPlan) {
    const envKey = `GOOGLE_CALENDAR_ID_${session.clientPlan.toUpperCase()}`;
    calendarId = process.env[envKey];
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

  const endTime = addMinutes(startTime, 30);

  // ─── Booking simples ───────────────────────────────────────────
  if (!recurring) {
    let createdMeetingId: string;
    try {
      const meeting = await prisma.meeting.create({
        data: {
          userId: user.id,
          date,
          startTime,
          endTime,
          status: "confirmed",
          clientName: session.clientName,
          clientGroupId: session.clientGroupId,
          clientPlan: session.clientPlan,
        },
        select: { id: true },
      });
      createdMeetingId = meeting.id;
    } catch {
      return NextResponse.json({ ok: false, error: "Horário já reservado." }, { status: 409 });
    }

    // Google Calendar fora da transação (best-effort)
    const googleEventId = await createCalendarMeeting({
      date,
      startTime,
      endTime,
      ownerName: user.name,
      clientName: session.clientName,
      clientGroupId: session.clientGroupId,
      calendarId,
    });
    if (googleEventId) {
      await prisma.meeting.update({
        where: { id: createdMeetingId },
        data: { googleEventId },
      });
    }
    return NextResponse.json({ ok: true });
  }

  // ─── Booking recorrente (mensal, Nª <weekday>) ─────────────────
  const rule: MonthlyNthWeekdayRule = {
    type: "monthly_nth_weekday",
    weekOfMonth: clientWeekOfMonth || getWeekOfMonth(pickedDate),
    dayOfWeek,
  };

  const dates = generateMonthlyOccurrences(date, rule, RECURRING_INSTANCES_AHEAD);
  if (dates.length === 0) {
    return NextResponse.json({ ok: false, error: "Não foi possível gerar ocorrências." }, { status: 400 });
  }

  // Parent precisa existir pra dar sentido à série; se a primeira data conflita,
  // aborta o booking todo (caller pode tentar outra data).
  // Filhos são criados independentes — conflitos individuais skipam silenciosamente.
  // (Transação no Postgres aborta ao primeiro erro, então não faz sentido aqui.)
  let parentId: string;
  try {
    const parent = await prisma.meeting.create({
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
    parentId = parent.id;
  } catch {
    return NextResponse.json({ ok: false, error: "Primeiro horário já reservado." }, { status: 409 });
  }

  const createdMeetings: { id: string; date: string }[] = [{ id: parentId, date: dates[0] }];
  let skippedCount = 0;

  for (let i = 1; i < dates.length; i++) {
    try {
      const child = await prisma.meeting.create({
        data: {
          userId: user.id,
          date: dates[i],
          startTime,
          endTime,
          status: "confirmed",
          recurrenceRule: rule as object,
          recurrenceParentId: parentId,
          clientName: session.clientName,
          clientGroupId: session.clientGroupId,
          clientPlan: session.clientPlan,
        },
        select: { id: true },
      });
      createdMeetings.push({ id: child.id, date: dates[i] });
    } catch {
      skippedCount++;
    }
  }

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
      })
        .then((googleEventId) =>
          googleEventId
            ? prisma.meeting.update({ where: { id: m.id }, data: { googleEventId } })
            : null,
        ),
    ),
  );
  const googleFailures = results.filter((r) => r.status === "rejected").length;
  if (googleFailures > 0) {
    console.error(`[Booking] ${googleFailures} Google Calendar syncs falharam (DB OK).`);
  }

  return NextResponse.json({
    ok: true,
    recurring: true,
    created: createdMeetings.length,
    skipped: skippedCount,
  });
}
