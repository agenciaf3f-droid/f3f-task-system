import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma, TaskStatus } from "@prisma/client";
import { Clock, AlertTriangle, TrendingUp, CheckCircle2, Circle, Flame } from "lucide-react";
import { format, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DashboardTaskRow } from "./dashboard-task-row";

async function getDashboardData(userId: string, companyId: string, statusFilter?: string) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  // "Minhas tarefas" = onde sou assignee primário ou multi-assignee.
  // Não inclui creator/watcher pra evitar poluir o dashboard de admins/managers que criam muito.
  const myTasksOR: Prisma.TaskWhereInput = {
    OR: [
      { assigneeId: userId },
      { assignees: { some: { userId } } },
    ],
  };

  const taskWhere: Prisma.TaskWhereInput = {
    companyId,
    deletedAt: null,
    archivedAt: null,
    AND: myTasksOR,
    ...(statusFilter
      ? { status: statusFilter as TaskStatus }
      : { status: { notIn: ["done", "cancelled"] as TaskStatus[] } }),
  };

  const [myTasks, overdueCount, todayCount, completedTodayCount, recentProjects] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      orderBy: [{ dueDate: "asc" }],
      take: 20,
      select: {
        id: true, title: true, status: true, dueDate: true, progress: true,
        sector: { select: { name: true, color: true } },
        project: { select: { name: true, client: { select: { name: true } } } },
      },
    }),
    prisma.task.count({
      where: { companyId, status: { notIn: ["done", "cancelled"] }, dueDate: { lt: todayStart }, deletedAt: null, AND: myTasksOR },
    }),
    prisma.task.count({
      where: { companyId, status: { notIn: ["done", "cancelled"] }, dueDate: { gte: todayStart, lt: todayEnd }, deletedAt: null, AND: myTasksOR },
    }),
    prisma.task.count({
      where: { companyId, status: "done", completedAt: { gte: todayStart }, deletedAt: null, AND: myTasksOR },
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
        tasks: { where: { deletedAt: null, status: { notIn: ["cancelled"] } }, select: { status: true } },
      },
    }),
  ]);

  return { myTasks, overdueCount, todayCount, completedTodayCount, recentProjects };
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

const TASK_FILTERS = [
  { label: "Minhas tarefas", status: undefined },
  { label: "A fazer",        status: "todo" },
  { label: "Em revisão",     status: "review" },
  { label: "Concluído",      status: "done" },
] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const user = await requireAuth();
  const sp = await searchParams;
  const activeStatus = sp?.status;

  const { myTasks, overdueCount, todayCount, completedTodayCount, recentProjects } =
    await getDashboardData(user.userId, user.companyId, activeStatus);

  const inProgressCount = myTasks.filter((t) => t.status === "in_progress").length;

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Tasks */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-neutral-900">Minhas tarefas</h2>
          </div>

          {/* Filtros rápidos */}
          <div className="flex flex-wrap gap-2">
            {TASK_FILTERS.map((f) => {
              const isActive = activeStatus === f.status;
              const href = isActive || f.status === undefined
                ? "/dashboard"
                : `/dashboard?status=${f.status}`;
              return (
                <Link
                  key={f.label}
                  href={href}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    (f.status === undefined && !activeStatus) || isActive
                      ? "bg-neutral-900 text-white border-neutral-900"
                      : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>

          {myTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400 border border-dashed border-neutral-200 rounded-2xl bg-white">
              <CheckCircle2 className="w-10 h-10 mb-3 text-emerald-300" />
              <p className="text-sm font-semibold text-neutral-600">Tudo em dia!</p>
              <p className="text-xs mt-1 text-neutral-400">Nenhuma tarefa pendente. Bom trabalho.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {myTasks.map((task) => (
                <DashboardTaskRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Recent Projects */}
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
                  const total = p.tasks.length;
                  const done = p.tasks.filter((t) => t.status === "done").length;
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
