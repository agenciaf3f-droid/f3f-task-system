"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createProjectAction } from "../actions";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";

interface Client { id: string; name: string; color: string | null }
interface Template { id: string; name: string; category: string | null; description: string | null; _count: { templateTasks: number } }

export function NewProjectForm({ clients, templates, defaultClientId }: { clients: Client[]; templates: Template[]; defaultClientId?: string }) {
  const [state, action, isPending] = useActionState<{ error?: string }, FormData>(
    createProjectAction,
    {},
  );
  const initialClientId = (defaultClientId && clients.find((c) => c.id === defaultClientId))
    ? defaultClientId
    : (clients[0]?.id ?? "__new__");
  const [clientId, setClientId] = useState(initialClientId);
  const [showNewClient, setShowNewClient] = useState(clients.length === 0);
  const [templateId, setTemplateId] = useState("__none__");
  const [description, setDescription] = useState("");
  const [descriptionTouched, setDescriptionTouched] = useState(false);

  function handleTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setTemplateId(next);
    if (descriptionTouched) return;
    const tpl = templates.find((t) => t.id === next);
    setDescription(tpl?.description?.trim() ?? "");
  }

  function handleClientChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setClientId(val);
    setShowNewClient(val === "__new__");
  }

  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/projetos"
          className="text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900">Novo projeto</h1>
      </div>

      <form action={action} className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientId">
            Cliente <span className="text-red-500">*</span>
          </Label>
          <input type="hidden" name="clientId" value={clientId} />
          <select
            id="clientId"
            value={clientId}
            onChange={handleClientChange}
            disabled={isPending}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="__new__">+ Novo cliente</option>
          </select>
        </div>

        {showNewClient && (
          <div className="flex flex-col gap-1.5 bg-neutral-50 border border-neutral-200 rounded-lg p-4">
            <Label htmlFor="newClientName">
              Nome do novo cliente <span className="text-red-500">*</span>
            </Label>
            <Input
              id="newClientName"
              name="newClientName"
              placeholder="Ex: Mari Eiras, Empresa XYZ..."
              disabled={isPending}
              autoFocus
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">
            Nome do projeto <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            placeholder="Ex: Low-ticket DDX, Lançamento abril..."
            required
            disabled={isPending}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Descrição <span className="text-neutral-400 text-xs font-normal">(opcional)</span></Label>
          <textarea
            id="description"
            name="description"
            placeholder="Detalhes sobre o projeto..."
            rows={3}
            value={description}
            onChange={(e) => { setDescription(e.target.value); setDescriptionTouched(true); }}
            disabled={isPending}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
        </div>

        {templates.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="templateId">
              Template <span className="text-neutral-400 text-xs font-normal">(opcional)</span>
            </Label>
            <input type="hidden" name="templateId" value={templateId} />
            <select
              id="templateId"
              value={templateId}
              onChange={handleTemplateChange}
              disabled={isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="__none__">Sem template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t._count.templateTasks} tarefa{t._count.templateTasks !== 1 ? "s" : ""})
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <p className="text-xs text-neutral-400">
                {selectedTemplate._count.templateTasks} tarefa{selectedTemplate._count.templateTasks !== 1 ? "s" : ""} serão criadas automaticamente
                {selectedTemplate.category ? ` · ${selectedTemplate.category}` : ""}
              </p>
            )}
          </div>
        )}

        {state.error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {state.error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar projeto
          </Button>
          <LinkButton variant="outline" href="/projetos">Cancelar</LinkButton>
        </div>
      </form>
    </div>
  );
}
