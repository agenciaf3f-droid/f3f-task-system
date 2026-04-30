"use client";

import { useState, useRef, useEffect } from "react";
import { Repeat, X, ChevronDown } from "lucide-react";

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  interval: number;
  byWeekday?: number[];   // 0=dom, 6=sab
  monthDay?: number;      // 1-31
}

interface Props {
  name?: string;          // hidden input field name (default: "recurrenceRule")
  defaultValue?: RecurrenceRule | null;
  disabled?: boolean;
}

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function describeRule(r: RecurrenceRule | null): string {
  if (!r) return "Não repete";
  const n = r.interval;
  switch (r.freq) {
    case "daily":
      return n === 1 ? "Diariamente" : `A cada ${n} dias`;
    case "weekly": {
      const base = n === 1 ? "Toda semana" : `A cada ${n} semanas`;
      if (r.byWeekday && r.byWeekday.length > 0) {
        const dias = r.byWeekday.sort().map((d) => WEEKDAY_FULL[d].slice(0, 3).toLowerCase()).join(", ");
        return `${base} (${dias})`;
      }
      return base;
    }
    case "monthly": {
      const base = n === 1 ? "Todo mês" : `A cada ${n} meses`;
      if (r.monthDay) return `${base} (dia ${r.monthDay})`;
      return base;
    }
    case "yearly":
      return n === 1 ? "Todo ano" : `A cada ${n} anos`;
  }
}

export function RecurrencePicker({ name = "recurrenceRule", defaultValue = null, disabled }: Props) {
  const [rule, setRule] = useState<RecurrenceRule | null>(defaultValue);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function update(patch: Partial<RecurrenceRule>) {
    setRule((prev) => ({ ...(prev ?? { freq: "weekly", interval: 1 }), ...patch }));
  }

  function toggleWeekday(d: number) {
    setRule((prev) => {
      const cur = prev ?? { freq: "weekly", interval: 1 } as RecurrenceRule;
      const list = cur.byWeekday ?? [];
      const next = list.includes(d) ? list.filter((x) => x !== d) : [...list, d];
      return { ...cur, byWeekday: next };
    });
  }

  function clear() {
    setRule(null);
    setOpen(false);
  }

  const hasRule = rule !== null;
  const value = rule ? JSON.stringify(rule) : "";

  return (
    <div ref={ref} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm hover:bg-neutral-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50 w-full ${
          hasRule ? "text-neutral-900" : "text-neutral-500"
        }`}
      >
        <Repeat className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left truncate">{describeRule(rule)}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-80 bg-white border border-neutral-200 rounded-lg shadow-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-800">Repetir</span>
            {hasRule && (
              <button
                type="button"
                onClick={clear}
                className="text-xs text-neutral-500 hover:text-red-600 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Não repetir
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 shrink-0">A cada</span>
            <input
              type="number"
              min={1}
              value={rule?.interval ?? 1}
              onChange={(e) => update({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-16 h-8 rounded border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <select
              value={rule?.freq ?? "weekly"}
              onChange={(e) => update({ freq: e.target.value as RecurrenceFreq })}
              className="flex-1 h-8 rounded border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="daily">{(rule?.interval ?? 1) === 1 ? "dia" : "dias"}</option>
              <option value="weekly">{(rule?.interval ?? 1) === 1 ? "semana" : "semanas"}</option>
              <option value="monthly">{(rule?.interval ?? 1) === 1 ? "mês" : "meses"}</option>
              <option value="yearly">{(rule?.interval ?? 1) === 1 ? "ano" : "anos"}</option>
            </select>
          </div>

          {(rule?.freq ?? "weekly") === "weekly" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-neutral-500">Nos dias</span>
              <div className="flex gap-1">
                {WEEKDAY_LABELS.map((label, i) => {
                  const active = rule?.byWeekday?.includes(i) ?? false;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleWeekday(i)}
                      className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                        active
                          ? "bg-blue-600 text-white"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                      title={WEEKDAY_FULL[i]}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(rule?.freq ?? "weekly") === "monthly" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 shrink-0">No dia</span>
              <input
                type="number"
                min={1}
                max={31}
                value={rule?.monthDay ?? ""}
                placeholder="—"
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  update({ monthDay: isNaN(v) ? undefined : Math.min(31, Math.max(1, v)) });
                }}
                className="w-16 h-8 rounded border border-neutral-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-xs text-neutral-400">do mês (vazio = data da tarefa)</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-1.5 rounded bg-neutral-900 text-white hover:bg-neutral-800"
            >
              Pronto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
