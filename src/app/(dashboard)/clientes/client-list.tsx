"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase, FolderKanban, ListTodo, Search } from "lucide-react";
import { EditClientDialog } from "./edit-client-dialog";
import { DeleteClientButton } from "./delete-client-button";
import { UserAvatar } from "@/components/ui/user-avatar";

type ClientItem = {
  id: string;
  name: string;
  color: string | null;
  avatarUrl: string | null;
  description: string | null;
  _count: { projects: number };
  activeTasks: number;
};

export function ClientList({
  clients,
  userRole,
}: {
  clients: ClientItem[];
  userRole: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : clients;

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 border border-dashed border-neutral-200 rounded-2xl bg-white">
        <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
          <Briefcase className="w-6 h-6 text-neutral-400" />
        </div>
        <p className="text-sm font-semibold text-neutral-600">Nenhum cliente cadastrado</p>
        <p className="text-xs text-neutral-400 mt-1">Clique em &quot;Novo cliente&quot; para começar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-neutral-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-neutral-200 rounded-2xl bg-white">
          <p className="text-sm text-neutral-500">Nenhum cliente encontrado para &quot;{query}&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="relative bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:border-neutral-300 hover:shadow-md transition-all flex flex-col"
            >
              <div className="h-1.5 w-full" style={{ backgroundColor: client.color ?? "#6366f1" }} />

              <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                <EditClientDialog client={client} />
                {userRole !== "member" && (
                  <DeleteClientButton
                    clientId={client.id}
                    clientName={client.name}
                    projectCount={client._count.projects}
                    taskCount={client.activeTasks}
                  />
                )}
              </div>

              <Link
                href={`/projetos?clientId=${client.id}`}
                className="p-5 flex flex-col gap-3 flex-1"
              >
                <div className="flex items-center gap-3 pr-16">
                  <UserAvatar
                    name={client.name}
                    src={client.avatarUrl}
                    size={40}
                    bgColor={client.color}
                  />
                  <h3 className="font-bold text-neutral-900 text-sm leading-tight truncate">{client.name}</h3>
                </div>

                <p className="text-xs text-neutral-500 line-clamp-2 min-h-[2.5rem]">
                  {client.description || <span className="text-neutral-300 italic">Sem descrição</span>}
                </p>

                <div className="flex items-center gap-4 text-xs text-neutral-500 mt-auto pt-3 border-t border-neutral-100">
                  <div className="flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{client._count.projects} projeto{client._count.projects !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{client.activeTasks} tarefa{client.activeTasks !== 1 ? "s" : ""} ativa{client.activeTasks !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
