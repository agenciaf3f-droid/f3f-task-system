"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Filter } from "lucide-react";
import type { TaskStatus, TaskPriority } from "@prisma/client";

const ALL_STATUSES: TaskStatus[] = [
  "todo", "review", "done",
];
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  review: "Em revisão",
  blocked: "Bloqueado",
  done: "Concluído",
  cancelled: "Cancelado",
};

interface Sector { id: string; name: string }

interface TaskFiltersProps {
  currentStatus?: string;
  currentSectorId?: string;
  currentMine?: string;
  currentPriority?: string;
  sectors: Sector[];
}

export function TaskFilters({
  currentStatus,
  currentSectorId,
  currentMine,
  currentPriority,
  sectors,
}: TaskFiltersProps) {
  const router = useRouter();
  const mineOnly = currentMine === "1";

  function buildHref(key: string, value: string) {
    const sp = new URLSearchParams({
      ...(currentStatus && { status: currentStatus }),
      ...(currentPriority && { priority: currentPriority }),
      ...(currentSectorId && { sectorId: currentSectorId }),
      ...(currentMine && { mine: currentMine }),
      [key]: value,
    });
    return `/tarefas?${sp.toString()}`;
  }

  function clearHref(key: string) {
    const sp = new URLSearchParams({
      ...(currentStatus && key !== "status" && { status: currentStatus }),
      ...(currentPriority && key !== "priority" && { priority: currentPriority }),
      ...(currentSectorId && key !== "sectorId" && { sectorId: currentSectorId }),
      ...(currentMine && key !== "mine" && { mine: currentMine }),
    });
    const q = sp.toString();
    return `/tarefas${q ? `?${q}` : ""}`;
  }

  function handleSectorChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const href = e.target.value
      ? buildHref("sectorId", e.target.value)
      : clearHref("sectorId");
    router.push(href);
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-xs text-neutral-500 flex items-center gap-1">
        <Filter className="w-3.5 h-3.5" />
        Filtros:
      </span>

      <Link
        href={mineOnly ? clearHref("mine") : buildHref("mine", "1")}
        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
          mineOnly
            ? "bg-neutral-900 text-white border-neutral-900"
            : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
        }`}
      >
        Minhas tarefas
      </Link>

      {ALL_STATUSES.map((s) => (
        <Link
          key={s}
          href={currentStatus === s ? clearHref("status") : buildHref("status", s)}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
            currentStatus === s
              ? "bg-neutral-900 text-white border-neutral-900"
              : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
          }`}
        >
          {STATUS_LABELS[s]}
        </Link>
      ))}

      {sectors.length > 0 && (
        <select
          className="text-xs px-3 py-1.5 rounded-full border border-neutral-200 bg-white text-neutral-600 font-medium cursor-pointer"
          value={currentSectorId ?? ""}
          onChange={handleSectorChange}
        >
          <option value="">Todos os setores</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
