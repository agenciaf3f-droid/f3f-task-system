"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, CalendarX, Check, ChevronLeft, ChevronRight, Clock, Link2, Repeat, Trash2 } from "lucide-react";
import { useState, useTransition, useMemo, useCallback, useEffect, memo } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AvailabilityDialog } from "./availability-dialog";
import { NewMeetingDialog } from "./new-meeting-dialog";
import { cancelMeetingAction, deleteMeetingForeverAction, type CancelScope } from "./actions";
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
  /** Foto do gestor responsável — é quem identifica a agenda. */
  hostAvatarUrl: string | null;
  /** Plano do cliente — define a cor do evento. */
  clientPlan: string | null;
  /** Resposta do cliente ao lembrete de véspera. "declined" cancela a reunião,
   *  então na prática só "confirmed" e null chegam ao calendário. */
  clientResponse: string | null;
  isRecurring: boolean;
};

type Availability = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type Option = { id: string; name: string };

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

/**
 * Cor por plano do cliente.
 *
 * O plano é o que define a natureza do atendimento, então é ele que orienta a
 * leitura da agenda — mais útil que colorir por gestor, que já aparece no
 * avatar e no nome. As chaves vêm normalizadas porque a planilha mistura caixa
 * ("Premium"/"PREMIUM", "Low-Ticket"/"Low-ticket").
 */
const PLAN_EVENT_STYLES: Record<string, string> = {
  "1 fase": "border-emerald-500 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
  "fase 1": "border-emerald-500 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
  "2 fases": "border-teal-500 bg-teal-50 text-teal-950 hover:bg-teal-100",
  "3 fases": "border-cyan-500 bg-cyan-50 text-cyan-950 hover:bg-cyan-100",
  "16 fases": "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-950 hover:bg-fuchsia-100",
  funil: "border-blue-500 bg-blue-50 text-blue-950 hover:bg-blue-100",
  "low-ticket": "border-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100",
  premium: "border-violet-500 bg-violet-50 text-violet-950 hover:bg-violet-100",
};

/** Reunião interna (sem cliente) fica neutra e não disputa atenção. */
const INTERNAL_EVENT_STYLE = "border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200";

function normalizePlan(plan: string | null): string {
  return (plan ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function styleForPlan(plan: string | null): string {
  const chave = normalizePlan(plan);
  if (!chave) return INTERNAL_EVENT_STYLE;
  const conhecido = PLAN_EVENT_STYLES[chave];
  if (conhecido) return conhecido;

  // Plano novo que ainda não está no mapa: cor estável em vez de tudo cinza.
  let hash = 0;
  for (let i = 0; i < chave.length; i++) hash = (hash * 31 + chave.charCodeAt(i)) | 0;
  return HOST_EVENT_STYLES[Math.abs(hash) % HOST_EVENT_STYLES.length];
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

// ─────────────────── visão de semana em grade de horários ───────────────────

const HOUR_HEIGHT = 60;
const GRID_MIN_HOUR = 6;
const GRID_MAX_HOUR = 22;

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

type PositionedMeeting = { meeting: Meeting; column: number; columns: number };

/**
 * Distribui reuniões sobrepostas em colunas lado a lado, no comportamento do
 * Google Agenda: quem acontece ao mesmo tempo divide a largura do dia em vez de
 * uma esconder a outra.
 *
 * Agrupa por sobreposição transitiva (A cobre B, B cobre C → os três dividem a
 * mesma faixa) e, dentro do grupo, encaixa cada reunião na primeira coluna
 * livre.
 */
function layoutDayMeetings(meetings: Meeting[]): PositionedMeeting[] {
  const ordenadas = [...meetings].sort(
    (a, b) =>
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
      timeToMinutes(b.endTime) - timeToMinutes(a.endTime),
  );

  const posicionadas: PositionedMeeting[] = [];
  let grupo: Meeting[] = [];
  let fimDoGrupo = -1;

  const fecharGrupo = () => {
    if (grupo.length === 0) return;
    const colunas: Meeting[][] = [];
    const atribuicao = new Map<string, number>();

    for (const reuniao of grupo) {
      const inicio = timeToMinutes(reuniao.startTime);
      let indice = colunas.findIndex((coluna) => {
        const ultima = coluna[coluna.length - 1];
        return timeToMinutes(ultima.endTime) <= inicio;
      });
      if (indice === -1) {
        colunas.push([reuniao]);
        indice = colunas.length - 1;
      } else {
        colunas[indice].push(reuniao);
      }
      atribuicao.set(reuniao.id, indice);
    }

    for (const reuniao of grupo) {
      posicionadas.push({
        meeting: reuniao,
        column: atribuicao.get(reuniao.id) ?? 0,
        columns: colunas.length,
      });
    }
    grupo = [];
    fimDoGrupo = -1;
  };

  for (const reuniao of ordenadas) {
    const inicio = timeToMinutes(reuniao.startTime);
    if (grupo.length > 0 && inicio >= fimDoGrupo) fecharGrupo();
    grupo.push(reuniao);
    fimDoGrupo = Math.max(fimDoGrupo, timeToMinutes(reuniao.endTime));
  }
  fecharGrupo();

  return posicionadas;
}


type HoverInfo = { meeting: Meeting; dateStr: string; x: number; y: number };

/**
 * Detalhes da reunião ao passar o mouse.
 *
 * Renderizado fora da grade, em posição fixa: dentro do card o
 * `overflow-hidden` e a rolagem vertical cortariam o painel. Não captura mouse
 * para não piscar quando o cursor passa por cima dele.
 */
function MeetingHoverCard({ info }: { info: HoverInfo }) {
  const { meeting } = info;
  const LARGURA = 260;
  // Vira para a esquerda quando não cabe à direita da tela.
  const x = typeof window !== "undefined" && info.x + LARGURA + 24 > window.innerWidth
    ? info.x - LARGURA - 12
    : info.x + 12;
  const y = typeof window !== "undefined"
    ? Math.min(info.y, window.innerHeight - 200)
    : info.y;

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
      style={{ left: x, top: y, width: LARGURA }}
      role="tooltip"
    >
      <div className="flex items-start gap-2">
        <UserAvatar name={meeting.hostName} src={meeting.hostAvatarUrl} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-slate-900">
            {meeting.clientName || meeting.hostName}
          </p>
          <p className="text-xs text-slate-500">com {meeting.hostName}</p>
        </div>
      </div>

      <dl className="mt-2.5 space-y-1 text-xs">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-slate-400">Data</dt>
          <dd className="font-medium text-slate-700">{formatDayTitle(info.dateStr)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-slate-400">Horário</dt>
          <dd className="font-medium tabular-nums text-slate-700">
            {meeting.startTime} – {meeting.endTime}
          </dd>
        </div>
      </dl>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {meeting.clientResponse === "confirmed" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <Check className="h-3 w-3" strokeWidth={3} /> Cliente confirmou
          </span>
        ) : meeting.clientName ? (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            Aguardando confirmação
          </span>
        ) : null}
        {meeting.isRecurring && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <Repeat className="h-3 w-3" /> Recorrente
          </span>
        )}
      </div>
    </div>
  );
}

type WeekTimeGridProps = {
  days: Date[];
  todayStr: string;
  meetingsByDate: Map<string, Meeting[]>;
  availableDays: Set<number>;
  userId: string;
  canManageAll: boolean;
  cancelling: boolean;
  deleting: boolean;
  onCancelClick: (m: Meeting) => void;
  onDeleteClick: (m: Meeting) => void;
};

function WeekTimeGrid({
  days,
  todayStr,
  meetingsByDate,
  availableDays,
  userId,
  canManageAll,
  cancelling,
  deleting,
  onCancelClick,
  onDeleteClick,
}: WeekTimeGridProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  // A faixa acompanha o que existe na semana: dia cheio mostra mais horas, dia
  // vazio não vira um paredão de linhas em branco.
  const { primeiraHora, ultimaHora } = useMemo(() => {
    let min = 9 * 60;
    let max = 18 * 60;
    for (const day of days) {
      for (const m of meetingsByDate.get(toDateStr(day)) ?? []) {
        min = Math.min(min, timeToMinutes(m.startTime));
        max = Math.max(max, timeToMinutes(m.endTime));
      }
    }
    return {
      primeiraHora: Math.max(GRID_MIN_HOUR, Math.floor(min / 60) - 1),
      ultimaHora: Math.min(GRID_MAX_HOUR, Math.ceil(max / 60) + 1),
    };
  }, [days, meetingsByDate]);

  const horas = useMemo(
    () => Array.from({ length: ultimaHora - primeiraHora }, (_, i) => primeiraHora + i),
    [primeiraHora, ultimaHora],
  );
  const alturaTotal = horas.length * HOUR_HEIGHT;
  const topoDe = (minutos: number) => ((minutos - primeiraHora * 60) / 60) * HOUR_HEIGHT;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={days.length > 1 ? "min-w-[1100px]" : ""}>
        {/* Cabeçalho fixo com os dias */}
        <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-slate-50/95 backdrop-blur">
          <div className="w-14 shrink-0 border-r border-slate-200/80" />
          {days.map((day) => {
            const dateStr = toDateStr(day);
            const isToday = dateStr === todayStr;
            return (
              <div key={dateStr} className="flex-1 border-r border-slate-200/80 py-2 text-center last:border-r-0">
                <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-500">
                  {DAY_NAMES[day.getUTCDay()]}
                </div>
                <div className="mt-0.5 flex justify-center">
                  <span
                    className={
                      isToday
                        ? "flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white"
                        : "flex h-7 w-7 items-center justify-center text-sm font-medium text-slate-600"
                    }
                  >
                    {day.getUTCDate()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Corpo rolável: sem corte de eventos, o usuário rola para ver o resto */}
        <div className="max-h-[calc(100vh-19rem)] min-h-[24rem] overflow-y-auto">
          <div className="flex" style={{ height: alturaTotal }}>
            {/* Régua de horas */}
            <div className="relative w-14 shrink-0 border-r border-slate-200/80">
              {horas.map((h, i) => (
                <div
                  key={h}
                  className="absolute right-1.5 -translate-y-1/2 text-[11px] tabular-nums text-slate-400"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dateStr = toDateStr(day);
              const posicionadas = layoutDayMeetings(meetingsByDate.get(dateStr) ?? []);
              const disponivel = availableDays.has(day.getUTCDay());

              return (
                <div
                  key={dateStr}
                  className={`relative flex-1 border-r border-slate-200/80 last:border-r-0 ${
                    disponivel ? "bg-white" : "bg-slate-50/40"
                  }`}
                >
                  {horas.map((h, i) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-slate-200/70"
                      style={{ top: i * HOUR_HEIGHT }}
                    />
                  ))}

                  {posicionadas.map(({ meeting, column, columns }) => {
                    const inicio = timeToMinutes(meeting.startTime);
                    const fim = timeToMinutes(meeting.endTime);
                    // Mínimo de 30 min de altura: reunião curta ainda precisa
                    // caber o nome e o avatar.
                    const altura = Math.max(28, ((fim - inicio) / 60) * HOUR_HEIGHT - 2);
                    const displayName = meeting.clientName || meeting.hostName;
                    const canManage = canManageAll || meeting.hostId === userId;

                    return (
                      <div
                        key={meeting.id}
                        className={`group/m absolute overflow-hidden rounded-md border-l-[3px] py-1 text-xs shadow-sm transition-colors ${columns >= 3 ? "px-1" : "px-1.5"} ${styleForPlan(meeting.clientPlan)}`}
                        style={{
                          top: topoDe(inicio),
                          height: altura,
                          left: `calc(${(column / columns) * 100}% + 2px)`,
                          width: `calc(${(1 / columns) * 100}% - 4px)`,
                        }}
                        onMouseEnter={(event) => {
                          const r = event.currentTarget.getBoundingClientRect();
                          setHover({ meeting, dateStr, x: r.right, y: r.top });
                        }}
                        onMouseLeave={() => setHover(null)}
                      >
                        {/* Quanto mais reuniões dividem o horário, menos largura
                            sobra. Avatar, horário e ícone saem antes do nome —
                            card ilegível não serve para nada. */}
                        <div className="flex items-start gap-1">
                          {columns <= 2 && (
                            <span className="relative shrink-0">
                              <UserAvatar
                                name={meeting.hostName}
                                src={meeting.hostAvatarUrl}
                                size={18}
                              />
                              {meeting.clientResponse === "confirmed" && (
                                <span
                                  className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white"
                                  aria-label="Cliente confirmou presença"
                                >
                                  <Check className="h-1.5 w-1.5 text-white" strokeWidth={5} />
                                </span>
                              )}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 leading-tight">
                            <span className={`block truncate font-semibold ${columns >= 3 ? "text-[11px]" : ""}`}>
                              {columns >= 3 && meeting.clientResponse === "confirmed" ? "✓ " : ""}
                              {displayName}
                            </span>
                            {columns === 1 && altura >= 40 && (
                              <span className="block truncate text-[10px] tabular-nums opacity-70">
                                {meeting.startTime}–{meeting.endTime}
                              </span>
                            )}
                          </span>
                          {meeting.isRecurring && columns <= 2 && (
                            <Repeat className="h-3 w-3 shrink-0 opacity-50" />
                          )}
                        </div>

                        {canManage && (
                          <span className="absolute right-1 top-1 flex items-center opacity-0 transition-opacity group-hover/m:opacity-100">
                            <button
                              type="button"
                              onClick={() => onCancelClick(meeting)}
                              disabled={cancelling || deleting}
                              className="rounded bg-white/70 p-0.5 hover:bg-white"
                              aria-label="Cancelar reunião"
                              title="Cancelar reunião"
                            >
                              <CalendarX className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteClick(meeting)}
                              disabled={cancelling || deleting}
                              className="rounded bg-white/70 p-0.5 text-red-600 hover:bg-white"
                              aria-label="Excluir reunião"
                              title="Excluir definitivamente"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {hover && <MeetingHoverCard info={hover} />}
    </div>
  );
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
  canManageAll: boolean;
  cancelling: boolean;
  deleting: boolean;
  onCancelClick: (m: Meeting) => void;
  onDeleteClick: (m: Meeting) => void;
  onOpenDay: (dateStr: string) => void;
  onHoverOverflow: (dateStr: string | null) => void;
  calendarView: "day" | "week" | "month";
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
  canManageAll,
  cancelling,
  deleting,
  onCancelClick,
  onDeleteClick,
  onOpenDay,
  onHoverOverflow,
  calendarView,
}: DayCellProps) {
  const VISIBLE_CAP = calendarView === "week" ? 10 : 5;
  const visible = dayMeetings.slice(0, VISIBLE_CAP);
  const overflow = dayMeetings.length - visible.length;

  return (
    <div
      key={dateStr}
      className={`
        group relative px-1.5 py-2 flex flex-col gap-1 overflow-hidden min-h-0 transition-colors
        ${isLastRow ? "" : "border-b border-slate-200/80"}
        ${isLastCol ? "" : "border-r border-slate-200/80"}
        ${isCurrentMonth ? "bg-white hover:bg-slate-50/40" : "bg-slate-50/60"}
      `}
    >
      {/* Date number (top-left, estilo Google) */}
      <div className="flex h-8 shrink-0 items-center px-0.5">
        {isToday ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-sm shadow-blue-200">
            {day.getUTCDate()}
          </span>
        ) : (
          <span className={`px-1.5 text-sm font-medium ${
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
      <div className="flex min-h-0 flex-col gap-1">
        {visible.map((m) => {
          const eventStyle = styleForPlan(m.clientPlan);
          const canManage = canManageAll || m.hostId === userId;
          const displayName = m.clientName || m.hostName;
          const tooltipPrefix = m.clientName
            ? `${m.clientName} com ${m.hostName}`
            : m.hostName;
          return (
            <div
              key={m.id}
              className={`group/m relative flex min-h-[42px] items-center gap-1.5 rounded-md border-l-[3px] px-2 py-1 text-xs transition-colors ${eventStyle}`}
              title={`${tooltipPrefix} · ${m.startTime}–${m.endTime}${m.isRecurring ? " (recorrente mensal)" : ""}${m.clientResponse === "confirmed" ? " · cliente confirmou" : ""}`}
            >
              {/* Avatar identifica o cliente de relance — antes o evento era só texto. */}
              <span className="relative shrink-0 self-start">
                <UserAvatar name={m.hostName} src={m.hostAvatarUrl} size={20} />
                {m.clientResponse === "confirmed" && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white"
                    aria-label="Cliente confirmou presença"
                  >
                    <Check className="h-2 w-2 text-white" strokeWidth={4} />
                  </span>
                )}
              </span>
              <span className="shrink-0 self-start pt-0.5 font-semibold tabular-nums">{m.startTime}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className="truncate font-semibold leading-4">{displayName}</span>
                  {m.isRecurring && <Repeat className="h-3 w-3 shrink-0 opacity-50" />}
                </span>
                {m.clientName ? (
                  <span className="block truncate text-[11px] leading-4 opacity-65">{m.hostName}</span>
                ) : null}
              </span>
              {canManage ? (
                <span className="ml-auto flex items-center opacity-0 transition-opacity group-hover/m:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => onCancelClick(m)}
                    disabled={cancelling || deleting}
                    className="rounded p-0.5 hover:bg-black/10"
                    aria-label="Cancelar reunião"
                    title="Cancelar reunião"
                  >
                    <CalendarX className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteClick(m)}
                    disabled={cancelling || deleting}
                    className="rounded p-0.5 text-red-600 hover:bg-red-100"
                    aria-label="Excluir reunião permanentemente"
                    title="Excluir permanentemente"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : null}
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
            className="w-fit rounded-md px-2 py-1 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
  userId,
  canManageAll,
  cancelling,
  deleting,
  onCancelClick,
  onDeleteClick,
}: {
  dateStr: string | null;
  meetings: Meeting[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  canManageAll: boolean;
  cancelling: boolean;
  deleting: boolean;
  onCancelClick: (meeting: Meeting) => void;
  onDeleteClick: (meeting: Meeting) => void;
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
              const eventStyle = styleForPlan(meeting.clientPlan);
              const canManage = canManageAll || meeting.hostId === userId;
              return (
                <div
                  key={meeting.id}
                  className={`flex items-center gap-3 rounded-xl border border-l-4 px-3 py-3 shadow-sm ${eventStyle}`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="relative shrink-0">
                      <UserAvatar
                        name={meeting.hostName}
                        src={meeting.hostAvatarUrl}
                        size={36}
                        ring
                      />
                      {meeting.clientResponse === "confirmed" && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white"
                          aria-label="Cliente confirmou presença"
                        >
                          <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
                        </span>
                      )}
                    </span>
                    <span className="flex w-24 shrink-0 items-center gap-1 text-xs font-semibold tabular-nums">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {meeting.startTime}–{meeting.endTime}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{displayName}</span>
                      {meeting.clientName ? (
                        <span className="block truncate text-xs opacity-65">{meeting.hostName}</span>
                      ) : null}
                    </span>
                    {meeting.isRecurring ? <Repeat className="h-3.5 w-3.5 shrink-0 text-blue-500" /> : null}
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onCancelClick(meeting)}
                        disabled={cancelling || deleting}
                        className="rounded-lg p-1.5 hover:bg-white/70 disabled:opacity-50"
                        aria-label={`Cancelar reunião ${displayName}`}
                        title="Cancelar reunião"
                      >
                        <CalendarX className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteClick(meeting)}
                        disabled={cancelling || deleting}
                        className="rounded-lg p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-50"
                        aria-label={`Excluir permanentemente reunião ${displayName}`}
                        title="Excluir permanentemente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
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
  userId,
  users,
  clients,
  canManageAll,
  canFilterByUser,
  defaultDate,
  focusDate,
  initialCalendarView,
  internalHostId,
}: {
  gridStart: string;
  monthRefIso: string;
  meetings: Meeting[];
  availability: Availability[];
  bookingUrl: string;
  userId: string;
  users: Option[];
  clients: Option[];
  canManageAll: boolean;
  canFilterByUser: boolean;
  defaultDate: string;
  focusDate?: string;
  initialCalendarView: "day" | "week" | "month";
  internalHostId?: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [cancelling, startCancel] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<Meeting | null>(null);
  const [viewMode, setViewMode] = useState<"mine" | "all">("all");
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">(initialCalendarView);
  const [weekAnchorDate, setWeekAnchorDate] = useState(focusDate ?? defaultDate);
  const [selectedHostId, setSelectedHostId] = useState("all");
  const [openDayDate, setOpenDayDate] = useState<string | null>(focusDate ?? null);
  const [hoveredOverflowDate, setHoveredOverflowDate] = useState<string | null>(null);

  // "Minhas" exibe somente reuniões dos clientes do gestor responsável.
  // Reuniões gerais/compartilhadas continuam disponíveis em "Todas".
  const visibleMeetings = useMemo(() => {
    const scopedMeetings = viewMode === "mine"
      ? meetings.filter((meeting) => meeting.hostId === userId)
      : meetings;

    return canFilterByUser && selectedHostId !== "all"
      ? scopedMeetings.filter((meeting) => meeting.hostId === selectedHostId)
      : scopedMeetings;
  }, [canFilterByUser, meetings, selectedHostId, userId, viewMode]);

  const gridStart = new Date(gridStartISO);
  const monthRef = new Date(monthRefIso);
  const monthName = MONTHS[monthRef.getUTCMonth()];
  const year = monthRef.getUTCFullYear();
  const todayStr = todayInBrazil();
  const weekStart = useMemo(() => {
    const anchor = new Date(`${weekAnchorDate}T00:00:00Z`);
    const start = new Date(anchor);
    start.setUTCDate(anchor.getUTCDate() - anchor.getUTCDay());
    return start;
  }, [weekAnchorDate]);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    return d;
  });
  const displayedDays = calendarView === "month"
    ? days
    : calendarView === "day"
    ? [new Date(weekAnchorDate + "T00:00:00Z")]
    : Array.from({ length: 7 }, (_, index) => {
        const day = new Date(weekStart);
        day.setUTCDate(weekStart.getUTCDate() + index);
        return day;
      });

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
      const month = new Date(monthRefIso);
      const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1));
      router.push(`/calendario?month=${toMonthStr(next)}`);
    },
    [monthRefIso, router]
  );

  const navigateWeek = useCallback(
    (delta: number) => {
      const next = new Date(weekStart);
      next.setUTCDate(weekStart.getUTCDate() + (delta * 7));
      const date = toDateStr(next);
      router.push(`/calendario?view=week&date=${date}&month=${toMonthStr(next)}`);
    },
    [router, weekStart],
  );

  // A visão de dia anda de um em um, sem recarregar: o âncora é estado local.
  const navigateDay = useCallback(
    (delta: number) => {
      const atual = new Date(weekAnchorDate + "T00:00:00Z");
      atual.setUTCDate(atual.getUTCDate() + delta);
      setWeekAnchorDate(toDateStr(atual));
    },
    [weekAnchorDate],
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
        setOpenDayDate(null);
        setCancelTarget(m);
      } else {
        if (!confirm("Cancelar esta reunião?")) return;
        setOpenDayDate(null);
        startCancel(async () => {
          await cancelMeetingAction(m.id, "single");
          router.refresh();
        });
      }
    },
    [router]
  );

  const handleDeleteClick = useCallback(
    (meeting: Meeting) => {
      if (!confirm("Excluir permanentemente esta reunião? Esta ação não pode ser desfeita.")) return;
      setOpenDayDate(null);
      startDelete(async () => {
        const result = await deleteMeetingForeverAction(meeting.id);
        if (result.error) {
          alert(result.error);
          return;
        }
        router.refresh();
      });
    },
    [router]
  );

  const confirmCancel = useCallback(
    (scope: CancelScope) => {
      if (!cancelTarget) return;
      const id = cancelTarget.id;
      setCancelTarget(null);
      startCancel(async () => {
        await cancelMeetingAction(id, scope);
        router.refresh();
      });
    },
    [cancelTarget, router]
  );

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-slate-900 capitalize">
            {monthName} <span className="font-normal text-slate-500">{year}</span>
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => calendarView === "month" ? navigateMonth(-1) : calendarView === "day" ? navigateDay(-1) : navigateWeek(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label={calendarView === "month" ? "Mês anterior" : calendarView === "day" ? "Dia anterior" : "Semana anterior"}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => calendarView === "month" ? navigateMonth(1) : calendarView === "day" ? navigateDay(1) : navigateWeek(1)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
              aria-label={calendarView === "month" ? "Próximo mês" : calendarView === "day" ? "Próximo dia" : "Próxima semana"}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (calendarView === "month") { router.push("/calendario?view=month"); return; }
                setWeekAnchorDate(todayStr);
              }}
              className="ml-2 px-4 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
            >
              Hoje
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full bg-slate-100 p-0.5" aria-label="Visualização do calendário">
            <button
              type="button"
              onClick={() => {
                setWeekAnchorDate(todayStr);
                setCalendarView("day");
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                calendarView === "day" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => {
                const displayedMonth = toMonthStr(monthRef);
                const anchor = focusDate
                  ?? (defaultDate.startsWith(displayedMonth) ? defaultDate : `${displayedMonth}-01`);
                setWeekAnchorDate(anchor);
                setCalendarView("week");
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                calendarView === "week" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setCalendarView("month")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                calendarView === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Mês
            </button>
          </div>
          {/* Admin já vê todas e filtra por pessoa; demais usuários alternam entre sua agenda e o conjunto permitido. */}
          {!canFilterByUser ? (
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
          ) : null}
          {canFilterByUser ? (
            <select
              value={selectedHostId}
              onChange={(event) => {
                setSelectedHostId(event.target.value);
                if (event.target.value !== "all") setViewMode("all");
              }}
              aria-label="Filtrar agenda por pessoa"
              className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas as pessoas</option>
              {users.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          ) : null}
          <NewMeetingDialog
            users={users}
            clients={clients}
            currentUserId={userId}
            canManageAll={canManageAll}
            defaultDate={defaultDate}
            internalHostId={internalHostId}
          />
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

      {calendarView !== "month" ? (
        <WeekTimeGrid
          days={displayedDays}
          todayStr={todayStr}
          meetingsByDate={meetingsByDate}
          availableDays={availableDays}
          userId={userId}
          canManageAll={canManageAll}
          cancelling={cancelling}
          deleting={deleting}
          onCancelClick={handleCancelClick}
          onDeleteClick={handleDeleteClick}
        />
      ) : (
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Weekday headers */}
        <div className="grid min-w-[1260px] grid-cols-7 border-b border-slate-200 bg-slate-50/70">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="border-r border-slate-200/80 py-3 text-center text-xs font-semibold tracking-[0.12em] text-slate-500 last:border-r-0"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className={`grid min-w-[1260px] grid-cols-7 ${calendarView === "month" ? "auto-rows-[270px]" : "auto-rows-[560px]"}`}>
          {displayedDays.map((day, idx) => {
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
                canManageAll={canManageAll}
                cancelling={cancelling}
                deleting={deleting}
                onCancelClick={handleCancelClick}
                onDeleteClick={handleDeleteClick}
                onOpenDay={setOpenDayDate}
                onHoverOverflow={setHoveredOverflowDate}
                calendarView={calendarView}
              />
            );
          })}
        </div>
      </div>
      )}

      <DayMeetingsDialog
        dateStr={openDayDate}
        meetings={openDayMeetings}
        open={openDayDate !== null}
        onOpenChange={(open) => { if (!open) setOpenDayDate(null); }}
        userId={userId}
        canManageAll={canManageAll}
        cancelling={cancelling}
        deleting={deleting}
        onCancelClick={handleCancelClick}
        onDeleteClick={handleDeleteClick}
      />

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
