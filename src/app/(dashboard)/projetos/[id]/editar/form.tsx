"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateProjectAction } from "../../actions";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import type { ProjectStatus } from "@prisma/client";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  client: { name: string; color: string | null };
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active",    label: "Ativo"     },
  { value: "paused",    label: "Pausado"   },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

export function EditProjectForm({ project }: { project: Project }) {
  const boundAction = updateProjectAction.bind(null, project.id);
  const [state, action, isPending] = useActionState<{ error?: string }, FormData>(
    boundAction,
    {},
  );

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/projetos/${project.id}`}
          className="text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <p className="text-xs text-neutral-400">{project.client.name}</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Editar projeto</h1>
        </div>
      </div>

      <form action={action} className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">
            Nome do projeto <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            defaultValue={project.name}
            required
            disabled={isPending}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Descrição</Label>
          <textarea
            id="description"
            name="description"
            defaultValue={project.description ?? ""}
            rows={3}
            disabled={isPending}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={project.status}
            disabled={isPending}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
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
          <LinkButton variant="outline" href={`/projetos/${project.id}`}>
            Cancelar
          </LinkButton>
        </div>
      </form>
    </div>
  );
}
