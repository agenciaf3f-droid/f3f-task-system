"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Hash, Search, TrendingUp, Users } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { Plus } from "lucide-react";

type ClientEntry = {
  id: string;
  name: string;
  color: string | null;
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  doneTasks: number;
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function ProjectClientList({
  clients,
  userRole,
}: {
  clients: ClientEntry[];
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
          <Users className="w-6 h-6 text-neutral-400" />
        </div>
        <p className="text-sm font-semibold text-neutral-600">Nenhum projeto ainda</p>
        <p className="text-xs text-neutral-400 mt-1 mb-5">
          {userRole === "member"
            ? "Você ainda não tem tarefas atribuídas em nenhum projeto."
            : "Crie seu primeiro projeto para começar"}
        </p>
        <LinkButton href="/projetos/novo" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Novo projeto
        </LinkButton>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => {
            const progress = client.totalTasks > 0
              ? Math.round((client.doneTasks / client.totalTasks) * 100)
              : 0;
            return (
              <Link
                key={client.id}
                href={`/projetos?clientId=${client.id}`}
                className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-4 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: client.color ?? "#6366f1" }}
                  >
                    {getInitials(client.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-neutral-900 text-sm leading-tight truncate">
                      {client.name}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {client.activeProjects} projeto{client.activeProjects !== 1 ? "s" : ""} ativo{client.activeProjects !== 1 ? "s" : ""}
                      {client.totalProjects > client.activeProjects && ` · ${client.totalProjects - client.activeProjects} arquivado${client.totalProjects - client.activeProjects !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {client.totalTasks} tarefa{client.totalTasks !== 1 ? "s" : ""}
                  </span>
                  {client.totalTasks > 0 && client.doneTasks === client.totalTasks ? (
                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      Concluído
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                      <TrendingUp className="w-3 h-3" />
                      Ativo
                    </span>
                  )}
                </div>

                {client.totalTasks > 0 && (
                  <div className="flex flex-col gap-1.5 mt-auto pt-2 border-t border-neutral-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400">
                        {client.doneTasks} de {client.totalTasks} tarefas concluídas
                      </span>
                      <span className={`font-bold ${
                        progress === 100 ? "text-emerald-600" : progress >= 50 ? "text-blue-600" : "text-neutral-500"
                      }`}>
                        {progress}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress === 100 ? "bg-emerald-500" : progress >= 50 ? "bg-blue-500" : "bg-neutral-300"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
