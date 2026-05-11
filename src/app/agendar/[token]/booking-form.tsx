"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Check, CalendarDays, Clock, Repeat } from "lucide-react";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DAYS_LONG = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
const WEEK_LABELS = ["1ª","2ª","3ª","4ª","5ª"];

function getWeekOfMonthFromDateStr(dateStr: string): number {
  const [, , d] = dateStr.split("-").map(Number);
  return Math.ceil(d / 7);
}

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

type Slot = { startTime: string; endTime: string };

export function BookingForm({
  userName,
  token,
  availableDays,
}: {
  userName: string;
  token: string;
  availableDays: number[];
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [bookedSummary, setBookedSummary] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableSet = new Set(availableDays);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  async function selectDate(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setSlots([]);
    setLoadingSlots(true);
    setError(null);
    // Set default week based on selected date
    const week = getWeekOfMonthFromDateStr(dateStr);
    setSelectedWeek(week);
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

  async function confirmBooking() {
    if (!selectedDate || !selectedSlot) return;
    setBooking(true);
    setError(null);
    try {
      const res = await fetch(`/api/agendar/${token}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          startTime: selectedSlot.startTime,
          recurring,
          weekOfMonth: recurring && selectedWeek ? selectedWeek : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBooked(true);
        if (data.recurring) setBookedSummary({ created: data.created, skipped: data.skipped });
      } else {
        setError(data.error ?? "Erro ao agendar.");
      }
    } catch {
      setError("Erro ao agendar. Tente novamente.");
    } finally {
      setBooking(false);
    }
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const todayStr = toDateStr(today);

  if (booked && selectedDate && selectedSlot) {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {bookedSummary ? "Reuniões agendadas!" : "Reunião agendada!"}
        </h2>
        <p className="text-slate-500 text-sm max-w-xs">
          {bookedSummary ? (
            <>
              <strong>{bookedSummary.created}</strong> reuniões mensais com <strong>{userName}</strong>{" "}
              começando <strong>{DAYS_SHORT[dateObj.getDay()]}, {dateObj.getDate()} de {MONTHS[dateObj.getMonth()]}</strong>{" "}
              às <strong>{selectedSlot.startTime}</strong>.
              {bookedSummary.skipped > 0 && (
                <span className="block mt-2 text-xs text-amber-600">
                  {bookedSummary.skipped} ocorrência{bookedSummary.skipped !== 1 ? "s" : ""} pulada{bookedSummary.skipped !== 1 ? "s" : ""} por conflito.
                </span>
              )}
            </>
          ) : (
            <>
              Sua reunião com <strong>{userName}</strong> foi confirmada para{" "}
              <strong>{DAYS_SHORT[dateObj.getDay()]}, {dateObj.getDate()} de {MONTHS[dateObj.getMonth()]}</strong>{" "}
              às <strong>{selectedSlot.startTime}</strong>.
            </>
          )}
        </p>
      </div>
    );
  }

  let recurrenceLabel = "";
  if (selectedDate) {
    const [ry, rm, rd] = selectedDate.split("-").map(Number);
    const weekday = new Date(ry, rm - 1, rd).getDay();
    const week = getWeekOfMonthFromDateStr(selectedDate);
    recurrenceLabel = `Toda ${WEEK_LABELS[week - 1]} ${DAYS_LONG[weekday]} do mês`;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tolerância banner */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
        <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          <strong>Tolerância de 10 min:</strong> você pode confirmar uma reunião até 10 minutos após o horário marcado começar.
        </span>
      </div>

      {/* Calendar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-800">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS_SHORT.map((d) => (
            <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-1">{d}</div>
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
            const isToday = dateStr === todayStr;

            return (
              <button
                key={day}
                onClick={() => isAvailable && selectDate(dateStr)}
                disabled={!isAvailable}
                className={`aspect-square rounded-lg text-sm font-medium transition-colors flex items-center justify-center
                  ${isSelected ? "bg-blue-600 text-white shadow-sm" : ""}
                  ${!isSelected && isAvailable && isToday ? "border-2 border-blue-600 text-blue-600" : ""}
                  ${!isSelected && isAvailable && !isToday ? "hover:bg-blue-50 text-slate-800" : ""}
                  ${!isAvailable ? "text-slate-300 cursor-not-allowed" : ""}
                `}
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
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Horários disponíveis
          </h3>
          {loadingSlots ? (
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="w-20 h-9 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum horário disponível neste dia.</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {slots.map((s) => (
                <button
                  key={s.startTime}
                  onClick={() => setSelectedSlot(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors
                    ${selectedSlot?.startTime === s.startTime
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                >
                  {s.startTime}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm */}
      {selectedSlot && (
        <div>
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 mb-3 flex items-center gap-3">
            <CalendarDays className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <p className="text-xs text-blue-700 font-semibold">
                {(() => {
                  const [y, m, d] = selectedDate!.split("-").map(Number);
                  const dateObj = new Date(y, m - 1, d);
                  return `${DAYS_SHORT[dateObj.getDay()]}, ${dateObj.getDate()} de ${MONTHS[dateObj.getMonth()]}`;
                })()}
              </p>
              <p className="text-xs text-blue-600">{selectedSlot.startTime} – {selectedSlot.endTime}</p>
              <p className="text-[11px] text-blue-500 mt-1 font-medium">Duração: 30 min (fixo)</p>
            </div>
          </div>
          {/* Recurring toggle */}
          <button
            type="button"
            onClick={() => setRecurring((v) => !v)}
            className={`w-full mb-2 p-3 rounded-xl border text-left flex items-center gap-3 transition-colors ${
              recurring
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${recurring ? "bg-blue-600" : "bg-slate-300"}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${recurring ? "left-4" : "left-0.5"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Repeat className="w-3 h-3" />
                Repetir mensalmente
              </p>
              {recurring && (
                <p className="text-[11px] text-blue-700 mt-0.5">{recurrenceLabel} (próximos 12 meses)</p>
              )}
            </div>
          </button>

          {/* Week selector (only if recurring) */}
          {recurring && (
            <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-2">Qual semana do mês?</p>
              <div className="flex gap-2 flex-wrap">
                {WEEK_LABELS.map((label, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedWeek(idx + 1)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selectedWeek === idx + 1
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <button
            onClick={confirmBooking}
            disabled={booking}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {booking ? "Agendando..." : recurring ? "Confirmar série mensal" : "Confirmar agendamento"}
          </button>
        </div>
      )}
    </div>
  );
}
