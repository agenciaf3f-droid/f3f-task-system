"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PRIORITY_OPTIONS, PriorityIcon, priorityLabelOf } from "@/components/tasks/task-priority";

// Mesmo desenho do ClientPicker: gatilho próprio, painel em <div> e o valor
// viajando por um input hidden. O <select> nativo não deixa estilizar a lista
// de opções — o menu quem desenha é o sistema operacional — e era justamente
// ali que os sinais de prioridade precisavam aparecer.
export function PriorityPicker({
  id,
  name,
  value,
  onValueChange,
  disabled = false,
}: {
  id: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // `urgent` saiu das opções, mas tarefa antiga pode estar nela: enquanto for o
  // valor atual, continua na lista para não ser rebaixada sem querer.
  const options = PRIORITY_OPTIONS.some((option) => option.value === value) || !value
    ? PRIORITY_OPTIONS
    : [...PRIORITY_OPTIONS, { value, label: priorityLabelOf(value) }];

  useEffect(() => {
    if (!open) return;
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
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-sm transition-colors hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PriorityIcon priority={value} />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{priorityLabelOf(value)}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-popover p-1.5 shadow-xl"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(option.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                  isSelected ? "bg-blue-50 text-blue-700" : "text-foreground hover:bg-neutral-100"
                }`}
              >
                <PriorityIcon priority={option.value} />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
