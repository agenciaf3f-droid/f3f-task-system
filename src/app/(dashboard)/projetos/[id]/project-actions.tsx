"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProjectStatusAction, deleteProjectAction } from "../actions";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Pencil, Trash2, ChevronDown, Loader2 } from "lucide-react";
import type { ProjectStatus } from "@prisma/client";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active",    label: "Ativo"     },
  { value: "paused",    label: "Pausado"   },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

export function ProjectActions({
  projectId,
  currentStatus,
}: {
  projectId: string;
  currentStatus: ProjectStatus;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleStatus(status: ProjectStatus) {
    setShowMenu(false);
    startTransition(async () => {
      await updateProjectStatusAction(projectId, status);
    });
  }

  function handleDelete() {
    setShowMenu(false);
    if (!confirm("Tem certeza que deseja arquivar este projeto?")) return;
    startTransition(async () => {
      await deleteProjectAction(projectId);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <LinkButton href={`/projetos/${projectId}/editar`} variant="outline" size="sm">
        <Pencil className="w-3.5 h-3.5 mr-1.5" />
        Editar
      </LinkButton>

      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => setShowMenu((v) => !v)}
          className="text-xs"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : null}
          {STATUS_OPTIONS.find((s) => s.value === currentStatus)?.label ?? "Status"}
          <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
        </Button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-36">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatus(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-neutral-50 ${
                    opt.value === currentStatus
                      ? "font-semibold text-neutral-900"
                      : "text-neutral-600"
                  }`}
                >
                  {opt.label}
                  {opt.value === currentStatus && <span className="ml-2 text-neutral-400">✓</span>}
                </button>
              ))}
              <div className="border-t border-neutral-100 mt-1 pt-1">
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Arquivar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
