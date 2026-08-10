import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getClientSession } from "@/lib/client-session";
import { AgendarClient } from "./agendar-client";
import { getMeetingDurationMinutes, getMeetingRecurrence } from "@/lib/meeting-duration";
import { todayInBrazil } from "@/lib/meeting-recurrence";
import { CalendarDays } from "lucide-react";

export default async function AgendarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const user = await prisma.user.findFirst({
    where: { OR: [{ calendarSlug: token }, { calendarToken: token }] },
    select: {
      id: true,
      name: true,
      isActive: true,
      calendarAvailability: {
        select: { dayOfWeek: true },
      },
    },
  });

  if (!user || !user.isActive) notFound();

  const session = await getClientSession();
  if (!session.clientName || session.bookingToken !== token) {
    redirect(`/agendar/${token}/login`);
  }

  const availableDays = user.calendarAvailability.map((a) => a.dayOfWeek);
  const durationMinutes = getMeetingDurationMinutes(session.clientPlan);
  const recurrence = getMeetingRecurrence(session.clientPlan);

  // Reuniões futuras do cliente com este host (usa clientGroupId como id do cliente,
  // fallback pra clientName se groupId vazio)
  const today = todayInBrazil();
  const clientFilter = session.clientGroupId
    ? { clientGroupId: session.clientGroupId }
    : { clientName: session.clientName ?? "" };

  const rawMeetings = await prisma.meeting.findMany({
    where: {
      userId: user.id,
      status: "confirmed",
      date: { gte: today },
      ...clientFilter,
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 4,
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      recurrenceRule: true,
      recurrenceParentId: true,
    },
  });

  const upcomingMeetings = rawMeetings.map((m) => ({
    id: m.id,
    date: m.date,
    startTime: m.startTime,
    endTime: m.endTime,
    isRecurring: m.recurrenceRule != null || m.recurrenceParentId != null,
  }));

  return (
    <div className="min-h-screen bg-background flex items-start justify-center pt-12 px-4 pb-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-600/30">
            <CalendarDays className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {session.clientName ? `Olá, ${session.clientName.split(" ")[0]}` : "Agendar reunião"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {upcomingMeetings.length > 0 ? "Suas próximas reuniões" : "Agendar reunião"} com{" "}
            <strong className="text-slate-700">{user.name}</strong>
          </p>
        </div>

        {availableDays.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
            <p className="text-slate-500 text-sm">Nenhum horário disponível no momento.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <AgendarClient
              userName={user.name}
              token={token}
              availableDays={availableDays}
              durationMinutes={durationMinutes}
              recurrence={recurrence}
              upcomingMeetings={upcomingMeetings}
            />
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-4">
          Powered by <span className="font-semibold text-slate-500">F3F Tasks</span>
        </p>
      </div>
    </div>
  );
}
