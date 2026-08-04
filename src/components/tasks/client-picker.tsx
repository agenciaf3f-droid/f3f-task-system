"use client";

import { Check, ChevronDown, Search, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Client = { id: string; name: string };

export function ClientPicker({
  id,
  name,
  clients,
  value,
  onValueChange,
  disabled = false,
}: {
  id: string;
  name: string;
  clients: Client[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = clients.find((client) => client.id === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return normalized ? clients.filter((client) => client.name.toLocaleLowerCase("pt-BR").includes(normalized)) : clients;
  }, [clients, query]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function choose(nextValue: string) {
    onValueChange(nextValue);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" id={id} name={name} value={value} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm shadow-sm transition-colors hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selected ? (
          <span className="flex min-w-0 flex-1 items-center gap-2 text-foreground">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[10px] font-bold text-blue-600">
              {selected.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate font-medium">{selected.name}</span>
          </span>
        ) : (
          <span className="flex flex-1 items-center gap-2 text-muted-foreground">
            <UserRound className="h-4 w-4" />
            Sem cliente
          </span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-popover p-2 shadow-xl">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente..."
              className="h-9 w-full rounded-lg border border-neutral-200 bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div role="listbox" className="max-h-64 overflow-y-auto pr-1">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => choose("")}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${!value ? "bg-blue-50 text-blue-700" : "text-neutral-600 hover:bg-neutral-100"}`}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 text-neutral-400"><X className="h-3.5 w-3.5" /></span>
              <span className="flex-1">Sem cliente</span>
              {!value && <Check className="h-4 w-4" />}
            </button>
            {filtered.map((client) => {
              const isSelected = client.id === value;
              return (
                <button
                  key={client.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => choose(client.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${isSelected ? "bg-blue-50 text-blue-700" : "text-foreground hover:bg-neutral-100"}`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[10px] font-bold text-blue-600">
                    {client.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{client.name}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-5 text-center text-sm text-neutral-400">Nenhum cliente encontrado.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
