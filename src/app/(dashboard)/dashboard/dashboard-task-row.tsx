"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { PRIORITY_BORDER, StatusBadge } from "@/components/tasks/task-badges";
import { updateTaskStatusAction } from "@/app/(dashboard)/tarefas/actions";
import { format, isBefore, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TaskStatus, TaskPriority } from "@prisma/client";

interface DashboardTaskRowProps {
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date | null;
    project: { name: string } | null;
    sector: { name: string; color: string | null } | null;
  };
}

export function DashboardTaskRow({ task }: DashboardTaskRowProps) {
  const [isPending, startTransition] = useTransition();
  const [isDone, setIsDone] = useState(task.status === "done");

  const isOverdue = task.dueDate && isBefore(task.dueDate, new Date()) && !isDone;
  const isDueToday = task.dueDate && isToday(task.dueDate);
  const priorityBar = PRIORITY_BORDER[task.priority];

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const nextStatus: TaskStatus = isDone ? "todo" : "done";
    setIsDone(!isDone);
    startTransition(async () => {
      await updateTaskStatusAction(task.id, nextStatus);
    });
  }

  const getBackgroundColor = () => {
    if (isDone) return "bg-emerald-50 border-emerald-200";
    switch (task.status) {
      case "done":
        return "bg-emerald-50 border-emerald-200";
      case "in_progress":
        return "bg-blue-50 border-blue-200";
      case "review":
        return "bg-violet-50 border-violet-200";
      case "blocked":
        return "bg-orange-50 border-orange-200";
      case "cancelled":
        return "bg-neutral-50 border-neutral-200";
      default:
        return "bg-white border-neutral-200";
    }
  };

  return (
    <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 transition-all group ${getBackgroundColor()} hover:shadow-md hover:border-opacity-100 border-opacity-70`}>
      {/* Priority bar */}
      <span className={`w-1 h-9 rounded-full shrink-0 ${priorityBar}`} />

      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="shrink-0 text-neutral-300 hover:text-violet-500 transition-colors disabled:opacity-40"
        aria-label={isDone ? "Marcar como pendente" : "Marcar como concluída"}
      >
        {isDone
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          : <Circle className="w-4 h-4" />
        }
      </button>

      {/* Clickable content */}
      <Link href={`/tarefas/${task.id}`} className="flex-1 flex items-center gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate leading-tight ${isDone ? "line-through text-neutral-400" : "text-neutral-800 group-hover:text-neutral-900"}`}>
            {task.title}
          </p>
          {task.project && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mt-0.5 truncate">
              {task.project.name}
            </p>
          )}
        </div>

        <StatusBadge status={task.status} />

        {task.dueDate && (
          <span className={`text-xs font-bold shrink-0 ${
            isOverdue ? "text-red-600" : isDueToday ? "text-amber-600" : "text-neutral-400"
          }`}>
            {format(task.dueDate, "dd/MM", { locale: ptBR })}
          </span>
        )}
      </Link>
    </div>
  );
}
