"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Loader2, Pencil } from "lucide-react";
import { updateTaskDeliveryDateAction, updateTaskDueDateAction } from "@/app/(dashboard)/tarefas/actions";

// A tarefa tem duas datas. A de conclusão é obrigatória e é a que manda no
// atraso, nos relatórios e na ordem do board; a de entrega é opcional e pode
// ser apagada. Como agora aparecem lado a lado, cada uma leva o próprio rótulo:
// duas datas soltas com o mesmo ícone não diriam qual é qual.
const FIELDS = {
  dueDate:      { label: "Conclusão", empty: "Sem prazo",   required: true  },
  deliveryDate: { label: "Entrega",   empty: "Sem data",    required: false },
} as const;

export function TaskDueDateEditor({
  taskId,
  value: initialDate,
  canEdit,
  field = "dueDate",
}: {
  taskId: string;
  value: Date | null;
  canEdit: boolean;
  field?: keyof typeof FIELDS;
}) {
  const config = FIELDS[field];
  const [value, setValue] = useState(initialDate ? format(new Date(initialDate), "yyyy-MM-dd") : "");
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save(nextValue: string) {
    setEditing(false);
    if (config.required && !nextValue) return;
    if (nextValue === value) return;
    setValue(nextValue);
    startTransition(async () => {
      if (field === "deliveryDate") {
        await updateTaskDeliveryDateAction(taskId, nextValue || null);
        return;
      }
      await updateTaskDueDateAction(taskId, nextValue);
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-neutral-600">
        <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
        <input
          type="date"
          required={config.required}
          autoFocus
          defaultValue={value}
          onChange={(event) => save(event.target.value)}
          onBlur={(event) => save(event.target.value)}
          disabled={isPending}
          aria-label={`Alterar prazo de ${config.label.toLowerCase()} da tarefa`}
          className="h-8 rounded-md border border-neutral-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>
    );
  }

  const label = value
    ? format(new Date(`${value}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })
    : config.empty;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={!canEdit || isPending}
      title={canEdit ? `Alterar prazo de ${config.label.toLowerCase()}` : undefined}
      className="group flex items-center gap-2 text-neutral-600 transition-colors enabled:hover:text-blue-600 disabled:cursor-default"
    >
      {isPending
        ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-neutral-400" />
        : <Calendar className="w-4 h-4 shrink-0 text-neutral-400" />}
      <span className="text-neutral-400">{config.label}</span>
      <span className={value ? "" : "text-neutral-400"}>{label}</span>
      {canEdit && !isPending && (
        <Pencil className="w-3 h-3 text-neutral-400" />
      )}
    </button>
  );
}
