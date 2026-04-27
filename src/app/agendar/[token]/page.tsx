import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingForm } from "./booking-form";
import { CalendarDays } from "lucide-react";

export default async function AgendarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const user = await prisma.user.findUnique({
    where: { calendarToken: token },
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

  const availableDays = user.calendarAvailability.map((a) => a.dayOfWeek);

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex items-start justify-center pt-12 px-4 pb-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-600/30">
            <CalendarDays className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Agendar reunião</h1>
          <p className="text-sm text-slate-500 mt-1">com <strong className="text-slate-700">{user.name}</strong></p>
        </div>

        {availableDays.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
            <p className="text-slate-500 text-sm">Nenhum horário disponível no momento.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs text-slate-400 text-center mb-4">Selecione um dia e horário disponível</p>
            <BookingForm
              userName={user.name}
              token={token}
              availableDays={availableDays}
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
