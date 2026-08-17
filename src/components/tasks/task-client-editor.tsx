"use client";

import { useState, useTransition } from "react";
import { BriefcaseBusiness, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { ClientPicker } from "@/components/tasks/client-picker";
import { updateTaskClientAction } from "@/app/(dashboard)/tarefas/actions";

type Client = { id: string; name: string };

export function TaskClientEditor({
  taskId,
  initialClient,
  clients,
  canEdit,
}: {
  taskId: string;
  initialClient: Client | null;
  clients: Client[];
  canEdit: boolean;
}) {
  const [clientId, setClientId] = useState(initialClient?.id ?? "");
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const selectedClient = clients.find((client) => client.id === clientId);

  function save(nextClientId: string) {
    const previousClientId = clientId;
    setClientId(nextClientId);
    setEditing(false);
    if (nextClientId === previousClientId) return;

    startTransition(async () => {
      const result = await updateTaskClientAction(taskId, nextClientId || null);
      if (result.error) {
        setClientId(previousClientId);
        toast.error(result.error);
      }
    });
  }

  if (editing) {
    return (
      <div className="col-span-2 flex items-center gap-2 text-neutral-600">
        <BriefcaseBusiness className="h-4 w-4 shrink-0 text-neutral-400" />
        <div className="min-w-0 flex-1">
          <ClientPicker
            id={`task-client-${taskId}`}
            name="taskClient"
            clients={clients}
            value={clientId}
            onValueChange={save}
            disabled={isPending}
          />
        </div>
      </div>
    );
  }

  if (!selectedClient) {
    if (!canEdit) return null;
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={isPending}
        className="col-span-2 flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-blue-600 disabled:opacity-50"
      >
        {isPending
          ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />
          : <Plus className="h-4 w-4 shrink-0 text-neutral-400" />}
        Adicionar cliente
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => canEdit && setEditing(true)}
      disabled={!canEdit || isPending}
      title={canEdit ? "Alterar cliente" : undefined}
      className="col-span-2 flex items-center gap-2 text-neutral-600 transition-colors enabled:hover:text-blue-600 disabled:cursor-default"
    >
      {isPending
        ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />
        : <BriefcaseBusiness className="h-4 w-4 shrink-0 text-neutral-400" />}
      <span>Cliente: <span className="font-medium">{selectedClient.name}</span></span>
      {canEdit && !isPending && <Pencil className="h-3 w-3 text-neutral-400" />}
    </button>
  );
}
