"use client";

import { useState, useTransition } from "react";
import { Link2, X, Plus, Loader2, AlertTriangle } from "lucide-react";
import { addDependencyAction, removeDependencyAction } from "../dependency-actions";
import Link from "next/link";

type DepTask = { id: string; title: string; status: string };

const DONE_STATUSES = new Set(["done", "cancelled"]);

export function DependenciesSection({
  taskId,
  initialBlockedBy,
  allTasks,
  canEdit,
}: {
  taskId: string;
  initialBlockedBy: DepTask[];     // tarefas que bloqueiam esta
  allTasks: DepTask[];             // candidatas para adicionar como bloqueadores
  canEdit: boolean;
}) {
  const [blockedBy, setBlockedBy] = useState(initialBlockedBy);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const blockedIds = new Set(blockedBy.map((t) => t.id));
  const available = allTasks.filter((t) => t.id !== taskId && !blockedIds.has(t.id));
  const hasOpenBlockers = blockedBy.some((t) => !DONE_STATUSES.has(t.status));

  function handleAdd(blocker: DepTask) {
    setShowPicker(false);
    setError(null);
    setBlockedBy((prev) => [...prev, blocker]);
    startTransition(async () => {
      const result = await addDependencyAction(taskId, blocker.id);
      if (result.error) {
        setBlockedBy((prev) => prev.filter((t) => t.id !== blocker.id));
        setError(result.error);
      }
    });
  }

  function handleRemove(blockerId: string) {
    setBlockedBy((prev) => prev.filter((t) => t.id !== blockerId));
    startTransition(async () => {
      await removeDependencyAction(taskId, blockerId);
    });
  }

  if (blockedBy.length === 0 && !canEdit) return null;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-medium text-neutral-900">Dependências</h2>
          {hasOpenBlockers && (
            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              Aguardando
            </span>
          )}
        </div>
        {canEdit && available.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowPicker((v) => !v)}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 transition-colors disabled:opacity-40"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Adicionar bloqueador
            </button>
            {showPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-72 max-h-56 overflow-y-auto">
                  {available.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleAdd(t)}
                      className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 truncate transition-colors"
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {blockedBy.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhuma dependência.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {blockedBy.map((t) => {
            const done = DONE_STATUSES.has(t.status);
            return (
              <li key={t.id} className="flex items-center gap-2 group">
                <span className={`w-2 h-2 rounded-full shrink-0 ${done ? "bg-green-400" : "bg-amber-400"}`} />
                <Link
                  href={`/tarefas/${t.id}`}
                  className={`flex-1 text-sm truncate hover:text-blue-600 transition-colors ${
                    done ? "line-through text-neutral-400" : "text-neutral-700"
                  }`}
                >
                  {t.title}
                </Link>
                {canEdit && (
                  <button
                    onClick={() => handleRemove(t.id)}
                    disabled={isPending}
                    className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-600 transition-all disabled:opacity-40"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
