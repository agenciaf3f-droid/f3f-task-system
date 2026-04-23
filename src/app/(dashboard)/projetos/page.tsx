import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FolderOpen, Plus, CheckCircle2, TrendingUp, Archive, Hash, Pencil, ArrowLeft, Users } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

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

  const canManage = user.role === "admin" || user.role === "manager" || user.role === "supervisor";

  // Supervisor: busca todos os membros dos seus setores
  let sectorUserIds: string[] | null = null;
  if (user.role === "supervisor") {
    const mySectos = await prisma.sectorMember.findMany({
      where: { userId: user.userId },
      select: { sectorId: true },
    });
    const sectorIds = mySectos.map((s) => s.sectorId);
    if (sectorIds.length > 0) {
      const members = await prisma.sectorMember.findMany({
        where: { sectorId: { in: sectorIds } },
        select: { userId: true },
      });
      sectorUserIds = members.map((m) => m.userId);
    } else {
      sectorUserIds = [user.userId];
    }
  }

  const projectWhere = {
    companyId: user.companyId,
    deletedAt: null,
    ...(clientId ? { clientId } : {}),
    ...(user.role === "member" && {
      OR: [
        { tasks: { some: { assigneeId: user.userId, deletedAt: null } } },
        { createdById: user.userId },
      ],
    }),
    ...(user.role === "supervisor" && sectorUserIds && {
      OR: [
        { tasks: { some: { assigneeId: { in: sectorUserIds }, deletedAt: null } } },
        { createdById: user.userId },
      ],
    }),
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
            <LinkButton href="/projetos/novo">
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
            <LinkButton href="/projetos/novo" size="sm">
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
                    className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-4 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Link href={`/projetos/${project.id}`}>
                          <h3 className="font-bold text-neutral-900 text-sm leading-tight hover:text-blue-700 transition-colors">
                            {project.name}
                          </h3>
                        </Link>
                        {project.description && (
                          <p className="text-xs text-neutral-500 mt-1 leading-relaxed line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </div>
                      {canManage && (
                        <LinkButton
                          href={`/projetos/${project.id}/editar`}
                          variant="outline"
                          size="sm"
                          className="shrink-0 h-7 px-2 text-xs"
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Editar
                        </LinkButton>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
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

                    <div className="flex flex-col gap-1.5 mt-auto pt-2 border-t border-neutral-100">
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
  const allProjects = await prisma.project.findMany({
    where: {
      companyId: user.companyId,
      deletedAt: null,
      ...(user.role === "member" && {
        OR: [
          { tasks: { some: { assigneeId: user.userId, deletedAt: null } } },
          { createdById: user.userId },
        ],
      }),
      ...(user.role === "supervisor" && sectorUserIds && {
        OR: [
          { tasks: { some: { assigneeId: { in: sectorUserIds }, deletedAt: null } } },
          { createdById: user.userId },
        ],
      }),
    },
    select: {
      id: true,
      status: true,
      client: { select: { id: true, name: true, color: true } },
      tasks: {
        where: { deletedAt: null, status: { notIn: ["cancelled"] }, parentTaskId: null },
        select: { status: true },
      },
    },
  });

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
    entry.totalTasks += project.tasks.length;
    entry.doneTasks += project.tasks.filter((t) => t.status === "done").length;
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

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed border-neutral-200 rounded-2xl bg-white">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-neutral-400" />
          </div>
          <p className="text-sm font-semibold text-neutral-600">Nenhum projeto ainda</p>
          <p className="text-xs text-neutral-400 mt-1 mb-5">
            {user.role === "member"
              ? "Você ainda não tem tarefas atribuídas em nenhum projeto."
              : "Crie seu primeiro projeto para começar"}
          </p>
          <LinkButton href="/projetos/novo" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Novo projeto
          </LinkButton>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => {
            const progress = client.totalTasks > 0
              ? Math.round((client.doneTasks / client.totalTasks) * 100)
              : 0;
            return (
              <Link
                key={client.id}
                href={`/projetos?clientId=${client.id}`}
                className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-4 hover:border-blue-300 hover:shadow-md transition-all"
              >
                {/* Client header */}
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

                {/* Stats */}
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

                {/* Progress */}
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
