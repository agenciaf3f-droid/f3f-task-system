"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createTaskAction } from "../actions";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, AlertCircle, FolderOpen, CheckCircle2 } from "lucide-react";
import { RecurrencePicker } from "@/components/tasks/recurrence-picker";

interface Sector { id: string; name: string }
interface User { id: string; name: string }
interface Project { id: string; name: string; client: { name: string } }

export function NewTaskForm({
  sectors,
  users,
  project,
  keepOpenAfterCreate = false,
}: {
  sectors: Sector[];
  users: User[];
  project: Project | null;
  keepOpenAfterCreate?: boolean;
}) {
  const [state, action, isPending] = useActionState<
    { error?: string; success?: boolean },
    FormData
  >(createTaskAction, {});

  const formRef = useRef<HTMLFormElement>(null);
  const [justCreated, setJustCreated] = useState(false);

  useEffect(() => {
    if (state.success && keepOpenAfterCreate) {
      formRef.current?.reset();
      setJustCreated(true);
      formRef.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
      const t = setTimeout(() => setJustCreated(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state.success, keepOpenAfterCreate]);

  const backHref = project ? `/projetos/${project.id}` : "/tarefas";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref} className="text-neutral-500 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          {project && (
            <p className="text-xs text-neutral-400 flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5" />
              {project.client.name} · {project.name}
            </p>
          )}
          <h1 className="text-2xl font-semibold text-neutral-900">Nova tarefa</h1>
        </div>
      </div>

      <form ref={formRef} action={action} className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col gap-5">
        {/* Hidden projectId */}
        {project && <input type="hidden" name="projectId" value={project.id} />}
        {keepOpenAfterCreate && <input type="hidden" name="keepOpen" value="1" />}

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">
            Título <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            name="title"
            placeholder="Descreva a tarefa claramente..."
            required
            disabled={isPending}
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Descrição</Label>
          <textarea
            id="description"
            name="description"
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

        {/* Row: Priority + Due date */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">Prioridade</Label>
            <select
              id="priority"
              name="priority"
              defaultValue="medium"
              disabled={isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dueDate">Prazo</Label>
            <Input id="dueDate" name="dueDate" type="datetime-local" disabled={isPending} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Repetição</Label>
          <RecurrencePicker disabled={isPending} />
        </div>

        {state.error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {state.error}
          </div>
        )}

        {justCreated && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Tarefa criada. Pronto para a próxima.
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar tarefa
          </Button>
          <LinkButton variant="outline" href={backHref}>
            {keepOpenAfterCreate ? "Fechar" : "Cancelar"}
          </LinkButton>
        </div>
      </form>
    </div>
  );
}
