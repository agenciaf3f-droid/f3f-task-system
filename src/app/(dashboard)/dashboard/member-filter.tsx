"use client";

import { Users } from "lucide-react";

interface MemberFilterProps {
  members: { id: string; name: string }[];
  selfName: string;
  selected: string; // "" = própria conta · "all" = todos · senão = id do membro
  view: string;
}

// Exceção de visibilidade: cargos elevados podem trocar de "minhas tarefas"
// pra ver/filtrar as tarefas de qualquer membro da empresa (server valida).
export function MemberFilter({ members, selfName, selected, view }: MemberFilterProps) {
  function destinationFor(memberId: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("view", view);
    if (memberId) params.set("member", memberId);
    else params.delete("member");
    return `/dashboard?${params.toString()}`;
  }

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;

    // Navegação completa intencional: o filtro administrativo precisa sempre
    // buscar um snapshot novo no servidor e descartar caches/estado do kanban.
    window.location.assign(destinationFor(value));
  }

  return (
    <div className="flex items-center gap-1.5 border border-neutral-200 rounded-lg p-1 bg-white">
      <Users className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
      <button
        type="button"
        onClick={() => window.location.assign(destinationFor(""))}
        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          selected === "" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
        }`}
      >
        {selfName}
      </button>
      <button
        type="button"
        onClick={() => window.location.assign(destinationFor("all"))}
        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          selected === "all" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
        }`}
      >
        Todos
      </button>
      <select
        value={selected === "all" ? "" : selected}
        onChange={onChange}
        aria-label="Ver tarefas de uma pessoa"
        className="text-xs text-neutral-700 bg-transparent outline-none cursor-pointer max-w-[120px]"
      >
        <option value="" disabled>Por pessoa</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    </div>
  );
}
