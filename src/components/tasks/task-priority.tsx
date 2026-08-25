import { ChevronDown, ChevronUp, ChevronsUp, Equal, type LucideIcon } from "lucide-react";
import type { TaskPriority } from "@prisma/client";
import { cn } from "@/lib/utils";

// Sinal no padrão do Jira: seta para cima em alta, "igual" em média e seta para
// baixo em baixa. A forma distingue as prioridades mesmo para quem não enxerga
// bem a diferença de cor — a cor só reforça o que o desenho já diz.
const PRIORITY_SIGNAL: Record<TaskPriority, { label: string; icon: LucideIcon; color: string }> = {
  urgent: { label: "Urgente", icon: ChevronsUp,  color: "text-red-600"   },
  high:   { label: "Alta",    icon: ChevronUp,   color: "text-red-500"   },
  medium: { label: "Média",   icon: Equal,       color: "text-amber-500" },
  low:    { label: "Baixa",   icon: ChevronDown, color: "text-sky-500"   },
};

/**
 * Opções oferecidas nos formulários. `urgent` fica de fora de propósito: a
 * prioridade pedida tem três níveis, mas o valor continua no enum para exibir
 * corretamente as tarefas antigas que já foram gravadas com ele.
 */
export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "high",   label: "Alta"  },
  { value: "medium", label: "Média" },
  { value: "low",    label: "Baixa" },
];

export const DEFAULT_PRIORITY: TaskPriority = "medium";

function signalOf(priority: string) {
  return PRIORITY_SIGNAL[priority as TaskPriority] ?? PRIORITY_SIGNAL.medium;
}

/** Rótulo de qualquer prioridade, inclusive as que não estão nas opções (urgent). */
export function priorityLabelOf(priority: string) {
  return signalOf(priority).label;
}

/** Só o sinal — é o que aparece no card do board, onde não sobra espaço. */
export function PriorityIcon({ priority, className }: { priority: string; className?: string }) {
  const signal = signalOf(priority);
  const Icon = signal.icon;
  return (
    <Icon
      role="img"
      aria-label={`Prioridade: ${signal.label}`}
      className={cn("w-3.5 h-3.5 shrink-0", signal.color, className)}
    />
  );
}

/** Sinal + rótulo — é o que aparece ao abrir a tarefa. */
export function PriorityLabel({ priority, className }: { priority: string; className?: string }) {
  const signal = signalOf(priority);
  const Icon = signal.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", signal.color, className)}>
      <Icon aria-hidden className="w-3.5 h-3.5 shrink-0" />
      {signal.label}
    </span>
  );
}
