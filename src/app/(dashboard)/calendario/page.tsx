import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WeekCalendar } from "./week-calendar";
import { getOrCreateCalendarToken } from "./actions";

function getMondayFromString(dateStr?: string): Date {
  const base = dateStr ? new Date(dateStr + "T00:00:00Z") : new Date();
  const day = base.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function toDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams?: Promise<{ week?: string }>;
}) {
  const user = await requireAuth();
  const sp = await searchParams;

  const monday = getMondayFromString(sp?.week);
  const mondayStr = toDateStr(monday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const sundayStr = toDateStr(sunday);

  const [meetings, availability, calendarToken] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        userId: user.userId,
        date: { gte: mondayStr, lte: sundayStr },
        status: "confirmed",
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.calendarAvailability.findMany({
      where: { userId: user.userId },
      orderBy: { dayOfWeek: "asc" },
    }),
    getOrCreateCalendarToken(user.userId),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <WeekCalendar
      monday={monday.toISOString()}
      meetings={meetings.map((m) => ({
        id: m.id,
        date: m.date,
        startTime: m.startTime,
        endTime: m.endTime,
        status: m.status,
      }))}
      availability={availability.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
      }))}
      bookingUrl={`${appUrl}/agendar/${calendarToken}`}
      userId={user.userId}
    />
  );
}
