"use client";

import { useState, useTransition } from "react";
import { Wand2, X, Loader2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyTemplatesToProjectAction } from "../actions";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleTemplate(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleClose() {
    setOpen(false);
    setSelectedIds(new Set());
    setAssigneeId("");
    setStartDate("");
    setError("");
  }

  function handleSubmit() {
    if (selectedIds.size === 0) { setError("Selecione ao menos um template."); return; }
    setError("");

    startTransition(async () => {
      const result = await applyTemplatesToProjectAction(
        projectId,
        Array.from(selectedIds),
        assigneeId,
        startDate,
      );
      if (result?.error) {
        setError(result.error);
      } else {
        handleClose();
      }
    });
  }

  const totalTasks = templates
    .filter((t) => selectedIds.has(t.id))
    .reduce((sum, t) => sum + t._count.templateTasks, 0);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Wand2 className="w-3.5 h-3.5 mr-1.5" />
        Aplicar template
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={handleClose} />
          <div className="fixed right-0 top-0 h-full z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Aplicar templates</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  As tarefas serão criadas neste projeto.
                </p>
              </div>
              <button onClick={handleClose} className="text-neutral-400 hover:text-neutral-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
              {/* Template checklist */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">
                  Templates <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col gap-1">
                  {templates.map((t) => {
                    const checked = selectedIds.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTemplate(t.id)}
                        className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                          checked
                            ? "border-blue-500 bg-blue-50"
                            : "border-neutral-200 hover:border-neutral-300 bg-white"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                          checked ? "bg-blue-600 border-blue-600" : "border-neutral-300"
                        }`}>
                          {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-800 truncate">{t.name}</p>
                          <p className="text-xs text-neutral-400">
                            {t._count.templateTasks} tarefa{t._count.templateTasks !== 1 ? "s" : ""}
                            {t.category ? ` · ${t.category}` : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedIds.size > 0 && (
                  <p className="text-xs text-blue-600 font-medium mt-1">
                    {selectedIds.size} template{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""} · {totalTasks} tarefa{totalTasks !== 1 ? "s" : ""} no total
                  </p>
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
              <Button onClick={handleSubmit} disabled={isPending || selectedIds.size === 0}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Aplicar{selectedIds.size > 1 ? ` ${selectedIds.size} templates` : " template"}
              </Button>
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                Cancelar
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
