import { cn } from "@/lib/utils";
import type { TaskStatus, TaskPriority } from "@prisma/client";

const STATUS_CONFIG: Record<TaskStatus, { label: string; className: string }> = {
  todo:        { label: "A fazer",      className: "bg-slate-200 text-slate-800 border-slate-300 font-semibold" },
  in_progress: { label: "Em andamento", className: "bg-blue-200 text-blue-900 border-blue-400 font-semibold" },
  review:      { label: "Em revisão",   className: "bg-blue-200 text-blue-900 border-blue-400 font-semibold" },
  blocked:     { label: "Bloqueado",    className: "bg-orange-200 text-orange-900 border-orange-400 font-semibold" },
  done:        { label: "Concluído",    className: "bg-emerald-200 text-emerald-900 border-emerald-400 font-semibold" },
  cancelled:   { label: "Cancelado",   className: "bg-neutral-200 text-neutral-600 border-neutral-300 line-through font-semibold" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; className: string; dot: string }> = {
  low:    { label: "Baixa",   className: "bg-sky-50 text-sky-600 border-sky-200/80",          dot: "bg-sky-400"    },
  medium: { label: "Média",   className: "bg-amber-50 text-amber-700 border-amber-200/80",    dot: "bg-amber-400"  },
  high:   { label: "Alta",    className: "bg-orange-50 text-orange-700 border-orange-200/80", dot: "bg-orange-500" },
  urgent: { label: "Urgente", className: "bg-red-50 text-red-700 border-red-200/80",          dot: "bg-red-500"    },
};

export const PRIORITY_BORDER: Record<TaskPriority, string> = {
  low:    "bg-sky-400",
  medium: "bg-amber-400",
  high:   "bg-orange-500",
  urgent: "bg-red-500",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", config.className)}>
      {config.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border", config.className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG, PRIORITY_CONFIG };
