"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Link2, Check, Pencil, X, Repeat } from "lucide-react";
import { useState, useTransition, useMemo, useCallback, memo } from "react";
import { AvailabilityDialog } from "./availability-dialog";
import { cancelMeetingAction, updateCalendarSlugAction, type CancelScope } from "./actions";
import { todayInBrazil } from "@/lib/meeting-recurrence";

type Meeting = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  hostId: string;
  hostName: string;
  isShared: boolean;
  clientName: string | null;
  isRecurring: boolean;
};

type Availability = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

// Cor do bolinha por gestor — estilo Google Calendar
const HOST_DOT_COLORS = [
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
  return HOST_DOT_COLORS[Math.abs(hash) % HOST_DOT_COLORS.length];
}

function firstName(name: string) {
  return name.trim().split(" ")[0];
}

const DAY_NAMES = ["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."];
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

type DayCellProps = {
  day: Date;
  dateStr: string;
  isToday: boolean;
  isCurrentMonth: boolean;
  dayMeetings: Meeting[];
  isAvailable: boolean;
  isLastRow: boolean;
  isLastCol: boolean;
  userId: string;
  cancelling: boolean;
  onCancelClick: (m: Meeting) => void;
};

const DayCell = memo(function DayCell({
  day,
  dateStr,
  isToday,
  isCurrentMonth,
  dayMeetings,
  isAvailable,
  isLastRow,
  isLastCol,
  userId,
  cancelling,
  onCancelClick,
}: DayCellProps) {
  const VISIBLE_CAP = 3;
  const visible = dayMeetings.slice(0, VISIBLE_CAP);
  const overflow = dayMeetings.length - visible.length;

  return (
    <div
      key={dateStr}
      className={`
        group relative px-1.5 py-1 flex flex-col gap-0.5 overflow-hidden min-h-0
        ${isLastRow ? "" : "border-b border-slate-200"}
        ${isLastCol ? "" : "border-r border-slate-200"}
        ${isCurrentMonth ? "bg-white" : "bg-slate-50/50"}
      `}
    >
      {/* Date number (top-left, estilo Google) */}
      <div className="flex items-center h-6 shrink-0">
        {isToday ? (
          <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-600 text-white text-[12px] font-semibold">
            {day.getUTCDate()}
          </span>
        ) : (
          <span className={`px-1.5 text-[12px] font-medium ${
            isCurrentMonth ? "text-slate-700" : "text-slate-300"
          }`}>
            {day.getUTCDate()}
          </span>
        )}
      </div>

      {/* Availability indicator (subtle dot) */}
      {isCurrentMonth && isAvailable && dayMeetings.length === 0 && (
        <span className="absolute top-2.5 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Disponível" />
      )}

      {/* Meetings — cap em 3, "Mais N" no overflow (estilo Google) */}
      <div className="flex flex-col min-h-0">
        {visible.map((m) => {
          const dotColor = colorForHost(m.hostId);
          const isOwn = m.hostId === userId;
          const displayName = m.clientName || m.hostName;
          const tooltipPrefix = m.clientName
            ? `${m.clientName} com ${m.hostName}`
            : m.hostName;
          return (
            <div
              key={m.id}
              className="group/m relative flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-default text-[11px] leading-tight"
              title={`${tooltipPrefix} · ${m.startTime}–${m.endTime}${m.isRecurring ? " (recorrente mensal)" : ""}`}
            >
              <span className={`shrink-0 w-2 h-2 rounded-full ${dotColor}`} />
              {m.isRecurring && <Repeat className="w-2.5 h-2.5 shrink-0 text-slate-400" />}
              <span className="font-medium text-slate-600 tabular-nums shrink-0">{m.startTime}</span>
              <span className="truncate text-slate-700">{firstName(displayName)}</span>
              {isOwn && (
                <button
                  onClick={() => onCancelClick(m)}
                  disabled={cancelling}
                  className="ml-auto opacity-0 group-hover/m:opacity-100 transition-opacity hover:bg-slate-200 rounded p-0.5 text-slate-500"
                  aria-label="Cancelar"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
        {overflow > 0 && (
          <span className="px-1.5 text-[11px] text-slate-500 font-medium">
            Mais {overflow}
          </span>
        )}
      </div>
    </div>
  );
});

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
  const [cancelTarget, setCancelTarget] = useState<Meeting | null>(null);
  const [viewMode, setViewMode] = useState<"mine" | "all">("all");

  // "Minhas" mantém também reuniões shared (Daily 10h, Reunião de Gestores)
  // que valem pra todo mundo
  const visibleMeetings = useMemo(
    () =>
      viewMode === "mine"
        ? meetings.filter((m) => m.hostId === userId || m.isShared)
        : meetings,
    [meetings, viewMode, userId]
  );

  const saveSlug = useCallback(() => {
    setSlugError(null);
    startSaveSlug(async () => {
      const res = await updateCalendarSlugAction(slugDraft);
      if (res.error) setSlugError(res.error);
      else {
        setEditingSlug(false);
        router.refresh();
      }
    });
  }, [slugDraft, router]);

  const gridStart = new Date(gridStartISO);
  const monthRef = new Date(monthRefIso);
  const monthName = MONTHS[monthRef.getUTCMonth()];
  const year = monthRef.getUTCFullYear();
  const todayStr = todayInBrazil();

  const days = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setUTCDate(gridStart.getUTCDate() + i);
        return d;
      }),
    [gridStartISO]
  );

  const meetingsByDate = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of visibleMeetings) {
      const arr = map.get(m.date);
      if (arr) arr.push(m);
      else map.set(m.date, [m]);
    }
    return map;
  }, [visibleMeetings]);

  const availableDays = useMemo(
    () => new Set(availability.map((a) => a.dayOfWeek)),
    [availability]
  );

  const navigateMonth = useCallback(
    (delta: number) => {
      const next = new Date(Date.UTC(monthRef.getUTCFullYear(), monthRef.getUTCMonth() + delta, 1));
      router.push(`/calendario?month=${toMonthStr(next)}`);
    },
    [monthRefIso, router]
  );

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [bookingUrl]);

  const handleCancelClick = useCallback(
    (m: Meeting) => {
      if (m.isRecurring) {
        setCancelTarget(m);
      } else {
        if (!confirm("Cancelar esta reunião?")) return;
        startCancel(() => cancelMeetingAction(m.id, "single"));
      }
    },
    [startCancel]
  );

  const confirmCancel = useCallback(
    (scope: CancelScope) => {
      if (!cancelTarget) return;
      const id = cancelTarget.id;
      setCancelTarget(null);
      startCancel(() => cancelMeetingAction(id, scope));
    },
    [cancelTarget, startCancel]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-160px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
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
          {/* Toggle Minhas / Todas */}
          <div className="flex items-center bg-slate-100 rounded-full p-0.5">
            <button
              onClick={() => setViewMode("mine")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                viewMode === "mine" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Minhas
            </button>
            <button
              onClick={() => setViewMode("all")}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                viewMode === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Todas
            </button>
          </div>
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
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 shrink-0">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="text-center py-2 text-[11px] font-semibold tracking-wider text-slate-500 border-r border-slate-200 last:border-r-0"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
          {days.map((day, idx) => {
            const dateStr = toDateStr(day);
            const isToday = dateStr === todayStr;
            const isCurrentMonth = day.getUTCMonth() === monthRef.getUTCMonth();
            const dayMeetings = meetingsByDate.get(dateStr) ?? [];
            const dayOfWeek = day.getUTCDay();
            const isAvailable = availableDays.has(dayOfWeek);
            const isLastRow = idx >= 35;
            const isLastCol = (idx % 7) === 6;

            return (
              <DayCell
                key={dateStr}
                day={day}
                dateStr={dateStr}
                isToday={isToday}
                isCurrentMonth={isCurrentMonth}
                dayMeetings={dayMeetings}
                isAvailable={isAvailable}
                isLastRow={isLastRow}
                isLastCol={isLastCol}
                userId={userId}
                cancelling={cancelling}
                onCancelClick={handleCancelClick}
              />
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

      {/* Cancel recurring modal */}
      {cancelTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setCancelTarget(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <Repeat className="w-4 h-4 text-blue-600" />
              <h3 className="text-base font-semibold text-slate-900">Cancelar reunião recorrente</h3>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Esta reunião faz parte de uma série mensal. O que você quer cancelar?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => confirmCancel("single")}
                disabled={cancelling}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-sm font-medium text-slate-700 text-left disabled:opacity-50"
              >
                Apenas esta reunião
                <span className="block text-xs text-slate-400 mt-0.5">As próximas continuam agendadas.</span>
              </button>
              <button
                onClick={() => confirmCancel("series")}
                disabled={cancelling}
                className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-sm font-medium text-red-700 text-left disabled:opacity-50"
              >
                Toda a série mensal
                <span className="block text-xs text-red-500/80 mt-0.5">Cancela esta e todas as futuras.</span>
              </button>
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="mt-2 px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
