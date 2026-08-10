import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientSession } from "@/lib/client-session";
import { createCalendarMeeting, deleteCalendarMeeting } from "@/lib/google-calendar";
import { getMeetingDurationMinutes, MIN_ADVANCE_MINUTES } from "@/lib/meeting-duration";
import { isPastDate, nowInBrazil } from "@/lib/meeting-recurrence";

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

// Reagenda uma reunião individual (não toca em outras da série).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;

  let body: { date?: string; startTime?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "body inválido" }, { status: 400 });
  }

  const { date, startTime } = body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "date inválida" }, { status: 400 });
  }
  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
    return NextResponse.json({ ok: false, error: "startTime inválido" }, { status: 400 });
  }
  if (isPastDate(date)) {
    return NextResponse.json({ ok: false, error: "Data no passado." }, { status: 400 });
  }

  const [session, user] = await Promise.all([
    getClientSession(),
    prisma.user.findFirst({
      where: { OR: [{ calendarSlug: token }, { calendarToken: token }] },
      select: { id: true, name: true },
    }),
  ]);
  if (!session.clientName || session.bookingToken !== token) {
    return NextResponse.json({ ok: false, error: "Sessão inválida" }, { status: 401 });
  }
  if (!user) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const meeting = await prisma.meeting.findFirst({
    where: {
      id,
      userId: user.id,
      status: "confirmed",
      ...(session.clientGroupId
        ? { clientGroupId: session.clientGroupId }
        : { clientName: session.clientName ?? "" }),
    },
    select: { id: true, googleEventId: true, clientGroupId: true, clientPlan: true },
  });
  if (!meeting) return NextResponse.json({ ok: false, error: "Reunião não encontrada" }, { status: 404 });

  const nowBR = nowInBrazil();
  if (date === nowBR.date && timeToMinutes(startTime) < timeToMinutes(nowBR.time) + MIN_ADVANCE_MINUTES) {
    return NextResponse.json(
      { ok: false, error: `Reuniões precisam ser marcadas com ${MIN_ADVANCE_MINUTES} min de antecedência.` },
      { status: 400 },
    );
  }

  const [y, mo, d] = date.split("-").map(Number);
  const dayOfWeek = new Date(y, mo - 1, d).getDay();
  const availability = await prisma.calendarAvailability.findUnique({
    where: { userId_dayOfWeek: { userId: user.id, dayOfWeek } },
  });
  if (!availability) {
    return NextResponse.json({ ok: false, error: "Dia não disponível." }, { status: 400 });
  }

  const durationMinutes = getMeetingDurationMinutes(session.clientPlan);
  const endTime = addMinutes(startTime, durationMinutes);
  if (startTime < availability.startTime || endTime > availability.endTime) {
    return NextResponse.json({ ok: false, error: "Horário fora da disponibilidade." }, { status: 400 });
  }

  try {
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { date, startTime, endTime },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Esse horário já está reservado." }, { status: 409 });
  }

  // Google Calendar: deletar antigo + criar novo (best-effort)
  if (meeting.googleEventId) {
    await deleteCalendarMeeting(meeting.googleEventId);
  }
  let calendarId: string | undefined;
  if (session.clientPlan) {
    calendarId = process.env[`GOOGLE_CALENDAR_ID_${session.clientPlan.toUpperCase()}`];
  }
  const newEventId = await createCalendarMeeting({
    date,
    startTime,
    endTime,
    ownerName: user.name,
    clientName: session.clientName,
    clientGroupId: session.clientGroupId,
    calendarId,
  });
  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { googleEventId: newEventId },
  });

  return NextResponse.json({ ok: true });
}

// Cancela uma reunião individual.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;

  const [session, user] = await Promise.all([
    getClientSession(),
    prisma.user.findFirst({
      where: { OR: [{ calendarSlug: token }, { calendarToken: token }] },
      select: { id: true },
    }),
  ]);
  if (!session.clientName || session.bookingToken !== token) {
    return NextResponse.json({ ok: false, error: "Sessão inválida" }, { status: 401 });
  }
  if (!user) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const meeting = await prisma.meeting.findFirst({
    where: {
      id,
      userId: user.id,
      status: "confirmed",
      ...(session.clientGroupId
        ? { clientGroupId: session.clientGroupId }
        : { clientName: session.clientName ?? "" }),
    },
    select: { id: true, googleEventId: true },
  });
  if (!meeting) return NextResponse.json({ ok: false, error: "Reunião não encontrada" }, { status: 404 });

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "cancelled" },
  });
  if (meeting.googleEventId) {
    await deleteCalendarMeeting(meeting.googleEventId);
  }

  return NextResponse.json({ ok: true });
}
