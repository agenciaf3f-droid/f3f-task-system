"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, FolderKanban } from "lucide-react";
import { StatusBadge, PriorityBadge, PRIORITY_BORDER } from "@/components/tasks/task-badges";
import { updateTaskStatusAction } from "./actions";
import { format, isBefore, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TaskStatus, TaskPriority } from "@prisma/client";

interface TaskRowProps {
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    progress: number;
    dueDate: Date | null;
    assignee: { name: string } | null;
    sector: { name: string; color: string | null } | null;
    project: { name: string } | null;
    _count: { checklistItems: number; comments: number };
  };
}

export function TaskRow({ task }: TaskRowProps) {
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
      <span className={`w-1 h-10 rounded-full shrink-0 ${priorityBar}`} />

      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="shrink-0 text-neutral-300 hover:text-violet-500 transition-colors disabled:opacity-40"
        aria-label={isDone ? "Marcar como pendente" : "Marcar como concluída"}
      >
        {isDone
          ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
          : <Circle className="w-4.5 h-4.5" />
        }
      </button>

      <Link href={`/tarefas/${task.id}`} className="flex-1 flex items-center gap-4 min-w-0">
        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${isDone ? "line-through text-neutral-400" : "text-neutral-800 group-hover:text-neutral-900"}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
            {task.project && (
              <span className="flex items-center gap-1 text-xs font-medium text-violet-500">
                <FolderKanban className="w-3 h-3 shrink-0" />
                {task.project.name}
              </span>
            )}
            {task.sector && (
              <span className="flex items-center gap-1 text-xs text-neutral-400">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: task.sector.color ?? "#d1d5db" }} />
                {task.sector.name}
              </span>
            )}
            {task.assignee && (
              <span className="flex items-center gap-1 text-xs text-neutral-400">
                <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-600 text-[9px] font-bold flex items-center justify-center">
                  {task.assignee.name.charAt(0)}
                </span>
                {task.assignee.name.split(" ")[0]}
              </span>
            )}
            {task._count.checklistItems > 0 && (
              <span className="text-xs text-neutral-400">☑ {task._count.checklistItems}</span>
            )}
            {task._count.comments > 0 && (
              <span className="text-xs text-neutral-400">💬 {task._count.comments}</span>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>

        {/* Due date */}
        {task.dueDate && (
          <span className={`text-xs font-bold shrink-0 w-12 text-right ${
            isOverdue ? "text-red-600" : isDueToday ? "text-amber-600" : "text-neutral-400"
          }`}>
            {format(task.dueDate, "dd/MM", { locale: ptBR })}
          </span>
        )}
      </Link>
    </div>
  );
}
