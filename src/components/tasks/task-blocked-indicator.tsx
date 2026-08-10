import { Flag } from "lucide-react";

export function TaskBlockedIndicator({
  showLabel = false,
  className = "",
}: {
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-red-600 ${
        showLabel
          ? "rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold"
          : ""
      } ${className}`}
      title="Tarefa bloqueada"
      aria-label="Tarefa bloqueada"
    >
      <Flag className="h-3.5 w-3.5 fill-current" />
      {showLabel ? "Bloqueada" : null}
    </span>
  );
}
