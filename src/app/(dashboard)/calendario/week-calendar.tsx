"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Link2, Pencil, Repeat, X } from "lucide-react";
import { useState, useTransition, useMemo, useCallback, useEffect, memo } from "react";
import { AvailabilityDialog } from "./availability-dialog";
import { cancelMeetingAction, updateCalendarSlugAction, type CancelScope } from "./actions";
import { todayInBrazil } from "@/lib/meeting-recurrence";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

// Paleta por gestor: eventos compactos com superfície suave, no padrão de mês
// do Google Calendar, preservando as cores de identificação do Tasks.
const HOST_EVENT_STYLES = [
  "border-blue-500 bg-blue-50 text-blue-950 hover:bg-blue-100",
  "border-emerald-500 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
  "border-violet-500 bg-violet-50 text-violet-950 hover:bg-violet-100",
  "border-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100",
  "border-rose-500 bg-rose-50 text-rose-950 hover:bg-rose-100",
  "border-cyan-500 bg-cyan-50 text-cyan-950 hover:bg-cyan-100",
  "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-950 hover:bg-fuchsia-100",
  "border-teal-500 bg-teal-50 text-teal-950 hover:bg-teal-100",
];

function styleForHost(hostId: string) {
  let hash = 0;
  for (let i = 0; i < hostId.length; i++) hash = (hash * 31 + hostId.charCodeAt(i)) | 0;
  return HOST_EVENT_STYLES[Math.abs(hash) % HOST_EVENT_STYLES.length];
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

function formatDayTitle(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
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
  onOpenDay: (dateStr: string) => void;
  onHoverOverflow: (dateStr: string | null) => void;
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
  onOpenDay,
  onHoverOverflow,
}: DayCellProps) {
  const VISIBLE_CAP = 4;
  const visible = dayMeetings.slice(0, VISIBLE_CAP);
  const overflow = dayMeetings.length - visible.length;

  return (
    <div
      key={dateStr}
      className={`
        group relative px-1 py-1.5 flex flex-col gap-0.5 overflow-hidden min-h-0 transition-colors
        ${isLastRow ? "" : "border-b border-slate-200/80"}
        ${isLastCol ? "" : "border-r border-slate-200/80"}
        ${isCurrentMonth ? "bg-white hover:bg-slate-50/40" : "bg-slate-50/60"}
      `}
    >
      {/* Date number (top-left, estilo Google) */}
      <div className="flex h-7 shrink-0 items-center px-0.5">
        {isToday ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[12px] font-semibold text-white shadow-sm shadow-blue-200">
            {day.getUTCDate()}
          </span>
        ) : (
          <span className={`px-1.5 text-[12px] font-medium ${
            isCurrentMonth ? "text-slate-600" : "text-slate-300"
          }`}>
            {day.getUTCDate()}
          </span>
        )}
      </div>

      {/* Availability indicator (subtle dot) */}
      {isCurrentMonth && isAvailable && dayMeetings.length === 0 && (
        <span className="absolute top-2.5 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Disponível" />
      )}

      {/* Eventos compactos com overflow no padrão do Google Calendar. */}
      <div className="flex min-h-0 flex-col gap-0.5">
        {visible.map((m) => {
          const eventStyle = styleForHost(m.hostId);
          const isOwn = m.hostId === userId;
          const displayName = m.clientName || m.hostName;
          const tooltipPrefix = m.clientName
            ? `${m.clientName} com ${m.hostName}`
            : m.hostName;
          return (
            <div
              key={m.id}
              className={`group/m relative flex h-[22px] items-center gap-1 rounded-md border-l-[3px] px-1.5 text-[11px] leading-none transition-colors ${eventStyle}`}
              title={`${tooltipPrefix} · ${m.startTime}–${m.endTime}${m.isRecurring ? " (recorrente mensal)" : ""}`}
            >
              {m.isRecurring && <Repeat className="h-2.5 w-2.5 shrink-0 opacity-60" />}
              <span className="shrink-0 font-semibold tabular-nums">{m.startTime}</span>
              <span className="truncate font-medium">{firstName(displayName)}</span>
              {isOwn && (
                <button
                  onClick={() => onCancelClick(m)}
                  disabled={cancelling}
                  className="ml-auto rounded p-0.5 opacity-0 transition-opacity hover:bg-black/10 group-hover/m:opacity-100 focus-visible:opacity-100"
                  aria-label="Cancelar"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
        {overflow > 0 && (
          <button
            type="button"
            onClick={() => onOpenDay(dateStr)}
            onMouseEnter={() => onHoverOverflow(dateStr)}
            onMouseLeave={() => onHoverOverflow(null)}
            onFocus={() => onHoverOverflow(dateStr)}
            onBlur={() => onHoverOverflow(null)}
            aria-haspopup="dialog"
            aria-label={`Ver todas as ${dayMeetings.length} reuniões de ${formatDayTitle(dateStr)}`}
            title="Clique ou pressione Espaço para ver todas"
            className="w-fit rounded-md px-2 py-0.5 text-left text-[11px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            mais {overflow}
          </button>
        )}
      </div>
    </div>
  );
});

function DayMeetingsDialog({
  dateStr,
  meetings,
  open,
  onOpenChange,
}: {
  dateStr: string | null;
  meetings: Meeting[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-lg">
        <DialogHeader className="border-b border-slate-100 bg-white px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            {dateStr ? formatDayTitle(dateStr) : "Reuniões do dia"}
          </DialogTitle>
          <DialogDescription>
            {meetings.length} {meetings.length === 1 ? "reunião agendada" : "reuniões agendadas"} neste dia.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto bg-slate-50/50 p-3">
          <div className="flex flex-col gap-2">
            {meetings.map((meeting) => {
              const displayName = meeting.clientName || meeting.hostName;
              const eventStyle = styleForHost(meeting.hostId);
              return (
                <div
                  key={meeting.id}
                  className={`flex items-center gap-3 rounded-xl border border-l-4 px-3 py-3 shadow-sm ${eventStyle}`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="flex w-24 shrink-0 items-center gap-1 text-xs font-semibold tabular-nums">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {meeting.startTime}–{meeting.endTime}
                    </span>
                    <span className="truncate text-sm font-semibold">{displayName}</span>
                    {meeting.isRecurring ? <Repeat className="h-3.5 w-3.5 shrink-0 text-blue-500" /> : null}
                  </div>
                  <span className="shrink-0 text-xs opacity-65">{meeting.hostName}</span>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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
  const [cancelTarget, setCancelTarget] = useState<Meeting | null>(null);
  const [viewMode, setViewMode] = useState<"mine" | "all">("all");
  const [openDayDate, setOpenDayDate] = useState<string | null>(null);
  const [hoveredOverflowDate, setHoveredOverflowDate] = useState<string | null>(null);

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

  const openDayMeetings = openDayDate ? meetingsByDate.get(openDayDate) ?? [] : [];

  useEffect(() => {
    if (!hoveredOverflowDate) return;

    function openQuickLook(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat) return;
      event.preventDefault();
      setOpenDayDate(hoveredOverflowDate);
    }

    window.addEventListener("keydown", openQuickLook);
    return () => window.removeEventListener("keydown", openQuickLook);
  }, [hoveredOverflowDate]);

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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Weekday headers */}
        <div className="grid shrink-0 grid-cols-7 border-b border-slate-200 bg-slate-50/70">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="border-r border-slate-200/80 py-2.5 text-center text-[10px] font-semibold tracking-[0.12em] text-slate-500 last:border-r-0"
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
                onOpenDay={setOpenDayDate}
                onHoverOverflow={setHoveredOverflowDate}
              />
            );
          })}
        </div>
      </div>

      <DayMeetingsDialog
        dateStr={openDayDate}
        meetings={openDayMeetings}
        open={openDayDate !== null}
        onOpenChange={(open) => { if (!open) setOpenDayDate(null); }}
      />

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
