"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Check, CalendarDays, Clock } from "lucide-react";

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
        body: JSON.stringify({ date: selectedDate, startTime: selectedSlot.startTime }),
      });
      const data = await res.json();
      if (data.ok) {
        setBooked(true);
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
        <h2 className="text-xl font-bold text-slate-900 mb-2">Reunião agendada!</h2>
        <p className="text-slate-500 text-sm max-w-xs">
          Sua reunião com <strong>{userName}</strong> foi confirmada para{" "}
          <strong>
            {DAYS_SHORT[dateObj.getDay()]}, {dateObj.getDate()} de {MONTHS[dateObj.getMonth()]}
          </strong>{" "}
          às <strong>{selectedSlot.startTime}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
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
              <p className="text-xs text-blue-600">{selectedSlot.startTime} – {selectedSlot.endTime} (30 min)</p>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <button
            onClick={confirmBooking}
            disabled={booking}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {booking ? "Agendando..." : "Confirmar agendamento"}
          </button>
        </div>
      )}
    </div>
  );
}
