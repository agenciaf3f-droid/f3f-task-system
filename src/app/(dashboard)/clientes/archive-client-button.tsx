"use client";

import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTransition } from "react";
import { archiveClientAction, restoreClientAction } from "../projetos/actions";

export function ArchiveClientButton({
  clientId,
  clientName,
  archived,
}: {
  clientId: string;
  clientName: string;
  archived: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleAction(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const verb = archived ? "restaurar" : "arquivar";
    if (!confirm(`${archived ? "Restaurar" : "Arquivar"} "${clientName}"?`)) return;

    startTransition(async () => {
      const result = archived
        ? await restoreClientAction(clientId)
        : await archiveClientAction(clientId);
      if (result.error) toast.error(result.error);
      else toast.success(archived ? "Cliente restaurado." : "Cliente arquivado. O histórico foi preservado.");
    });
  }

  return (
    <button
      type="button"
      onClick={handleAction}
      disabled={isPending}
      title={archived ? "Restaurar cliente" : "Arquivar cliente"}
      className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
    </button>
  );
}
