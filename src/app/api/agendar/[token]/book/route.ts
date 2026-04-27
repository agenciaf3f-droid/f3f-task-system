import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCalendarMeeting } from "@/lib/google-calendar";

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

  const user = await prisma.user.findFirst({
    where: { OR: [{ calendarSlug: token }, { calendarToken: token }] },
    select: { id: true, name: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  // Validate slot is within availability
  const [y, mo, d] = date.split("-").map(Number);
  const dayOfWeek = new Date(y, mo - 1, d).getDay();

  const availability = await prisma.calendarAvailability.findUnique({
    where: { userId_dayOfWeek: { userId: user.id, dayOfWeek } },
  });

  if (!availability) {
    return NextResponse.json({ ok: false, error: "Dia não disponível." }, { status: 400 });
  }

  // Check slot is within time range
  if (startTime < availability.startTime || startTime >= availability.endTime) {
    return NextResponse.json({ ok: false, error: "Horário fora da disponibilidade." }, { status: 400 });
  }

  const endTime = addMinutes(startTime, 30);

  try {
    // Create in Google Calendar (fire-and-forget style, won't block booking)
    const googleEventId = await createCalendarMeeting({
      date,
      startTime,
      endTime,
      ownerName: user.name,
    });

    await prisma.meeting.create({
      data: {
        userId: user.id,
        date,
        startTime,
        endTime,
        status: "confirmed",
        googleEventId,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Horário já reservado." }, { status: 409 });
  }
}
