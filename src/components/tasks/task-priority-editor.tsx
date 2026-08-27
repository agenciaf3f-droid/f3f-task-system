"use client";

import { useState, useTransition } from "react";
import type { TaskPriority } from "@prisma/client";
import { Check, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateTaskPriorityAction } from "@/app/(dashboard)/tarefas/actions";
import { PRIORITY_OPTIONS, PriorityLabel } from "@/components/tasks/task-priority";

export function TaskPriorityEditor({ taskId, priority, canEdit }: { taskId: string; priority: TaskPriority; canEdit: boolean }) {
  const [current, setCurrent] = useState(priority);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function choose(next: TaskPriority) {
    const previous = current;
    setCurrent(next);
    setOpen(false);
    if (next === previous) return;
    startTransition(async () => {
      const result = await updateTaskPriorityAction(taskId, next);
      if (result.error) {
        setCurrent(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => canEdit && setOpen((value) => !value)}
        disabled={!canEdit || isPending}
        title={canEdit ? "Alterar prioridade" : undefined}
        className="inline-flex items-center gap-1.5 transition-opacity enabled:hover:opacity-70 disabled:cursor-default"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" /> : <PriorityLabel priority={current} />}
        {canEdit && !isPending && <Pencil className="h-3 w-3 text-neutral-400" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-xl border border-neutral-200 bg-popover p-1.5 text-popover-foreground shadow-xl">
          {PRIORITY_OPTIONS.map((option) => (
            <button key={option.value} type="button" onClick={() => choose(option.value)} disabled={isPending} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-neutral-100 disabled:opacity-50">
              <PriorityLabel priority={option.value} />
              {current === option.value && <Check className="ml-auto h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
