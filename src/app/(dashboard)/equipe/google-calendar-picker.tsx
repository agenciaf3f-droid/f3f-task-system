"use client";

import { useEffect, useState, useTransition } from "react";
import { Calendar, ChevronDown, Check } from "lucide-react";
import { listGoogleCalendarsAction, setUserGoogleCalendarAction } from "./actions";

type Option = { id: string; summary: string };

export function GoogleCalendarPicker({
  userId,
  current,
}: {
  userId: string;
  current: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [value, setValue] = useState<string | null>(current);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function ensureLoaded() {
    if (options.length > 0 || loading) return;
    setLoading(true);
    try {
      const list = await listGoogleCalendarsAction();
      setOptions(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) ensureLoaded();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(id: string | null) {
    setError(null);
    setOpen(false);
    const next = id;
    setValue(next);
    startTransition(async () => {
      const res = await setUserGoogleCalendarAction(userId, next);
      if (res.error) {
        setError(res.error);
        setValue(current); // revert
      }
    });
  }

  const currentLabel = value
    ? options.find((o) => o.id === value)?.summary ?? "Agenda configurada"
    : "Sem agenda";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 max-w-[180px] disabled:opacity-50"
        title={value ?? "Sem agenda mapeada"}
      >
        <Calendar className="w-3 h-3 shrink-0 text-neutral-400" />
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className="w-3 h-3 shrink-0 text-neutral-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-64 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              <button
                onClick={() => pick(null)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 flex items-center gap-2 text-neutral-600"
              >
                {value === null && <Check className="w-3 h-3 text-blue-600" />}
                <span className={value === null ? "ml-0" : "ml-5"}>Sem agenda</span>
              </button>
              {loading && (
                <div className="px-3 py-2 text-xs text-neutral-400">Carregando…</div>
              )}
              {!loading && options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => pick(o.id)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-50 flex items-center gap-2 text-neutral-700"
                >
                  {value === o.id && <Check className="w-3 h-3 text-blue-600 shrink-0" />}
                  <span className={`truncate ${value === o.id ? "" : "ml-5"}`}>{o.summary}</span>
                </button>
              ))}
              {!loading && options.length === 0 && (
                <div className="px-3 py-2 text-xs text-neutral-400">Nenhuma agenda disponível.</div>
              )}
            </div>
          </div>
        </>
      )}
      {error && <p className="text-[10px] text-red-600 mt-1 max-w-[180px]">{error}</p>}
    </div>
  );
}
