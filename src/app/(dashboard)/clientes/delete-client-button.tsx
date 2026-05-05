"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteClientAction } from "../projetos/actions";

export function DeleteClientButton({
  clientId,
  clientName,
  projectCount,
  taskCount,
}: {
  clientId: string;
  clientName: string;
  projectCount: number;
  taskCount: number;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const summary = projectCount === 0
      ? ""
      : `\n\nIsto também excluirá ${projectCount} projeto${projectCount !== 1 ? "s" : ""}` +
        (taskCount > 0 ? ` e ${taskCount} tarefa${taskCount !== 1 ? "s" : ""}` : "") + ".";
    if (!confirm(`Excluir "${clientName}"?${summary}`)) return;
    startTransition(async () => {
      const res = await deleteClientAction(clientId);
      if (res?.error) toast.error(res.error);
      else toast.success("Cliente excluído.");
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      title="Excluir cliente"
      className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
    </button>
  );
}
