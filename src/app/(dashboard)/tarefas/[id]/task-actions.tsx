"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatusAction, cancelTaskAction, setTaskBlockedAction, deleteTaskAction, duplicateTaskAction } from "../actions";
import { Button } from "@/components/ui/button";
import { STATUS_CONFIG } from "@/components/tasks/task-badges";
import { Trash2, ChevronDown, Loader2, Copy, Flag } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STATUS_ORDER: TaskStatus[] = [
  "todo","in_progress","review","blocked","done","cancelled",
];

export function TaskActions({
  taskId,
  currentStatus,
  isBlocked,
  canEdit,
  canDelete,
}: {
  taskId: string;
  currentStatus: TaskStatus;
  isBlocked: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockError, setBlockError] = useState("");
  const [blocked, setBlocked] = useOptimistic(isBlocked);
  const router = useRouter();

  function changeStatus(status: TaskStatus) {
    setShowStatusMenu(false);
    if (status === "cancelled") {
      setCancelError("");
      setShowCancelDialog(true);
      return;
    }
    startTransition(async () => {
      await updateTaskStatusAction(taskId, status);
    });
  }

  function confirmCancellation() {
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError("Explique por que a tarefa está sendo cancelada.");
      return;
    }
    startTransition(async () => {
      const result = await cancelTaskAction(taskId, reason);
      if (result.error) {
        setCancelError(result.error);
        return;
      }
      setShowCancelDialog(false);
      setCancelReason("");
      setCancelError("");
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm("Tem certeza? A tarefa será excluída.")) return;
    startTransition(async () => {
      await deleteTaskAction(taskId);
      // router.back() funciona em modal interceptado (fecha) e em página standalone (volta).
      router.back();
    });
  }

  function handleBlockedToggle() {
    // Bloquear pede o motivo antes, igual ao cancelamento. Desbloquear é direto.
    if (!blocked) {
      setBlockError("");
      setShowBlockDialog(true);
      return;
    }
    startTransition(async () => {
      setBlocked(false);
      const result = await setTaskBlockedAction(taskId, false);
      if (!result.error) router.refresh();
    });
  }

  function confirmBlock() {
    const reason = blockReason.trim();
    if (!reason) {
      setBlockError("Explique por que a tarefa está sendo bloqueada.");
      return;
    }
    startTransition(async () => {
      setBlocked(true);
      const result = await setTaskBlockedAction(taskId, true, reason);
      if (result.error) {
        setBlockError(result.error);
        return;
      }
      setShowBlockDialog(false);
      setBlockReason("");
      setBlockError("");
      router.refresh();
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const res = await duplicateTaskAction(taskId);
      if (res.newTaskId) router.push(`/tarefas/${res.newTaskId}`);
    });
  }

  return (
    <>
    <div className="flex items-center gap-2 shrink-0">
      {/* Status selector — trocar status continua restrito a quem edita. */}
      {canEdit && (
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
      )}

      {/* Bloqueio: liberado para qualquer conta. Nao altera o status da tarefa. */}
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

      {canEdit && (
        <>
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

      {/* Delete */}
      {canDelete && (
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
      )}
        </>
      )}
    </div>
    <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Por que essa tarefa está sendo bloqueada?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <textarea
            value={blockReason}
            onChange={(event) => {
              setBlockReason(event.target.value);
              if (blockError) setBlockError("");
            }}
            rows={4}
            maxLength={2000}
            autoFocus
            disabled={isPending}
            placeholder="Escreva o que está impedindo a tarefa..."
            className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          {blockError && <p className="text-sm text-red-600">{blockError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBlockDialog(false)} disabled={isPending}>Voltar</Button>
            <Button onClick={confirmBlock} disabled={isPending || !blockReason.trim()} className="bg-red-600 hover:bg-red-700">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Bloquear tarefa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Por que essa tarefa está sendo cancelada?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <textarea
            value={cancelReason}
            onChange={(event) => {
              setCancelReason(event.target.value);
              if (cancelError) setCancelError("");
            }}
            rows={4}
            maxLength={2000}
            autoFocus
            disabled={isPending}
            placeholder="Escreva o motivo do cancelamento..."
            className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={isPending}>Voltar</Button>
            <Button onClick={confirmCancellation} disabled={isPending || !cancelReason.trim()} className="bg-orange-600 hover:bg-orange-700">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancelar tarefa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
