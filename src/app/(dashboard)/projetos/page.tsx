import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FolderOpen, Plus, CheckCircle2, TrendingUp } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default async function ProjetosPage() {
  const user = await requireAuth();

  const clients = await prisma.client.findMany({
    where: { companyId: user.companyId, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      projects: {
        where: { companyId: user.companyId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          tasks: {
            where: { deletedAt: null, status: { notIn: ["cancelled"] } },
            select: { status: true },
          },
        },
      },
    },
  });

  const clientsWithStats = clients.map((client) => ({
    ...client,
    projects: client.projects.map((project) => {
      const total = project.tasks.length;
      const done = project.tasks.filter((t) => t.status === "done").length;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      const isCompleted = total > 0 && done === total;
      return { ...project, total, done, progress, isCompleted };
    }),
  }));

  const hasAnyProject = clientsWithStats.some((c) => c.projects.length > 0);
  const totalProjects = clientsWithStats.reduce((acc, c) => acc + c.projects.length, 0);
  const activeProjects = clientsWithStats.reduce(
    (acc, c) => acc + c.projects.filter((p) => p.status === "active").length, 0
  );

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Projetos</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {activeProjects} ativo{activeProjects !== 1 ? "s" : ""} · {totalProjects} total
          </p>
        </div>
        <LinkButton href="/projetos/novo">
          <Plus className="w-4 h-4 mr-2" />
          Novo projeto
        </LinkButton>
      </div>

      {!hasAnyProject ? (
        <div className="flex flex-col items-center justify-center py-24 text-neutral-400 border border-dashed border-neutral-200 rounded-2xl bg-white">
          <FolderOpen className="w-12 h-12 mb-4 text-neutral-300" />
          <p className="text-sm font-semibold text-neutral-600">Nenhum projeto ainda</p>
          <p className="text-xs mt-1 mb-5 text-neutral-400">Crie seu primeiro projeto para começar</p>
          <LinkButton href="/projetos/novo" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Novo projeto
          </LinkButton>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {clientsWithStats.filter((c) => c.projects.length > 0).map((client) => {
            const activeCount = client.projects.filter((p) => p.status === "active").length;
            return (
              <div key={client.id}>
                {/* Client header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                    style={{ backgroundColor: client.color ?? "#6366f1" }}
                  >
                    {getInitials(client.name)}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900">{client.name}</h2>
                    <p className="text-xs text-neutral-400">
                      {activeCount} projeto{activeCount !== 1 ? "s" : ""} ativo{activeCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Project cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {client.projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projetos/${project.id}`}
                      className="bg-white border border-neutral-200 rounded-2xl p-5 hover:border-violet-300 hover:shadow-md transition-all group flex flex-col gap-4"
                    >
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-neutral-900 group-hover:text-violet-700 transition-colors leading-tight truncate">
                            {project.name}
                          </p>
                          <p className="text-xs text-neutral-400 mt-1">
                            {project.done} de {project.total} tarefa{project.total !== 1 ? "s" : ""} concluída{project.total !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {project.isCompleted ? (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              Concluído
                            </span>
                          ) : project.status === "paused" ? (
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Pausado
                            </span>
                          ) : project.status === "active" ? (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                              <TrendingUp className="w-3 h-3" />
                              Ativo
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">Progresso</span>
                          <span className={`text-xs font-bold ${
                            project.isCompleted ? "text-emerald-600" : project.progress >= 50 ? "text-violet-600" : "text-neutral-500"
                          }`}>
                            {project.progress}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              project.isCompleted ? "bg-emerald-500" : project.progress >= 50 ? "bg-violet-500" : "bg-neutral-300"
                            }`}
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
