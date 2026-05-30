import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectVisibilityFilter } from "@/lib/task-visibility";
import { FolderOpen, Plus, CheckCircle2, TrendingUp, Archive, Hash, Pencil, ArrowLeft } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { ProjectClientList } from "./project-client-list";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default async function ProjetosPage({
  searchParams,
}: {
  searchParams?: Promise<{ clientId?: string }>;
}) {
  const user = await requireAuth();
  const sp = await searchParams;
  const clientId = sp?.clientId;

  const projectWhere = {
    deletedAt: null,
    ...(clientId ? { clientId } : {}),
    AND: projectVisibilityFilter(user),
  };

  // —— VISÃO DE PROJETOS DE UM CLIENTE ESPECÍFICO ——
  if (clientId) {
    const [client, projects] = await Promise.all([
      prisma.client.findFirst({
        where: { id: clientId, companyId: user.companyId, deletedAt: null },
        select: { id: true, name: true, color: true },
      }),
      prisma.project.findMany({
        where: projectWhere,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { id: true, name: true, color: true } },
          tasks: {
            where: { deletedAt: null, status: { notIn: ["cancelled"] }, parentTaskId: null },
            select: { status: true },
          },
        },
      }),
    ]);

    if (!client) {
      return (
        <div className="flex flex-col gap-8">
          <p className="text-neutral-500">Cliente não encontrado.</p>
        </div>
      );
    }

    const projectsWithStats = projects.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "done").length;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      const isCompleted = total > 0 && done === total;
      return { ...p, total, done, progress, isCompleted };
    });

    const active = projectsWithStats.filter((p) => p.status !== "archived" && p.status !== "cancelled");
    const archived = projectsWithStats.filter((p) => p.status === "archived");

    return (
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div>
          <Link
            href="/projetos"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Todos os clientes
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: client.color ?? "#6366f1" }}
              >
                {getInitials(client.name)}
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">{client.name}</h1>
                <p className="text-sm text-neutral-500 mt-0.5">
                  {active.length} projeto{active.length !== 1 ? "s" : ""} ativo{active.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <LinkButton href={`/projetos/novo?clientId=${client.id}`}>
              <Plus className="w-4 h-4 mr-2" />
              Novo projeto
            </LinkButton>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-neutral-200 rounded-2xl bg-white">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
              <FolderOpen className="w-6 h-6 text-neutral-400" />
            </div>
            <p className="text-sm font-semibold text-neutral-600">Nenhum projeto para este cliente</p>
            <p className="text-xs text-neutral-400 mt-1 mb-5">Crie o primeiro projeto para {client.name}</p>
            <LinkButton href={`/projetos/novo?clientId=${client.id}`} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Novo projeto
            </LinkButton>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((project) => (
                  <div
                    key={project.id}
                    className="relative bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-4 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <Link
                      href={`/projetos/${project.id}`}
                      className="absolute inset-0 z-0 rounded-2xl"
                      aria-label={`Abrir projeto ${project.name}`}
                    />
                    <div className="relative z-10 flex items-start justify-between gap-2 pointer-events-none">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-neutral-900 text-sm leading-tight">
                          {project.name}
                        </h3>
                        {project.description && (
                          <p className="text-xs text-neutral-500 mt-1 leading-relaxed line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <LinkButton
                        href={`/projetos/${project.id}/editar`}
                        variant="outline"
                        size="sm"
                        className="shrink-0 h-7 px-2 text-xs pointer-events-auto"
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Editar
                      </LinkButton>
                    </div>

                    <div className="relative z-10 flex items-center gap-3 text-xs text-neutral-500 flex-wrap pointer-events-none">
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {project.total} tarefa{project.total !== 1 ? "s" : ""}
                      </span>
                      {project.isCompleted ? (
                        <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Concluído
                        </span>
                      ) : project.status === "paused" ? (
                        <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-medium">
                          Pausado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
                          <TrendingUp className="w-3 h-3" />
                          Ativo
                        </span>
                      )}
                    </div>

                    <div className="relative z-10 flex flex-col gap-1.5 mt-auto pt-2 border-t border-neutral-100 pointer-events-none">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">
                          {project.done} de {project.total} concluída{project.total !== 1 ? "s" : ""}
                        </span>
                        <span className={`font-bold ${
                          project.isCompleted ? "text-emerald-600" : project.progress >= 50 ? "text-blue-600" : "text-neutral-500"
                        }`}>
                          {project.progress}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            project.isCompleted ? "bg-emerald-500" : project.progress >= 50 ? "bg-blue-500" : "bg-neutral-300"
                          }`}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {archived.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-neutral-400 mb-3 uppercase tracking-wide">
                  Arquivados ({archived.length})
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {archived.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projetos/${project.id}`}
                      className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 flex items-center justify-between gap-3 opacity-70 hover:opacity-100 hover:border-neutral-300 transition-all"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-600 truncate">{project.name}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {project.total} tarefa{project.total !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-full shrink-0">
                        <Archive className="w-3 h-3" />
                        Arquivado
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // —— VISÃO DE CLIENTES (padrão) ——
  // admin/manager/supervisor: todos os projetos da company.
  // member: projetos onde tem relação (assignee/multi/criador/watcher) com alguma task, ou criou o projeto.
  const allProjects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      AND: projectVisibilityFilter(user),
    },
    select: {
      id: true,
      status: true,
      client: { select: { id: true, name: true, color: true } },
    },
  });

  const projectIds = allProjects.map((p) => p.id);
  const taskAgg = projectIds.length
    ? await prisma.task.groupBy({
        by: ["projectId", "status"],
        where: {
          projectId: { in: projectIds },
          deletedAt: null,
          status: { notIn: ["cancelled"] },
          parentTaskId: null,
        },
        _count: true,
      })
    : [];
  const aggByProject = new Map<string, { total: number; done: number }>();
  for (const row of taskAgg) {
    if (!row.projectId) continue;
    const entry = aggByProject.get(row.projectId) ?? { total: 0, done: 0 };
    entry.total += row._count;
    if (row.status === "done") entry.done += row._count;
    aggByProject.set(row.projectId, entry);
  }

  // Agrupar por cliente
  const clientMap = new Map<string, {
    id: string; name: string; color: string | null;
    totalProjects: number; activeProjects: number;
    totalTasks: number; doneTasks: number;
  }>();

  for (const project of allProjects) {
    const c = project.client;
    if (!clientMap.has(c.id)) {
      clientMap.set(c.id, {
        id: c.id, name: c.name, color: c.color,
        totalProjects: 0, activeProjects: 0,
        totalTasks: 0, doneTasks: 0,
      });
    }
    const entry = clientMap.get(c.id)!;
    entry.totalProjects++;
    if (project.status !== "archived" && project.status !== "cancelled") entry.activeProjects++;
    const agg = aggByProject.get(project.id);
    entry.totalTasks += agg?.total ?? 0;
    entry.doneTasks += agg?.done ?? 0;
  }

  const clients = Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">Projetos</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <LinkButton href="/projetos/novo">
          <Plus className="w-4 h-4 mr-2" />
          Novo projeto
        </LinkButton>
      </div>

      <ProjectClientList clients={clients} userRole={user.role} />
    </div>
  );
}
