"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

interface User { id: string; name: string }

const ACTION_OPTIONS = [
  { value: "", label: "Todas as ações" },
  { value: "task.created",        label: "Criou tarefa" },
  { value: "task.updated",        label: "Atualizou tarefa" },
  { value: "task.status_changed", label: "Mudou status" },
  { value: "task.deleted",        label: "Excluiu tarefa" },
  { value: "task.commented",      label: "Comentou" },
  { value: "project.created",     label: "Criou projeto" },
  { value: "template.created",    label: "Criou template" },
  { value: "template.activated",  label: "Ativou template" },
];

const RESOURCE_OPTIONS = [
  { value: "", label: "Todos os recursos" },
  { value: "task",     label: "Tarefas" },
  { value: "project",  label: "Projetos" },
  { value: "template", label: "Templates" },
];

export function HistoricoFilters({ users }: { users: User[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page"); // reset pagination on filter change
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <select
        value={sp.get("userId") ?? ""}
        onChange={(e) => set("userId", e.target.value)}
        className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400"
      >
        <option value="">Todos os usuários</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>

      <select
        value={sp.get("action") ?? ""}
        onChange={(e) => set("action", e.target.value)}
        className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400"
      >
        {ACTION_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={sp.get("resource") ?? ""}
        onChange={(e) => set("resource", e.target.value)}
        className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400"
      >
        {RESOURCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <input
        type="date"
        value={sp.get("from") ?? ""}
        onChange={(e) => set("from", e.target.value)}
        className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        placeholder="De"
      />
      <input
        type="date"
        value={sp.get("to") ?? ""}
        onChange={(e) => set("to", e.target.value)}
        className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        placeholder="Até"
      />

      {(sp.get("userId") || sp.get("action") || sp.get("resource") || sp.get("from") || sp.get("to")) && (
        <button
          onClick={() => router.push(pathname)}
          className="h-9 px-3 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
