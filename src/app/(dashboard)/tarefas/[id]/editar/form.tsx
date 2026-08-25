"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateTaskAction } from "../../actions";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { TaskPriority } from "@prisma/client";
import { RecurrencePicker, type RecurrenceRule } from "@/components/tasks/recurrence-picker";
import { ClientPicker } from "@/components/tasks/client-picker";
import { PriorityPicker } from "@/components/tasks/priority-picker";

interface Sector { id: string; name: string }
interface User { id: string; name: string }
interface Client { id: string; name: string }

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  assigneeId: string | null;
  sectorId: string | null;
  clientId: string | null;
  projectId: string | null;
  project: { clientId: string } | null;
  dueDate: Date | null;
  deliveryDate: Date | null;
  recurrenceRule: unknown;
}

export function EditTaskForm({
  task,
  sectors,
  users,
  clients,
  returnTo,
}: {
  task: Task;
  sectors: Sector[];
  users: User[];
  clients: Client[];
  returnTo?: string;
}) {
  const boundAction = updateTaskAction.bind(null, task.id);
  const [state, action, isPending] = useActionState<{ error?: string }, FormData>(
    boundAction,
    {},
  );
  const [clientId, setClientId] = useState(task.clientId ?? task.project?.clientId ?? "");
  const [priority, setPriority] = useState<string>(task.priority);

  const dueDateValue = task.dueDate
    ? format(new Date(task.dueDate), "yyyy-MM-dd")
    : "";

  const deliveryDateValue = task.deliveryDate
    ? format(new Date(task.deliveryDate), "yyyy-MM-dd")
    : "";

  const backHref = returnTo ?? `/tarefas/${task.id}`;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={backHref}
          className="text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900">Editar tarefa</h1>
      </div>

      <form action={action} className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col gap-5">
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">
            Título <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            name="title"
            defaultValue={task.title}
            placeholder="Descreva a tarefa claramente..."
            required
            disabled={isPending}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientId">Cliente</Label>
          <ClientPicker
            id="clientId"
            name="clientId"
            clients={clients}
            value={clientId}
            onValueChange={setClientId}
            disabled={isPending}
          />
          {task.projectId && (
            <p className="text-xs text-neutral-500">
              A tarefa continuará no projeto atual; este campo define o cliente atribuído a ela.
            </p>
          )}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Descrição</Label>
          <textarea
            id="description"
            name="description"
            defaultValue={task.description ?? ""}
            placeholder="Detalhes, contexto, instruções..."
            rows={4}
            disabled={isPending}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
        </div>

        {/* Row: Assignee + Sector */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assigneeId">Responsável</Label>
            <select
              id="assigneeId"
              name="assigneeId"
              defaultValue={task.assigneeId ?? ""}
              disabled={isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Sem responsável</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sectorId">Setor</Label>
            <select
              id="sectorId"
              name="sectorId"
              defaultValue={task.sectorId ?? ""}
              disabled={isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Sem setor</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row: prazos + prioridade */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dueDate">Prazo de conclusão <span className="text-red-500">*</span></Label>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={dueDateValue}
              required
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deliveryDate">Prazo de entrega</Label>
            <Input
              id="deliveryDate"
              name="deliveryDate"
              type="date"
              defaultValue={deliveryDateValue}
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">Prioridade</Label>
            <PriorityPicker
              id="priority"
              name="priority"
              value={priority}
              onValueChange={setPriority}
              disabled={isPending}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Repetição</Label>
          <RecurrencePicker
            disabled={isPending}
            defaultValue={task.recurrenceRule as RecurrenceRule | null}
          />
        </div>

        {state.error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {state.error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar alterações
          </Button>
          <LinkButton variant="outline" href={backHref}>
            Cancelar
          </LinkButton>
        </div>
      </form>
    </div>
  );
}
