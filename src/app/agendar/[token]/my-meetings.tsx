"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Repeat, Clock, CalendarDays, Check, X, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS_SHORT[dt.getDay()]}, ${dt.getDate()} de ${MONTHS[dt.getMonth()]}`;
}

export type ClientMeeting = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
};

type Slot = { startTime: string; endTime: string };

export function MyMeetings({
  meetings,
  token,
  availableDays,
  durationLabel,
  onChangeAll,
}: {
  meetings: ClientMeeting[];
  token: string;
  availableDays: number[];
  durationLabel: string;
  onChangeAll: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ClientMeeting | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [cancellingAll, setCancellingAll] = useState(false);

  async function handleConfirmAll() {
    setCancellingAll(true);
    try {
      await fetch(`/api/agendar/${token}/cancel-all`, { method: "POST" });
      setConfirmAll(false);
      onChangeAll();
    } finally {
      setCancellingAll(false);
    }
  }

  if (editing) {
    return (
      <EditMeetingPanel
        meeting={editing}
        token={token}
        availableDays={availableDays}
        durationLabel={durationLabel}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-400 text-center mb-1">
        Suas próximas {meetings.length} {meetings.length === 1 ? "reunião" : "reuniões"}
      </p>

      {meetings.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              {formatDate(m.date)}
              {m.isRecurring && (
                <Repeat className="w-3 h-3 text-blue-500 shrink-0" />
              )}
            </p>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {m.startTime} – {m.endTime}
            </p>
          </div>
          <button
            onClick={() => setEditing(m)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <div className="border-t border-slate-100 mt-2 pt-3">
        {!confirmAll ? (
          <button
            onClick={() => setConfirmAll(true)}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors"
          >
            Quero mudar todas as datas
          </button>
        ) : (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-800 mb-3">
              Isso vai <strong>cancelar</strong> todas as suas {meetings.length} reuniões futuras e você poderá marcar uma nova série. Tem certeza?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmAll(false)}
                disabled={cancellingAll}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmAll}
                disabled={cancellingAll}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {cancellingAll ? "Cancelando..." : "Cancelar e remarcar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditMeetingPanel({
  meeting,
  token,
  availableDays,
  durationLabel,
  onCancel,
  onSaved,
}: {
  meeting: ClientMeeting;
  token: string;
  availableDays: number[];
  durationLabel: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const today = new Date();
  const [y0, m0] = meeting.date.split("-").map(Number);
  const [viewYear, setViewYear] = useState(y0);
  const [viewMonth, setViewMonth] = useState(m0 - 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(meeting.date);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const availableSet = new Set(availableDays);
  const todayStr = toDateStr(today);

  // Carrega slots iniciais para a data atual da reunião
  useEffect(() => {
    fetchSlots(meeting.date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchSlots(dateStr: string) {
    setLoadingSlots(true);
    setError(null);
    try {
      const res = await fetch(`/api/agendar/${token}/slots?date=${dateStr}`);
      const data = await res.json();
      if (data.slots) setSlots(data.slots);
    } catch {
      setError("Erro ao buscar horários.");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function selectDate(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setSlots([]);
    await fetchSlots(dateStr);
  }

  async function save() {
    if (!selectedDate || !selectedSlot) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/agendar/${token}/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, startTime: selectedSlot.startTime }),
      });
      const data = await res.json();
      if (data.ok) onSaved();
      else setError(data.error ?? "Erro ao salvar.");
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelMeeting() {
    setDeleting(true);
    try {
      await fetch(`/api/agendar/${token}/meetings/${meeting.id}`, { method: "DELETE" });
      onSaved();
    } finally {
      setDeleting(false);
    }
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-700 transition-colors"
          title="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-sm font-bold text-slate-800">Editar reunião</h3>
      </div>

      <p className="text-xs text-slate-500">
        Atual: <strong>{formatDate(meeting.date)}</strong> às <strong>{meeting.startTime}</strong>
      </p>

      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
        <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span><strong>Duração:</strong> {durationLabel}. Marque com pelo menos 1 h de antecedência.</span>
      </div>

      {/* Calendar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => {
              if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
              else setViewMonth((m) => m - 1);
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-slate-800">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            onClick={() => {
              if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
              else setViewMonth((m) => m + 1);
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS_SHORT.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-0.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }, (_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayOfWeek = new Date(viewYear, viewMonth, day).getDay();
            const isPast = dateStr < todayStr;
            const isAvailable = availableSet.has(dayOfWeek) && !isPast;
            const isSelected = selectedDate === dateStr;
            return (
              <button
                key={day}
                onClick={() => isAvailable && selectDate(dateStr)}
                disabled={!isAvailable}
                className={`aspect-square rounded-md text-xs font-medium transition-colors
                  ${isSelected ? "bg-blue-600 text-white" : ""}
                  ${!isSelected && isAvailable ? "hover:bg-blue-50 text-slate-800" : ""}
                  ${!isAvailable ? "text-slate-300 cursor-not-allowed" : ""}`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      {selectedDate && (
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Horários
          </p>
          {loadingSlots ? (
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="w-16 h-8 rounded-md bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum horário disponível.</p>
          ) : (
            <div className="flex gap-1.5 flex-wrap">
              {slots.map((s) => (
                <button
                  key={s.startTime}
                  onClick={() => setSelectedSlot(s)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors
                    ${selectedSlot?.startTime === s.startTime
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"}`}
                >
                  {s.startTime}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-col gap-2 pt-2">
        <button
          onClick={save}
          disabled={!selectedSlot || saving}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <Check className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar alteração"}
        </button>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full py-2 text-red-600 hover:text-red-700 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Cancelar esta reunião
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg transition-colors disabled:opacity-50"
            >
              Não cancelar
            </button>
            <button
              onClick={cancelMeeting}
              disabled={deleting}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {deleting ? "Cancelando..." : "Sim, cancelar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
