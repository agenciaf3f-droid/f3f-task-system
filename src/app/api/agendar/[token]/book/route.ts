import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCalendarMeeting } from "@/lib/google-calendar";
import { getClientSession } from "@/lib/client-session";
import {
  generateMonthlyOccurrences,
  generateWeeklyOccurrences,
  getWeekOfMonth,
  isPastDate,
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

  // Mapear plano para Google Calendar ID — normaliza pra suportar variantes
  // do banco externo: "Iniciante", "iniciante ", "INICIANTES", "low-ticket", etc.
  // Tenta forma normalizada (sem acento/espaço/dash) e fallback singular/plural.
  let calendarId: string | undefined;
  if (session.clientPlan) {
    const norm = session.clientPlan
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toUpperCase()
      .replace(/[\s\-]+/g, "_");
    const candidates = [
      `GOOGLE_CALENDAR_ID_${norm}`,
      norm.endsWith("S") ? `GOOGLE_CALENDAR_ID_${norm.slice(0, -1)}` : `GOOGLE_CALENDAR_ID_${norm}S`,
    ];
    for (const key of candidates) {
      if (process.env[key]) {
        calendarId = process.env[key];
        break;
      }
    }
    if (!calendarId) {
      console.warn(`[book] env GOOGLE_CALENDAR_ID_${norm} (e variantes) não encontrada. clientPlan="${session.clientPlan}". Fallback p/ primary.`);
    }
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

  // ─── Booking simples ───────────────────────────────────────────
  if (!recurring) {
    // Sem unique constraint no DB (precisa permitir multi-gestor no mesmo slot via sync),
    // checagem manual de duplicata pra esse user no mesmo slot exato.
    const existing = await prisma.meeting.findFirst({
      where: { userId: user.id, date, startTime, status: "confirmed" },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: false, error: "Horário já reservado." }, { status: 409 });
    }
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
    const createdMeetingId = meeting.id;

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

  // ─── Booking recorrente: regra depende do plano (semanal vs mensal) ──
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

  // Parent precisa existir pra dar sentido à série; se a primeira data conflita,
  // aborta o booking todo (caller pode tentar outra data).
  // Filhos são criados independentes — conflitos individuais skipam silenciosamente.
  const parentConflict = await prisma.meeting.findFirst({
    where: { userId: user.id, date: dates[0], startTime, status: "confirmed" },
    select: { id: true },
  });
  if (parentConflict) {
    return NextResponse.json({ ok: false, error: "Primeiro horário já reservado." }, { status: 409 });
  }
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
  const parentId = parent.id;

  const createdMeetings: { id: string; date: string }[] = [{ id: parentId, date: dates[0] }];
  let skippedCount = 0;

  for (let i = 1; i < dates.length; i++) {
    const childConflict = await prisma.meeting.findFirst({
      where: { userId: user.id, date: dates[i], startTime, status: "confirmed" },
      select: { id: true },
    });
    if (childConflict) {
      skippedCount++;
      continue;
    }
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
