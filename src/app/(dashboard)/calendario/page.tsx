import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WeekCalendar } from "./week-calendar";
import { getOrCreateCalendarToken } from "./actions";
import { currentYearMonthInBrazil } from "@/lib/meeting-recurrence";

export const metadata = { title: "Calendário" };

function toDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonthGridRange(monthRef: Date): { gridStart: Date; gridEnd: Date; firstOfMonth: Date } {
  const firstOfMonth = new Date(Date.UTC(monthRef.getUTCFullYear(), monthRef.getUTCMonth(), 1));
  const startDow = firstOfMonth.getUTCDay(); // 0 = Sun
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(firstOfMonth.getUTCDate() - startDow);
  const gridEnd = new Date(gridStart);
  gridEnd.setUTCDate(gridStart.getUTCDate() + 41); // 6 weeks × 7 days - 1
  return { gridStart, gridEnd, firstOfMonth };
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const user = await requireAuth();
  const sp = await searchParams;

  let monthRef: Date;
  if (sp?.month) {
    monthRef = new Date(sp.month + "-01T00:00:00Z");
  } else {
    const { year, month } = currentYearMonthInBrazil();
    monthRef = new Date(Date.UTC(year, month, 1));
  }
  const { gridStart, gridEnd, firstOfMonth } = getMonthGridRange(monthRef);

  const [meetings, availability, calendarToken, currentUser] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        user: { companyId: user.companyId },
        date: { gte: toDateStr(gridStart), lte: toDateStr(gridEnd) },
        status: "confirmed",
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: { user: { select: { id: true, name: true, calendarSlug: true } } },
      // recurrenceRule + recurrenceParentId já vêm por padrão; explicito não precisa.
    }),
    prisma.calendarAvailability.findMany({
      where: { userId: user.userId },
      orderBy: { dayOfWeek: "asc" },
    }),
    getOrCreateCalendarToken(),
    prisma.user.findUnique({ where: { id: user.userId }, select: { calendarSlug: true } }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const slugOrToken = currentUser?.calendarSlug || calendarToken;

  return (
    <WeekCalendar
      gridStart={gridStart.toISOString()}
      monthRefIso={firstOfMonth.toISOString()}
      meetings={meetings.map((m) => ({
        id: m.id,
        date: m.date,
        startTime: m.startTime,
        endTime: m.endTime,
        status: m.status,
        hostId: m.user.id,
        hostName: m.user.name,
        isShared: m.user.calendarSlug === "admin",
        clientName: m.clientName,
        isRecurring: m.recurrenceRule != null || m.recurrenceParentId != null,
      }))}
      availability={availability.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
      }))}
      bookingUrl={`${appUrl}/agendar/${slugOrToken}`}
      currentSlug={currentUser?.calendarSlug ?? ""}
      appUrl={appUrl}
      userId={user.userId}
    />
  );
}
