"use client";

import { useState, useTransition } from "react";
import { Wand2, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyTemplateToProjectAction } from "../actions";

interface Template {
  id: string;
  name: string;
  category: string | null;
  _count: { templateTasks: number };
}

interface User {
  id: string;
  name: string;
}

interface ApplyTemplateDialogProps {
  projectId: string;
  templates: Template[];
  users: User[];
}

export function ApplyTemplateDialog({ projectId, templates, users }: ApplyTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!templateId) { setError("Selecione um template."); return; }
    setError("");

    startTransition(async () => {
      const result = await applyTemplateToProjectAction(projectId, templateId, assigneeId, startDate);
      if (result?.error) {
        setError(result.error);
      } else {
        setOpen(false);
        setTemplateId("");
        setAssigneeId("");
        setStartDate("");
      }
    });
  }

  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wand2 className="w-3.5 h-3.5 mr-1.5" />
        Aplicar template
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} />
          <div className="fixed right-0 top-0 h-full z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Aplicar template</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  As tarefas do template serão criadas neste projeto.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
              {/* Template select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  Template <span className="text-red-500">*</span>
                </label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="">Selecione um template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t._count.templateTasks} tarefa{t._count.templateTasks !== 1 ? "s" : ""})
                    </option>
                  ))}
                </select>
                {selectedTemplate?.category && (
                  <p className="text-xs text-neutral-400">Categoria: {selectedTemplate.category}</p>
                )}
              </div>

              {/* Assignee */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Responsável padrão</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="">Sem responsável</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              {/* Start date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">Data de início</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
                <p className="text-xs text-neutral-400">
                  Os prazos das tarefas serão calculados a partir desta data.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-neutral-100 flex gap-3">
              <Button onClick={handleSubmit} disabled={isPending || !templateId}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Aplicar template
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancelar
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
