"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Loader2, Pencil } from "lucide-react";
import { updateTaskDueDateAction } from "@/app/(dashboard)/tarefas/actions";

export function TaskDueDateEditor({
  taskId,
  dueDate,
  canEdit,
}: {
  taskId: string;
  dueDate: Date | null;
  canEdit: boolean;
}) {
  const initialValue = dueDate ? format(new Date(dueDate), "yyyy-MM-dd") : "";
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save(nextValue: string) {
    setEditing(false);
    if (!nextValue) return;
    setValue(nextValue);
    if (nextValue === value) return;
    startTransition(async () => {
      await updateTaskDueDateAction(taskId, nextValue);
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-neutral-600">
        <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
        <input
          type="date"
          required
          autoFocus
          defaultValue={value}
          onChange={(event) => save(event.target.value)}
          onBlur={(event) => save(event.target.value)}
          disabled={isPending}
          aria-label="Alterar prazo da tarefa"
          className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>
    );
  }

  const label = value
    ? format(new Date(`${value}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })
    : "Sem prazo";

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={!canEdit || isPending}
      title={canEdit ? "Alterar prazo" : undefined}
      className="group flex items-center gap-2 text-neutral-600 transition-colors enabled:hover:text-blue-600 disabled:cursor-default"
    >
      {isPending
        ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-neutral-400" />
        : <Calendar className="w-4 h-4 shrink-0 text-neutral-400" />}
      <span className={value ? "" : "text-neutral-400"}>{label}</span>
      {canEdit && !isPending && (
        <Pencil className="w-3 h-3 text-neutral-400" />
      )}
    </button>
  );
}
