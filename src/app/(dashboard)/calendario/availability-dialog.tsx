"use client";

import { useState, useTransition } from "react";
import { Settings, X } from "lucide-react";
import { saveAvailabilityAction, type AvailabilityInput } from "./actions";

const DAYS = [
  { label: "Segunda", short: "Seg", value: 1 },
  { label: "Terça",   short: "Ter", value: 2 },
  { label: "Quarta",  short: "Qua", value: 3 },
  { label: "Quinta",  short: "Qui", value: 4 },
  { label: "Sexta",   short: "Sex", value: 5 },
  { label: "Sábado",  short: "Sáb", value: 6 },
  { label: "Domingo", short: "Dom", value: 0 },
];

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

type DayConfig = { enabled: boolean; startTime: string; endTime: string };

function buildInitialState(
  availability: { dayOfWeek: number; startTime: string; endTime: string }[],
): Record<number, DayConfig> {
  const map: Record<number, DayConfig> = {};
  for (const d of DAYS) {
    const found = availability.find((a) => a.dayOfWeek === d.value);
    map[d.value] = found
      ? { enabled: true, startTime: found.startTime, endTime: found.endTime }
      : { enabled: false, startTime: "09:00", endTime: "18:00" };
  }
  return map;
}

export function AvailabilityDialog({
  availability,
}: {
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(() => buildInitialState(availability));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(dayValue: number) {
    setDays((prev) => ({
      ...prev,
      [dayValue]: { ...prev[dayValue], enabled: !prev[dayValue].enabled },
    }));
  }

  function setTime(dayValue: number, field: "startTime" | "endTime", value: string) {
    setDays((prev) => ({ ...prev, [dayValue]: { ...prev[dayValue], [field]: value } }));
  }

  function handleSave() {
    const data: AvailabilityInput = Object.entries(days)
      .filter(([, cfg]) => cfg.enabled)
      .map(([dow, cfg]) => ({
        dayOfWeek: Number(dow),
        startTime: cfg.startTime,
        endTime: cfg.endTime,
      }));

    startTransition(async () => {
      await saveAvailabilityAction(data);
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); }, 800);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Settings className="w-4 h-4" />
        Disponibilidade
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">Configurar disponibilidade</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">Defina os horários que clientes poderão agendar reuniões.</p>

            <div className="flex flex-col gap-3">
              {DAYS.map((d) => {
                const cfg = days[d.value];
                return (
                  <div key={d.value} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${cfg.enabled ? "border-blue-200 bg-blue-50/50" : "border-slate-100 bg-slate-50/50"}`}>
                    <button
                      onClick={() => toggle(d.value)}
                      className={`w-10 h-5 rounded-full transition-colors shrink-0 relative ${cfg.enabled ? "bg-blue-600" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                    <span className={`w-10 text-sm font-semibold ${cfg.enabled ? "text-slate-800" : "text-slate-400"}`}>{d.short}</span>
                    {cfg.enabled && (
                      <div className="flex items-center gap-2 ml-auto">
                        <select
                          value={cfg.startTime}
                          onChange={(e) => setTime(d.value, "startTime", e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-blue-400"
                        >
                          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className="text-xs text-slate-400">até</span>
                        <select
                          value={cfg.endTime}
                          onChange={(e) => setTime(d.value, "endTime", e.target.value)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-blue-400"
                        >
                          {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    )}
                    {!cfg.enabled && <span className="ml-auto text-xs text-slate-400">Indisponível</span>}
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleSave}
              disabled={pending}
              className="mt-5 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {saved ? "Salvo!" : pending ? "Salvando..." : "Salvar disponibilidade"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
