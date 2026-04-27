"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Link2, Check, Pencil, X } from "lucide-react";
import { useState, useTransition } from "react";
import { AvailabilityDialog } from "./availability-dialog";
import { cancelMeetingAction, updateCalendarSlugAction } from "./actions";

type Meeting = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  hostId: string;
  hostName: string;
};

type Availability = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

const HOST_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-teal-500",
];

function colorForHost(hostId: string) {
  let hash = 0;
  for (let i = 0; i < hostId.length; i++) hash = (hash * 31 + hostId.charCodeAt(i)) | 0;
  return HOST_COLORS[Math.abs(hash) % HOST_COLORS.length];
}

function firstName(name: string) {
  return name.trim().split(" ")[0];
}

const DAY_NAMES = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toMonthStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function WeekCalendar({
  gridStart: gridStartISO,
  monthRefIso,
  meetings,
  availability,
  bookingUrl,
  currentSlug,
  appUrl,
  userId,
}: {
  gridStart: string;
  monthRefIso: string;
  meetings: Meeting[];
  availability: Availability[];
  bookingUrl: string;
  currentSlug: string;
  appUrl: string;
  userId: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [cancelling, startCancel] = useTransition();
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState(currentSlug);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [savingSlug, startSaveSlug] = useTransition();

  function saveSlug() {
    setSlugError(null);
    startSaveSlug(async () => {
      const res = await updateCalendarSlugAction(slugDraft);
      if (res.error) setSlugError(res.error);
      else {
        setEditingSlug(false);
        router.refresh();
      }
    });
  }

  const gridStart = new Date(gridStartISO);
  const monthRef = new Date(monthRefIso);
  const monthName = MONTHS[monthRef.getUTCMonth()];
  const year = monthRef.getUTCFullYear();
  const todayStr = toDateStr(new Date());

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    return d;
  });

  function navigateMonth(delta: number) {
    const next = new Date(Date.UTC(monthRef.getUTCFullYear(), monthRef.getUTCMonth() + delta, 1));
    router.push(`/calendario?month=${toMonthStr(next)}`);
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
    <div className="py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-slate-900 capitalize">
            {monthName} <span className="font-normal text-slate-500">{year}</span>
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateMonth(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigateMonth(1)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push("/calendario")}
              className="ml-2 px-4 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
            >
              Hoje
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AvailabilityDialog availability={availability} />
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            {copied ? "Copiado" : "Copiar link"}
          </button>
        </div>
      </div>

      {/* Month grid */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="text-center py-2.5 text-[11px] font-semibold tracking-wider text-slate-500 border-r border-slate-200 last:border-r-0"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 grid-rows-6">
          {days.map((day, idx) => {
            const dateStr = toDateStr(day);
            const isToday = dateStr === todayStr;
            const isCurrentMonth = day.getUTCMonth() === monthRef.getUTCMonth();
            const dayMeetings = meetings.filter((m) => m.date === dateStr);
            const dayOfWeek = day.getUTCDay();
            const isAvailable = availableDays.has(dayOfWeek);
            const visible = dayMeetings.slice(0, 3);
            const overflow = dayMeetings.length - visible.length;
            const isLastRow = idx >= 35;
            const isLastCol = (idx % 7) === 6;

            return (
              <div
                key={dateStr}
                className={`
                  group relative min-h-[120px] p-1.5 flex flex-col gap-1
                  ${isLastRow ? "" : "border-b border-slate-200"}
                  ${isLastCol ? "" : "border-r border-slate-200"}
                  ${isCurrentMonth ? "bg-white" : "bg-slate-50/60"}
                `}
              >
                {/* Date number */}
                <div className="flex items-center justify-center pt-0.5">
                  {isToday ? (
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-semibold">
                      {day.getUTCDate()}
                    </span>
                  ) : (
                    <span className={`text-xs font-medium ${
                      isCurrentMonth ? "text-slate-700" : "text-slate-400"
                    }`}>
                      {day.getUTCDate()}
                    </span>
                  )}
                </div>

                {/* Availability indicator (subtle dot) */}
                {isCurrentMonth && isAvailable && dayMeetings.length === 0 && (
                  <span className="absolute top-2 right-2 w-1 h-1 rounded-full bg-emerald-400" title="Disponível" />
                )}

                {/* Meetings */}
                <div className="flex flex-col gap-0.5 flex-1">
                  {visible.map((m) => {
                    const color = colorForHost(m.hostId);
                    const isOwn = m.hostId === userId;
                    return (
                      <div
                        key={m.id}
                        className={`group/m relative flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-white ${color} truncate cursor-default`}
                        title={`${m.hostName} · ${m.startTime}–${m.endTime}`}
                      >
                        <span className="font-medium shrink-0">{m.startTime}</span>
                        <span className="truncate opacity-95">{firstName(m.hostName)}</span>
                        {isOwn && (
                          <button
                            onClick={() => handleCancel(m.id)}
                            disabled={cancelling}
                            className="ml-auto opacity-0 group-hover/m:opacity-100 transition-opacity hover:bg-white/20 rounded p-0.5"
                            aria-label="Cancelar"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <span className="text-[10px] text-slate-500 px-1.5">
                      +{overflow} {overflow === 1 ? "outra" : "outras"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking link */}
      <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3 flex-wrap">
        <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">Link de agendamento</p>
          {editingSlug ? (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs font-mono text-slate-500 shrink-0">{appUrl}/agendar/</span>
              <input
                type="text"
                value={slugDraft}
                onChange={(e) => setSlugDraft(e.target.value)}
                placeholder="seu-nome"
                autoFocus
                className="text-xs font-mono px-2 py-1 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"
                disabled={savingSlug}
              />
              <button
                onClick={saveSlug}
                disabled={savingSlug}
                className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded disabled:opacity-50"
              >
                Salvar
              </button>
              <button
                onClick={() => { setEditingSlug(false); setSlugDraft(currentSlug); setSlugError(null); }}
                disabled={savingSlug}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
              >
                Cancelar
              </button>
              {slugError && <span className="text-xs text-red-600 w-full">{slugError}</span>}
            </div>
          ) : (
            <p className="text-xs font-mono text-slate-700 truncate">{bookingUrl}</p>
          )}
        </div>
        {!editingSlug && (
          <>
            <button
              onClick={() => setEditingSlug(true)}
              className="shrink-0 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              Editar
            </button>
            <button
              onClick={copyLink}
              className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
