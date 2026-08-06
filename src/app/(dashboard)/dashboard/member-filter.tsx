"use client";

import { Users } from "lucide-react";

interface MemberFilterProps {
  members: { id: string; name: string }[];
  selected: string; // "" = eu mesmo · "all" = todos · senão = id do membro
  view: string;
}

// Exceção de visibilidade: cargos elevados podem trocar de "minhas tarefas"
// pra ver/filtrar as tarefas de qualquer membro da empresa (server valida).
export function MemberFilter({ members, selected, view }: MemberFilterProps) {
  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    const params = new URLSearchParams(window.location.search);

    params.set("view", view);
    if (value) params.set("member", value);
    else params.delete("member");

    // Navegação completa intencional: o filtro administrativo precisa sempre
    // buscar um snapshot novo no servidor e descartar caches/estado do kanban.
    window.location.assign(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5 border border-neutral-200 rounded-lg px-2 py-1.5 bg-white">
      <Users className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
      <select
        value={selected}
        onChange={onChange}
        aria-label="Ver tarefas de"
        className="text-xs text-neutral-700 bg-transparent outline-none cursor-pointer max-w-[140px]"
      >
        <option value="">Eu mesmo</option>
        <option value="all">Todos</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    </div>
  );
}
