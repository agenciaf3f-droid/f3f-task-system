import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientSession } from "@/lib/client-session";
import { deleteCalendarMeeting } from "@/lib/google-calendar";
import { todayInBrazil } from "@/lib/meeting-recurrence";

// Cancela TODAS as reuniões futuras do cliente com este host.
// Usado quando o cliente quer remarcar a série inteira.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const [session, user] = await Promise.all([
    getClientSession(),
    prisma.user.findFirst({
      where: { OR: [{ calendarSlug: token }, { calendarToken: token }] },
      select: { id: true },
    }),
  ]);
  if (!session.clientEmail || session.bookingToken !== token) {
    return NextResponse.json({ ok: false, error: "Sessão inválida" }, { status: 401 });
  }
  if (!user) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const today = todayInBrazil();
  const meetings = await prisma.meeting.findMany({
    where: {
      userId: user.id,
      status: "confirmed",
      date: { gte: today },
      ...(session.clientGroupId
        ? { clientGroupId: session.clientGroupId }
        : { clientName: session.clientName ?? "" }),
    },
    select: { id: true, googleEventId: true },
  });

  if (meetings.length === 0) {
    return NextResponse.json({ ok: true, cancelled: 0 });
  }

  await prisma.meeting.updateMany({
    where: { id: { in: meetings.map((m) => m.id) } },
    data: { status: "cancelled" },
  });

  await Promise.allSettled(
    meetings
      .filter((m) => m.googleEventId)
      .map((m) => deleteCalendarMeeting(m.googleEventId!)),
  );

  return NextResponse.json({ ok: true, cancelled: meetings.length });
}
