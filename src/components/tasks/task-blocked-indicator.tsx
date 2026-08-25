"use client";

import { useState, useTransition, type MouseEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setTaskBlockedAction } from "@/app/(dashboard)/tarefas/actions";

export function TaskBlockedIndicator({
  showLabel = false,
  className = "",
  taskId,
}: {
  showLabel?: boolean;
  className?: string;
  // Com taskId o selo vira botão: um clique desbloqueia a tarefa ali mesmo,
  // sem precisar abrir a tarefa. Sem taskId continua sendo só um selo.
  taskId?: string;
}) {
  const base = `inline-flex shrink-0 items-center gap-1 text-red-600 ${
    showLabel
      ? "rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold"
      : ""
  } ${className}`;

  if (!taskId) {
    return (
      <span className={base} title="Tarefa bloqueada" aria-label="Tarefa bloqueada">
        <Flag className="h-3.5 w-3.5 fill-current" />
        {showLabel ? "Bloqueada" : null}
      </span>
    );
  }

  return <UnblockButton taskId={taskId} showLabel={showLabel} base={base} />;
}

function UnblockButton({
  taskId,
  showLabel,
  base,
}: {
  taskId: string;
  showLabel: boolean;
  base: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [unblocked, setUnblocked] = useState(false);
  const router = useRouter();

  // Bloquear passou a exigir motivo escrito. Aqui só existe o caminho de volta:
  // desbloquear com um clique e, se foi sem querer, restaurar pelo "Desfazer" —
  // e a restauração diz exatamente isso, em vez de inventar uma justificativa.
  function apply(isBlocked: boolean) {
    startTransition(async () => {
      const result = await setTaskBlockedAction(
        taskId,
        isBlocked,
        isBlocked ? "Bloqueio restaurado logo após um desbloqueio acidental." : undefined,
      );
      if (result?.error) {
        setUnblocked(isBlocked);
        toast.error(result.error);
        return;
      }
      setUnblocked(!isBlocked);
      router.refresh();
      if (isBlocked) {
        toast.success("Bloqueio restaurado.");
        return;
      }
      toast.success("Tarefa desbloqueada.", {
        action: { label: "Desfazer", onClick: () => apply(true) },
      });
    });
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // O selo costuma ficar dentro de um Link ou de um card arrastável:
    // o clique tem que morrer aqui, senão navega ou inicia o drag.
    event.preventDefault();
    event.stopPropagation();
    if (isPending) return;
    apply(false);
  }

  if (unblocked) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => event.stopPropagation()}
      disabled={isPending}
      className={`${base} ${showLabel ? "" : "rounded p-0.5"} cursor-pointer transition-colors hover:bg-red-100 hover:text-red-700 disabled:cursor-wait disabled:opacity-60`}
      title="Bloqueada — clique para desbloquear"
      aria-label="Desbloquear tarefa"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Flag className="h-3.5 w-3.5 fill-current" />
      )}
      {showLabel ? "Bloqueada" : null}
    </button>
  );
}
