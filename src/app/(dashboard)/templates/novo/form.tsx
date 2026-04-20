"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { createTemplateAction } from "../actions";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { TemplateTasksEditor, type TaskRow } from "../template-tasks-editor";

interface Sector { id: string; name: string }
interface User { id: string; name: string }

export function NewTemplateForm({ sectors, users }: { sectors: Sector[]; users: User[] }) {
  const [state, action, isPending] = useActionState<{ error?: string }, FormData>(
    createTemplateAction,
    {},
  );
  const [tasks, setTasks] = useState<TaskRow[]>([
    { id: crypto.randomUUID(), title: "", days: "", priority: "medium", assigneeId: "", subtasks: [] },
  ]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/templates" className="text-neutral-500 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900">Novo template</h1>
      </div>

      <form action={action} className="flex flex-col gap-6">
        {/* Template info */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-neutral-700">Informações do template</h2>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" placeholder="Ex: Onboarding de cliente" required disabled={isPending} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" name="description" placeholder="Para que serve este template?" disabled={isPending} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Categoria</Label>
              <Input id="category" name="category" placeholder="Ex: Comercial, Ops..." disabled={isPending} />
            </div>
            {sectors.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sectorId">Setor</Label>
                <select
                  id="sectorId"
                  name="sectorId"
                  disabled={isPending}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Todos os setores</option>
                  {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        <TemplateTasksEditor tasks={tasks} setTasks={setTasks} users={users} isPending={isPending} />

        {state.error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {state.error}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar template
          </Button>
          <LinkButton variant="outline" href="/templates">Cancelar</LinkButton>
        </div>
      </form>
    </div>
  );
}
