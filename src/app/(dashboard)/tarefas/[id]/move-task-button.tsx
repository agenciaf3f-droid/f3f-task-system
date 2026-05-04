"use client";

import { useState, useTransition } from "react";
import { ArrowRightLeft, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchProjectsForMoveAction, moveTaskToProjectAction } from "../actions";

export function MoveTaskButton({
  taskId,
  currentProjectId,
}: {
  taskId: string;
  currentProjectId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (!projects) {
      startTransition(async () => {
        const list = await fetchProjectsForMoveAction();
        setProjects(list);
      });
    }
  }

  function handleMove(projectId: string | null) {
    setOpen(false);
    startTransition(async () => {
      await moveTaskToProjectAction(taskId, projectId);
    });
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={handleOpen} disabled={isPending} className="text-xs">
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />}
        Mover
        <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-56 max-h-64 overflow-y-auto">
            {!projects ? (
              <div className="px-3 py-2 text-sm text-neutral-400">Carregando...</div>
            ) : (
              <>
                <button
                  onClick={() => handleMove(null)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors ${
                    !currentProjectId ? "font-medium text-neutral-900" : "text-neutral-600"
                  }`}
                >
                  Sem projeto
                  {!currentProjectId && <span className="ml-2 text-neutral-400">✓</span>}
                </button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleMove(p.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors ${
                      p.id === currentProjectId ? "font-medium text-neutral-900" : "text-neutral-600"
                    }`}
                  >
                    {p.name}
                    {p.id === currentProjectId && <span className="ml-2 text-neutral-400">✓</span>}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
