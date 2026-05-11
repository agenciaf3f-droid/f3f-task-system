import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPastDate, nowInBrazil } from "@/lib/meeting-recurrence";

const TOLERANCE_MINUTES = 10;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function generateSlots(startTime: string, endTime: string): string[] {
  const slots: string[] = [];
  let [h, m] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const endMinutes = endH * 60 + endM;
  while (h * 60 + m < endMinutes) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += 30;
    if (m >= 60) { h += 1; m -= 60; }
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
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Day of week for the requested date
  const [y, mo, d] = date.split("-").map(Number);
  const dayOfWeek = new Date(y, mo - 1, d).getDay();

  const availability = await prisma.calendarAvailability.findUnique({
    where: { userId_dayOfWeek: { userId: user.id, dayOfWeek } },
  });

  if (!availability) {
    return NextResponse.json({ slots: [] });
  }

  // All possible 30-min slots
  const allSlots = generateSlots(availability.startTime, availability.endTime);

  // Already booked slots
  const booked = await prisma.meeting.findMany({
    where: { userId: user.id, date, status: "confirmed" },
    select: { startTime: true },
  });
  const bookedSet = new Set(booked.map((b) => b.startTime));

  // Tolerância 10min: se for hoje, esconde slots cujo início + 10min já passou.
  const now = nowInBrazil();
  const isToday = date === now.date;
  const cutoffMinutes = isToday ? timeToMinutes(now.time) - TOLERANCE_MINUTES : -1;

  const slots = allSlots
    .filter((s) => !bookedSet.has(s))
    .filter((s) => !isToday || timeToMinutes(s) >= cutoffMinutes)
    .map((s) => ({ startTime: s, endTime: addMinutes(s, 30) }));

  return NextResponse.json({ slots });
}
