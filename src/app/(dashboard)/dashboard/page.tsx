import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma, TaskStatus } from "@prisma/client";
import { Clock, AlertTriangle, TrendingUp, CheckCircle2, Circle, Flame, LayoutList, Kanban } from "lucide-react";
import { format, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KanbanView } from "@/app/(dashboard)/projetos/[id]/kanban-view";
import { DashboardTaskRow } from "./dashboard-task-row";
import { MemberFilter } from "./member-filter";
import { isElevated } from "@/lib/task-visibility";

// Shape rico que o KanbanView espera (assignee, sector, contadores, subtasks).
const boardTaskSelect = {
  id: true, title: true, status: true, priority: true, dueDate: true,
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  sector: { select: { name: true, color: true } },
  project: { select: { name: true, client: { select: { name: true } } } },
  _count: { select: { checklistItems: true, comments: true } },
  subtasks: { where: { deletedAt: null }, select: { id: true, status: true } },
} satisfies Prisma.TaskSelect;

// 3 colunas no board da home (subset das 5 do projeto).
const DASHBOARD_COLUMNS = [
  { id: "todo",        label: "A fazer",            color: "text-neutral-600", bg: "bg-neutral-50" },
  { id: "in_progress", label: "Em andamento",       color: "text-blue-600",    bg: "bg-blue-50"    },
  { id: "done",        label: "Concluído · 7 dias", color: "text-emerald-600", bg: "bg-emerald-50" },
];

async function getDashboardData(userId: string, companyId: string) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);

  // "Minhas tarefas" = onde sou assignee primário ou multi-assignee.
  // Não inclui creator/watcher pra evitar poluir o dashboard de admins/managers que criam muito.
  const myTasksOR: Prisma.TaskWhereInput = {
    OR: [
      { assigneeId: userId },
      { assignees: { some: { userId } } },
    ],
  };

  const [activeMine, doneMine, overdueCount, todayCount, completedTodayCount, inProgressCount, recentProjects] = await Promise.all([
    // Pendentes minhas: todas menos done/cancelled (todo, in_progress, review, blocked).
    // review/blocked ficam sob "Em andamento" no board via statusColumnMap → coerente com os KPIs.
    prisma.task.findMany({
      where: { companyId, deletedAt: null, archivedAt: null, AND: myTasksOR, status: { in: ["todo", "in_progress", "review", "blocked"] as TaskStatus[] } },
      orderBy: [{ dueDate: "asc" }],
      take: 100,
      select: boardTaskSelect,
    }),
    // Board: Concluído — só recentes (7 dias), senão a coluna cresce sem limite
    prisma.task.findMany({
      where: { companyId, deletedAt: null, archivedAt: null, AND: myTasksOR, status: "done", completedAt: { gte: sevenDaysAgo } },
      orderBy: [{ completedAt: "desc" }],
      take: 50,
      select: boardTaskSelect,
    }),
    prisma.task.count({
      where: { companyId, status: { notIn: ["done", "cancelled"] }, dueDate: { lt: todayStart }, deletedAt: null, archivedAt: null, AND: myTasksOR },
    }),
    prisma.task.count({
      where: { companyId, status: { notIn: ["done", "cancelled"] }, dueDate: { gte: todayStart, lt: todayEnd }, deletedAt: null, archivedAt: null, AND: myTasksOR },
    }),
    prisma.task.count({
      where: { companyId, status: "done", completedAt: { gte: todayStart }, deletedAt: null, AND: myTasksOR },
    }),
    // KPI "Em andamento" via count() dedicado (não derivar do array truncado em take:100)
    prisma.task.count({
      where: { companyId, status: "in_progress", deletedAt: null, archivedAt: null, AND: myTasksOR },
    }),
    prisma.project.findMany({
      where: {
        companyId, deletedAt: null, status: "active",
        tasks: { some: { deletedAt: null, ...myTasksOR } },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: {
        id: true, name: true,
        client: { select: { name: true, color: true } },
      },
    }),
  ]);

  const myTasks = [...activeMine, ...doneMine];

  const projectIds = recentProjects.map((p) => p.id);
  const taskAgg = projectIds.length
    ? await prisma.task.groupBy({
        by: ["projectId", "status"],
        where: {
          projectId: { in: projectIds },
          deletedAt: null,
          status: { notIn: ["cancelled"] },
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

  return { myTasks, overdueCount, todayCount, completedTodayCount, inProgressCount, recentProjects, aggByProject };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; member?: string }>;
}) {
  const user = await requireAuth();
  const sp = await searchParams;
  const view = sp?.view === "list" ? "list" : "board";

  // Exceção: cargos elevados (admin/manager/supervisor) podem ver/filtrar as
  // tarefas de qualquer membro da empresa — não só as próprias. Validado no
  // servidor (não confia no query param sozinho); membro comum ignora ?member.
  const canFilterByMember = isElevated(user.role);
  let viewingUser: { id: string; name: string } | null = null;
  let members: { id: string; name: string }[] = [];

  if (canFilterByMember) {
    members = await prisma.user.findMany({
      where: { companyId: user.companyId, isActive: true, deletedAt: null, id: { not: user.userId } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    if (sp?.member && sp.member !== user.userId) {
      const target = members.find((m) => m.id === sp.member);
      if (target) viewingUser = target;
    }
  }

  const viewingUserId = viewingUser?.id ?? user.userId;

  const { myTasks, overdueCount, todayCount, completedTodayCount, inProgressCount, recentProjects, aggByProject } =
    await getDashboardData(viewingUserId, user.companyId);

  const pendingTasks = myTasks.filter((t) => t.status !== "done");

  const stats = [
    {
      label: "Para hoje",
      value: todayCount,
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      label: "Atrasadas",
      value: overdueCount,
      icon: AlertTriangle,
      color: overdueCount > 0 ? "text-red-600" : "text-neutral-500",
      bg: overdueCount > 0 ? "bg-red-50" : "bg-neutral-50",
      border: overdueCount > 0 ? "border-red-100" : "border-neutral-100",
    },
    {
      label: "Em andamento",
      value: inProgressCount,
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    {
      label: "Concluídas hoje",
      value: completedTodayCount,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
            {getGreeting()}, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-neutral-500 mt-1 capitalize">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {overdueCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
            <Flame className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-red-700">{overdueCount} tarefa{overdueCount !== 1 ? "s" : ""} atrasada{overdueCount !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`bg-white rounded-2xl border ${stat.border} p-5 flex flex-col gap-3 shadow-sm`}>
              <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <Icon className={`w-4.5 h-4.5 ${stat.color}`} strokeWidth={2} />
              </div>
              <div>
                <p className="text-3xl font-bold text-neutral-900 leading-none">{stat.value}</p>
                <p className="text-xs text-neutral-500 mt-1.5 font-medium">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Minhas tarefas (toggle lista/board) + Projetos ativos (sidebar direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Minhas tarefas — lista ou board. Board: arraste o card pra mudar status */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-bold text-neutral-900">
              {viewingUser ? `Tarefas de ${viewingUser.name.split(" ")[0]}` : "Minhas tarefas"}
            </h2>
            <div className="flex items-center gap-2">
              {canFilterByMember && (
                <MemberFilter members={members} selected={viewingUser?.id ?? ""} view={view} />
              )}
              <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden">
                <Link
                  href={`/dashboard?view=list${viewingUser ? `&member=${viewingUser.id}` : ""}`}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${view === "list" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}
                  title="Visão lista"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href={`/dashboard?view=board${viewingUser ? `&member=${viewingUser.id}` : ""}`}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${view === "board" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}
                  title="Visão board"
                >
                  <Kanban className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
          {(view === "board" ? myTasks.length === 0 : pendingTasks.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400 border border-dashed border-neutral-200 rounded-2xl bg-white">
              <CheckCircle2 className="w-10 h-10 mb-3 text-emerald-300" />
              <p className="text-sm font-semibold text-neutral-600">Tudo em dia!</p>
              <p className="text-xs mt-1 text-neutral-400">
                {viewingUser ? `${viewingUser.name.split(" ")[0]} não tem tarefas pendentes.` : "Nenhuma tarefa pendente. Bom trabalho."}
              </p>
            </div>
          ) : view === "board" ? (
            <KanbanView
              tasks={myTasks}
              columns={DASHBOARD_COLUMNS}
              statusColumnMap={{ review: "in_progress", blocked: "in_progress" }}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {pendingTasks.map((task) => (
                <DashboardTaskRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>

        {/* Projetos ativos — sidebar direita (single column, como antes) */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-neutral-800">Projetos ativos</h3>
              <Link href="/projetos" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Ver todos</Link>
            </div>
            {recentProjects.length === 0 ? (
              <p className="text-xs text-neutral-400 py-3 text-center">Nenhum projeto ativo</p>
            ) : (
              <div className="flex flex-col gap-3">
                {recentProjects.map((p) => {
                  const agg = aggByProject.get(p.id);
                  const total = agg?.total ?? 0;
                  const done = agg?.done ?? 0;
                  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <Link key={p.id} href={`/projetos/${p.id}`} className="flex flex-col gap-1.5 group">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                          style={{ backgroundColor: p.client.color ?? "#6366f1" }}
                        >
                          {getInitials(p.client.name)}
                        </div>
                        <span className="text-xs font-semibold text-neutral-700 group-hover:text-blue-600 truncate transition-colors">{p.name}</span>
                        <span className="text-xs font-bold text-neutral-500 ml-auto shrink-0">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
