"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { isBefore, isToday } from "date-fns";
import { TaskCheckbox, TaskInlineAssignee, TaskInlineDueDate } from "./task-inline-edit";

const STATUS_LABELS: Record<string, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  done: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_STYLES: Record<string, string> = {
  todo: "text-neutral-500 bg-neutral-100 border-neutral-200",
  in_progress: "text-blue-600 bg-blue-50 border-blue-200",
  done: "text-emerald-600 bg-emerald-50 border-emerald-200",
  cancelled: "text-neutral-400 bg-neutral-50 border-neutral-200",
};

type Assignee = { id: string; name: string; avatarUrl: string | null } | null;

type Subtask = {
  id: string;
  title: string;
  status: string;
  dueDate: Date | null;
  assignee: Assignee;
};

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  metadata: unknown;
  assignee: Assignee;
  sector: { name: string; color: string | null } | null;
  _count: { checklistItems: number; comments: number };
  subtasks: Subtask[];
};

type UserLite = { id: string; name: string; avatarUrl: string | null };

interface TaskListProps {
  tasks: Task[];
  users: UserLite[];
  projectId: string;
}

export function TaskList({ tasks, users, projectId }: TaskListProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const visible = tasks.filter((t) => t.status !== "cancelled");

  return (
    <>
      <div className="divide-y divide-neutral-100">
        {visible.map((task, idx) => {
          const isOverdue = task.dueDate && isBefore(task.dueDate, new Date()) && task.status !== "done";
          const isDueToday = task.dueDate && isToday(task.dueDate);
          const activeSubtasks = task.subtasks.filter((s) => s.status !== "cancelled");
          const hasSub = activeSubtasks.length > 0;
          const isCollapsed = collapsedIds.has(task.id);

          return (
            <div key={task.id} className="group">
              {/* Main row */}
              <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-neutral-50/60 transition-colors">
                {/* Index */}
                <div className="w-6 shrink-0 text-xs text-neutral-300 font-medium text-center select-none">
                  {idx + 1}
                </div>

                {/* Chevron — retrátil se tiver subtarefas */}
                <button
                  onClick={() => hasSub && toggleCollapse(task.id)}
                  className={`shrink-0 transition-colors ${
                    hasSub
                      ? "text-neutral-400 hover:text-neutral-700 cursor-pointer"
                      : "text-neutral-200 cursor-default pointer-events-none"
                  }`}
                  tabIndex={hasSub ? 0 : -1}
                  aria-label={isCollapsed ? "Expandir subtarefas" : "Recolher subtarefas"}
                >
                  {hasSub && !isCollapsed
                    ? <ChevronDown className="w-4 h-4" />
                    : <ChevronRight className="w-4 h-4" />}
                </button>

                {/* Checkbox */}
                <TaskCheckbox taskId={task.id} isDone={task.status === "done"} />

                {/* Title — clique abre modal via intercepting route */}
                <Link href={`/tarefas/${task.id}?projectId=${projectId}`} className="flex-1 min-w-0 px-1 py-1">
                  <span className={`text-sm font-medium block truncate ${
                    task.status === "done" ? "line-through text-neutral-400" : "text-neutral-800 hover:text-blue-700"
                  } transition-colors`}>
                    {task.title || <span className="text-neutral-300">Sem título</span>}
                  </span>
                </Link>

                {/* Colunas fixas: Responsável | Data | Status */}
                <div className="flex items-center shrink-0">
                  <div className="w-32 flex justify-end">
                    <TaskInlineAssignee taskId={task.id} assignee={task.assignee} users={users} />
                  </div>
                  <div className="w-24 flex justify-end">
                    <TaskInlineDueDate
                      taskId={task.id}
                      dueDate={task.dueDate}
                      isOverdue={!!isOverdue}
                      isDueToday={!!isDueToday}
                    />
                  </div>
                  <div className="w-28 flex justify-end pr-1">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${
                      STATUS_STYLES[task.status] ?? STATUS_STYLES.todo
                    }`}>
                      {STATUS_LABELS[task.status] ?? task.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Subtarefas retráteis */}
              {hasSub && !isCollapsed && (
                <div className="pl-[72px] pr-4 pb-3 pt-1 flex flex-col gap-1.5 border-t border-neutral-50">
                  {activeSubtasks.map((sub) => {
                    const subOverdue = sub.dueDate && isBefore(sub.dueDate, new Date()) && sub.status !== "done";
                    const subToday = sub.dueDate && isToday(sub.dueDate);
                    return (
                      <div key={sub.id} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
                        <TaskCheckbox taskId={sub.id} isDone={sub.status === "done"} />
                        <Link href={`/tarefas/${sub.id}?projectId=${projectId}`} className="flex-1 min-w-0 px-1 py-0.5">
                          <span className={`text-xs block truncate ${
                            sub.status === "done" ? "line-through text-neutral-400" : "text-neutral-700 hover:text-blue-700"
                          } transition-colors`}>
                            {sub.title}
                          </span>
                        </Link>
                        <div className="flex items-center shrink-0">
                          <div className="w-32 flex justify-end">
                            <TaskInlineAssignee taskId={sub.id} assignee={sub.assignee} users={users} />
                          </div>
                          <div className="w-24 flex justify-end">
                            <TaskInlineDueDate
                              taskId={sub.id}
                              dueDate={sub.dueDate}
                              isOverdue={!!subOverdue}
                              isDueToday={!!subToday}
                            />
                          </div>
                          <div className="w-28 flex justify-end pr-1">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${
                              STATUS_STYLES[sub.status] ?? STATUS_STYLES.todo
                            }`}>
                              {STATUS_LABELS[sub.status] ?? sub.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
