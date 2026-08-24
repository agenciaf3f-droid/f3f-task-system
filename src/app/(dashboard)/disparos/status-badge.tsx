import type { BroadcastStatus } from "@prisma/client";

const LABELS: Record<BroadcastStatus, { text: string; className: string }> = {
  draft:     { text: "Rascunho",  className: "bg-muted text-muted-foreground" },
  scheduled: { text: "Agendado",  className: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  sending:   { text: "Enviando",  className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  completed: { text: "Concluído", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  canceled:  { text: "Cancelado", className: "bg-muted text-muted-foreground" },
  failed:    { text: "Falhou",    className: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

export function BroadcastStatusBadge({ status }: { status: BroadcastStatus }) {
  const { text, className } = LABELS[status];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {text}
    </span>
  );
}
