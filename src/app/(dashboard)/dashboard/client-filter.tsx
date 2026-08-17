"use client";

import { Building2 } from "lucide-react";

interface ClientFilterProps {
  clients: { id: string; name: string }[];
  selected: string;
  view: string;
}

export function ClientFilter({ clients, selected, view }: ClientFilterProps) {
  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(window.location.search);
    const clientId = event.target.value;

    params.set("view", view);
    if (clientId) params.set("client", clientId);
    else params.delete("client");

    // Recarrega o snapshot do servidor e preserva os demais filtros da tela.
    window.location.assign(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2 py-1.5">
      <Building2 className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
      <select
        value={selected}
        onChange={onChange}
        aria-label="Filtrar tarefas por cliente"
        className="max-w-[180px] cursor-pointer bg-transparent text-xs text-neutral-700 outline-none"
      >
        <option value="">Todos os clientes</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>{client.name}</option>
        ))}
      </select>
    </div>
  );
}
