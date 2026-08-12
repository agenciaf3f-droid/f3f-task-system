"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Clock, User, CheckSquare, MessageSquare, AlertCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getTaskDetailsAction } from "@/app/(dashboard)/tarefas/actions";
import { TaskBlockedIndicator } from "@/components/tasks/task-blocked-indicator";

type TaskDetails = Awaited<ReturnType<typeof getTaskDetailsAction>> | null;

const STATUS_LABELS: Record<string, string> = {
  todo: "A ser iniciado",
  in_progress: "Em andamento",
  review: "Revisão",
  blocked: "Ajustes",
  done: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_STYLES: Record<string, string> = {
  todo: "bg-neutral-100 text-neutral-600 border-neutral-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  review: "bg-amber-50 text-amber-700 border-amber-200",
  blocked: "bg-rose-50 text-rose-700 border-rose-200",
  done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-orange-50 text-orange-700 border-orange-200",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-neutral-100 text-neutral-500",
  medium: "bg-blue-50 text-blue-600",
  high: "bg-orange-50 text-orange-600",
  urgent: "bg-red-50 text-red-600",
};

interface TaskDrawerProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDrawer({ taskId, onClose }: TaskDrawerProps) {
  const [task, setTask] = useState<TaskDetails>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }
    setLoading(true);
    getTaskDetailsAction(taskId).then((data) => {
      setTask(data);
      setLoading(false);
    });
  }, [taskId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (taskId) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [taskId, onClose]);

  const isOpen = !!taskId;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-screen w-[480px] max-w-full bg-white border-l border-neutral-200 shadow-2xl z-50 flex flex-col transition-transform duration-250 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
          <span className="text-xs text-neutral-400 font-medium uppercase tracking-wide">Detalhes da tarefa</span>
          <div className="flex items-center gap-2">
            {task && (
              <Link
                href={`/tarefas/${task.id}`}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors px-2 py-1 rounded-md hover:bg-neutral-100"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir completa
              </Link>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
            </div>
          )}

          {!loading && task && (
            <div className="px-5 py-5 flex flex-col gap-5">
              {/* Title */}
              <h2 className={`text-lg font-semibold leading-snug ${task.status === "done" ? "line-through text-neutral-400" : "text-neutral-900"}`}>
                {task.title}
              </h2>

              {/* Badges */}
              <div className="flex items-center flex-wrap gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_STYLES[task.status] ?? STATUS_STYLES.todo}`}>
                  {STATUS_LABELS[task.status] ?? task.status}
                </span>
                {task.isBlocked && <TaskBlockedIndicator showLabel />}
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium}`}>
                  {PRIORITY_LABELS[task.priority] ?? task.priority}
                </span>
                {task.project && (
                  <Link
                    href={`/projetos/${task.project.id}`}
                    className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
                  >
                    {task.project.name}
                  </Link>
                )}
              </div>

              {/* Meta */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-neutral-500 w-28 shrink-0">
                    <User className="w-3.5 h-3.5" />
                    Responsável
                  </div>
                  <span className="text-neutral-800 font-medium">
                    {task.assignee?.name ?? <span className="text-neutral-400 font-normal">Não atribuído</span>}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-neutral-500 w-28 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    Prazo
                  </div>
                  <span className="text-neutral-800 font-medium">
                    {task.dueDate
                      ? format(new Date(task.dueDate), "dd 'de' MMMM, yyyy", { locale: ptBR })
                      : <span className="text-neutral-400 font-normal">Sem prazo</span>}
                  </span>
                </div>
              </div>

              {/* Description */}
              {task.description && (
                <div className="pt-1">
                  <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide mb-2">Descrição</p>
                  <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
                </div>
              )}

              {/* Checklist */}
              {task.checklistItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-neutral-400 font-medium uppercase tracking-wide flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5" />
                      Checklist
                    </p>
                    <span className="text-xs text-neutral-400">
                      {task.checklistItems.filter((i) => i.isDone).length}/{task.checklistItems.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {task.checklistItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${item.isDone ? "bg-emerald-500 border-emerald-500" : "border-neutral-300"}`}>
                          {item.isDone && (
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm ${item.isDone ? "line-through text-neutral-400" : "text-neutral-700"}`}>
                          {item.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments count */}
              {task.commentsCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-neutral-500 pt-1 border-t border-neutral-100">
                  <MessageSquare className="w-4 h-4" />
                  {task.commentsCount} comentário{task.commentsCount !== 1 ? "s" : ""}
                  <Link href={`/tarefas/${task.id}#comments`} className="text-xs text-blue-600 hover:underline ml-1">
                    ver todos
                  </Link>
                </div>
              )}
            </div>
          )}

          {!loading && !task && taskId && (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-neutral-400">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">Tarefa não encontrada</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
