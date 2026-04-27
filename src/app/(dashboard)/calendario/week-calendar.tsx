"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Link2, Check, Clock, X } from "lucide-react";
import { useState, useTransition } from "react";
import { AvailabilityDialog } from "./availability-dialog";
import { cancelMeetingAction } from "./actions";

type Meeting = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
};

type Availability = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_FULL  = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS    = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const sm = MONTHS[monday.getUTCMonth()];
  const em = MONTHS[sunday.getUTCMonth()];
  if (sm === em) {
    return `${monday.getUTCDate()} – ${sunday.getUTCDate()} ${sm} ${monday.getUTCFullYear()}`;
  }
  return `${monday.getUTCDate()} ${sm} – ${sunday.getUTCDate()} ${em} ${monday.getUTCFullYear()}`;
}

function toDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WeekCalendar({
  monday: mondayISO,
  meetings,
  availability,
  bookingUrl,
  userId,
}: {
  monday: string;
  meetings: Meeting[];
  availability: Availability[];
  bookingUrl: string;
  userId: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [cancelling, startCancel] = useTransition();

  const monday = new Date(mondayISO);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d;
  });

  const todayStr = toDateStr(new Date());

  function navigate(delta: number) {
    const next = new Date(monday);
    next.setUTCDate(monday.getUTCDate() + delta * 7);
    router.push(`/calendario?week=${toDateStr(next)}`);
  }

  function copyLink() {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCancel(meetingId: string) {
    startCancel(() => cancelMeetingAction(meetingId));
  }

  const availableDays = new Set(availability.map((a) => a.dayOfWeek));

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Calendário</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie suas reuniões agendadas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <AvailabilityDialog availability={availability} />
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            {copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-700 min-w-52 text-center">
          {formatWeekRange(monday)}
        </span>
        <button
          onClick={() => navigate(1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => router.push("/calendario")}
          className="ml-1 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Hoje
        </button>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateStr = toDateStr(day);
          const dayOfWeek = day.getUTCDay();
          const isToday = dateStr === todayStr;
          const hasAvailability = availableDays.has(dayOfWeek);
          const dayMeetings = meetings.filter((m) => m.date === dateStr);

          return (
            <div
              key={dateStr}
              className={`rounded-xl border p-3 min-h-32 flex flex-col gap-2 transition-colors ${
                isToday ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-white"
              }`}
            >
              {/* Day header */}
              <div className="flex flex-col items-center pb-2 border-b border-slate-100">
                <span className={`text-xs font-semibold uppercase tracking-wide ${isToday ? "text-blue-600" : "text-slate-400"}`}>
                  {DAY_NAMES[dayOfWeek]}
                </span>
                <span className={`text-lg font-bold leading-none mt-0.5 ${isToday ? "text-blue-600" : "text-slate-800"}`}>
                  {day.getUTCDate()}
                </span>
                {hasAvailability && dayMeetings.length === 0 && (
                  <span className="mt-1 text-[10px] text-slate-400">disponível</span>
                )}
              </div>

              {/* Meetings */}
              <div className="flex flex-col gap-1.5 flex-1">
                {dayMeetings.length === 0 ? (
                  <div className="flex-1" />
                ) : (
                  dayMeetings.map((m) => (
                    <div
                      key={m.id}
                      className="relative group rounded-lg bg-blue-600 text-white px-2 py-1.5"
                    >
                      <div className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 shrink-0 opacity-80" />
                        <span className="text-[11px] font-semibold">{m.startTime}</span>
                      </div>
                      <span className="text-[10px] opacity-75">{m.startTime} – {m.endTime}</span>
                      <button
                        onClick={() => handleCancel(m.id)}
                        disabled={cancelling}
                        title="Cancelar reunião"
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-white/70 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Link info */}
      <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
        <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">Link de agendamento</p>
          <p className="text-xs font-mono text-slate-700 truncate">{bookingUrl}</p>
        </div>
        <button
          onClick={copyLink}
          className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
