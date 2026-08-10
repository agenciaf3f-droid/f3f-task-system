"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatusAction, setTaskBlockedAction, deleteTaskAction, duplicateTaskAction, archiveTaskAction } from "../actions";
import { Button } from "@/components/ui/button";
import { STATUS_CONFIG } from "@/components/tasks/task-badges";
import { Trash2, ChevronDown, Loader2, Copy, Archive, Flag } from "lucide-react";
import type { TaskStatus } from "@prisma/client";

const STATUS_ORDER: TaskStatus[] = [
  "todo","in_progress","review","blocked","done","cancelled",
];

export function TaskActions({
  taskId,
  currentStatus,
  isBlocked,
  canEdit,
}: {
  taskId: string;
  currentStatus: TaskStatus;
  isBlocked: boolean;
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [blocked, setBlocked] = useOptimistic(isBlocked);
  const router = useRouter();

  function changeStatus(status: TaskStatus) {
    setShowStatusMenu(false);
    startTransition(async () => {
      await updateTaskStatusAction(taskId, status);
    });
  }

  function handleDelete() {
    if (!confirm("Tem certeza? A tarefa será arquivada.")) return;
    startTransition(async () => {
      await deleteTaskAction(taskId);
      // router.back() funciona em modal interceptado (fecha) e em página standalone (volta).
      router.back();
    });
  }

  function handleBlockedToggle() {
    const nextBlocked = !blocked;
    startTransition(async () => {
      setBlocked(nextBlocked);
      const result = await setTaskBlockedAction(taskId, nextBlocked);
      if (!result.error) router.refresh();
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const res = await duplicateTaskAction(taskId);
      if (res.newTaskId) router.push(`/tarefas/${res.newTaskId}`);
    });
  }

  function handleArchive() {
    if (!confirm("Arquivar tarefa? Ela será ocultada das views padrão.")) return;
    startTransition(async () => {
      await archiveTaskAction(taskId);
      router.back();
    });
  }

  if (!canEdit) return null;

  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Status selector */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowStatusMenu((v) => !v)}
          disabled={isPending}
          className="text-xs"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : null}
          {STATUS_CONFIG[currentStatus].label}
          <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
        </Button>
        {showStatusMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowStatusMenu(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-44">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors ${
                    s === currentStatus
                      ? "font-medium text-neutral-900"
                      : "text-neutral-600"
                  }`}
                >
                  {STATUS_CONFIG[s].label}
                  {s === currentStatus && (
                    <span className="ml-2 text-neutral-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Independent blocking flag — does not change task status. */}
      <Button
        variant="outline"
        size="sm"
        className={blocked
          ? "text-xs border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
          : "text-xs text-neutral-500"}
        onClick={handleBlockedToggle}
        disabled={isPending}
        title={blocked ? "Desbloquear tarefa" : "Bloquear tarefa"}
        aria-label={blocked ? "Desbloquear tarefa" : "Bloquear tarefa"}
      >
        <Flag className={`w-3.5 h-3.5 mr-1.5 ${blocked ? "fill-current" : ""}`} />
        {blocked ? "Desbloquear" : "Bloquear"}
      </Button>

      {/* Duplicate */}
      <Button
        variant="ghost"
        size="icon"
        className="w-8 h-8 text-neutral-400 hover:text-blue-600 hover:bg-blue-50"
        onClick={handleDuplicate}
        disabled={isPending}
        title="Duplicar tarefa"
      >
        <Copy className="w-4 h-4" />
      </Button>

      {/* Archive */}
      <Button
        variant="ghost"
        size="icon"
        className="w-8 h-8 text-neutral-400 hover:text-amber-600 hover:bg-amber-50"
        onClick={handleArchive}
        disabled={isPending}
        title="Arquivar tarefa"
      >
        <Archive className="w-4 h-4" />
      </Button>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="w-8 h-8 text-neutral-400 hover:text-red-600 hover:bg-red-50"
        onClick={handleDelete}
        disabled={isPending}
        title="Excluir tarefa"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
