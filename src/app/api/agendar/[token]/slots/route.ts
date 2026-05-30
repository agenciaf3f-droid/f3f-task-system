import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPastDate, nowInBrazil } from "@/lib/meeting-recurrence";
import { getClientSession } from "@/lib/client-session";
import { getMeetingDurationMinutes, MIN_ADVANCE_MINUTES } from "@/lib/meeting-duration";
import { listAllCalendarIds, listCalendarEvents } from "@/lib/google-calendar";

const TOLERANCE_MINUTES = 10;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function generateSlots(startTime: string, endTime: string, stepMinutes: number): string[] {
  const slots: string[] = [];
  let [h, m] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const endMinutes = endH * 60 + endM;
  while (h * 60 + m + stepMinutes <= endMinutes) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += stepMinutes;
    while (m >= 60) { h += 1; m -= 60; }
  }
  return slots;
}

function addMinutes(time: string, minutes: number): string {
  let [h, m] = time.split(":").map(Number);
  m += minutes;
  h += Math.floor(m / 60);
  m = m % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date"); // "YYYY-MM-DD"

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date inválida" }, { status: 400 });
  }
  if (isPastDate(date)) {
    return NextResponse.json({ slots: [] });
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ calendarSlug: token }, { calendarToken: token }] },
    select: { id: true, isActive: true, googleCalendarId: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Plano vem da sessão do cliente; sem sessão, assume 60min.
  const session = await getClientSession();
  const durationMinutes = getMeetingDurationMinutes(session.clientPlan);

  const [y, mo, d] = date.split("-").map(Number);
  const dayOfWeek = new Date(y, mo - 1, d).getDay();

  const availability = await prisma.calendarAvailability.findUnique({
    where: { userId_dayOfWeek: { userId: user.id, dayOfWeek } },
  });

  if (!availability) {
    return NextResponse.json({ slots: [] });
  }

  // Slots na granularidade da duração do plano.
  const allSlots = generateSlots(availability.startTime, availability.endTime, durationMinutes);

  // Reuniões que bloqueiam slots desse gestor:
  // - Próprias (reuniões de cliente atribuídas via Client.managerId)
  // - Admin bucket (Daily Agência, Reunião de Gestores, etc — shared, bloqueia todos)
  const bookedFromDb = await prisma.meeting.findMany({
    where: {
      date,
      status: "confirmed",
      OR: [
        { userId: user.id },
        { user: { calendarSlug: "admin" } },
      ],
    },
    select: { startTime: true, endTime: true },
  });

  // Live check no Google Calendar pra capturar eventos criados manualmente
  // depois do último sync. Lê só agendas relevantes ao gestor (agenda própria
  // mapeada via User.googleCalendarId, se houver).
  const dayStart = new Date(`${date}T00:00:00-03:00`);
  const dayEnd = new Date(`${date}T23:59:59-03:00`);
  const gcalEvents = user.googleCalendarId
    ? await listCalendarEvents({
        timeMin: dayStart,
        timeMax: dayEnd,
        calendarIds: [user.googleCalendarId],
      })
    : null;

  const bookedFromGcal = (gcalEvents ?? [])
    .filter((ev) => ev.status === "confirmed" && !ev.isAllDay && ev.date === date)
    .map((ev) => ({ startTime: ev.startTime, endTime: ev.endTime }));

  // União de ambos — dedupe por (startTime, endTime). Eventos criados via /agendar
  // têm tanto Meeting quanto evento Google com o mesmo intervalo.
  const seen = new Set<string>();
  const booked: { startTime: string; endTime: string }[] = [];
  for (const b of [...bookedFromDb, ...bookedFromGcal]) {
    const key = `${b.startTime}-${b.endTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    booked.push(b);
  }

  function overlapsBooked(slotStart: string): boolean {
    const slotEnd = addMinutes(slotStart, durationMinutes);
    const a = timeToMinutes(slotStart);
    const b = timeToMinutes(slotEnd);
    return booked.some((m) => {
      const x = timeToMinutes(m.startTime);
      const y = timeToMinutes(m.endTime);
      return a < y && b > x;
    });
  }

  // Antecedência mínima: 1h. Pra hoje, slot precisa começar >= agora + 60min.
  // Tolerância 10min: se for hoje, esconde slots cujo início + 10min já passou.
  // (regra de antecedência sobrepõe tolerância pra hoje)
  const now = nowInBrazil();
  const isToday = date === now.date;
  const nowMin = timeToMinutes(now.time);
  const advanceCutoff = nowMin + MIN_ADVANCE_MINUTES;
  const toleranceCutoff = nowMin - TOLERANCE_MINUTES;

  const slots = allSlots
    .filter((s) => !overlapsBooked(s))
    .filter((s) => {
      if (!isToday) return true;
      const m = timeToMinutes(s);
      return m >= advanceCutoff && m >= toleranceCutoff;
    })
    .map((s) => ({ startTime: s, endTime: addMinutes(s, durationMinutes) }));

  return NextResponse.json({ slots, durationMinutes });
}
