import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BarChart3, TrendingUp, Users, CheckCircle2, AlertCircle, ClockAlert } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { startOfDay } from "date-fns";
import { ReportPeriodFilter } from "./period-filter";
import { completedLate } from "@/lib/task-delay";
import { getReportPeriodRange, parseReportPeriod } from "@/lib/report-period";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireRole(["admin", "manager"]);
  const companyId = user.companyId;
  const sp = await searchParams;
  const period = parseReportPeriod(sp.period);

  const now = new Date();
  const todayStart = startOfDay(now);
  const { start, end, label: periodLabel } = getReportPeriodRange(period, now);
  const createdInPeriod = { gte: start, lte: end };

  // Global stats
  const [
    totalTasks,
    doneTasks,
    completedLateCandidates,
    overdueTasks,
    doneInPeriod,
    createdInPeriodCount,
  ] = await Promise.all([
    prisma.task.count({ where: { companyId, deletedAt: null, createdAt: createdInPeriod, status: { notIn: ["cancelled"] } } }),
    prisma.task.count({ where: { companyId, deletedAt: null, createdAt: createdInPeriod, status: "done" } }),
    prisma.task.findMany({
      where: {
        companyId,
        deletedAt: null,
        parentTaskId: null,
        status: "done",
        dueDate: { not: null },
        completedAt: createdInPeriod,
      },
      select: { dueDate: true, completedAt: true },
    }),
    // A tarefa vence no próprio dia do prazo; só é atrasada a partir do dia seguinte.
    prisma.task.count({ where: { companyId, deletedAt: null, archivedAt: null, dueDate: { lt: todayStart }, status: { notIn: ["done", "cancelled"] } } }),
    prisma.task.count({ where: { companyId, deletedAt: null, createdAt: createdInPeriod, status: "done" } }),
    prisma.task.count({ where: { companyId, deletedAt: null, createdAt: createdInPeriod } }),
  ]);

  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const completedLateTasks = completedLateCandidates.filter(
    (task) => task.dueDate && task.completedAt && completedLate(task.dueDate, task.completedAt),
  ).length;

  // Per-user stats
  const usersWithStats = await prisma.user.findMany({
    where: { companyId, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      assignedTasks: {
        where: { deletedAt: null, createdAt: createdInPeriod, status: { notIn: ["cancelled"] } },
        select: { status: true, dueDate: true },
      },
    },
  });

  const userStats = usersWithStats.map((u) => {
    const tasks = u.assignedTasks;
    const done = tasks.filter((t) => t.status === "done").length;
    const overdue = tasks.filter(
      (t) => t.dueDate && t.dueDate < todayStart && t.status !== "done",
    ).length;
    const active = tasks.filter((t) => !["done", "cancelled"].includes(t.status)).length;
    const rate = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    return { ...u, done, overdue, active, total: tasks.length, rate };
  }).filter((u) => u.total > 0)
    .sort((a, b) => b.done - a.done);

  // Per-sector stats
  const sectorsWithStats = await prisma.sector.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      tasks: {
        where: { deletedAt: null, createdAt: createdInPeriod, status: { notIn: ["cancelled"] } },
        select: { status: true, dueDate: true },
      },
    },
  });

  const sectorStats = sectorsWithStats
    .map((s) => {
      const tasks = s.tasks;
      const done = tasks.filter((t) => t.status === "done").length;
      const active = tasks.filter((t) => !["done", "cancelled"].includes(t.status)).length;
      const overdue = tasks.filter(
        (t) => t.dueDate && t.dueDate < todayStart && t.status !== "done",
      ).length;
      const rate = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
      return { ...s, done, active, overdue, total: tasks.length, rate };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Relatórios</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Visão geral de produtividade e operação
            </p>
          </div>
          <ReportPeriodFilter value={period} />
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card className="border-neutral-200 shadow-none">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Total de tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-neutral-900">{totalTasks}</p>
            <p className="text-xs text-neutral-400 mt-1">{createdInPeriodCount} em {periodLabel.toLowerCase()}</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 shadow-none">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-green-700 uppercase tracking-wide flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />Taxa de conclusão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-800">{completionRate}%</p>
            <p className="text-xs text-green-600 mt-1">{doneTasks} concluídas</p>
          </CardContent>
        </Card>

        <Link
          href={`/relatorios/concluidas-em-atraso?period=${period}`}
          className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Card className="h-full border-amber-200 bg-amber-50 shadow-none transition-all hover:border-amber-300 hover:shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-amber-700">
                <ClockAlert className="h-3.5 w-3.5" />Concluídas em atraso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-800">{completedLateTasks}</p>
              <p className="mt-1 text-xs text-amber-600">Ver tarefas concluídas após o prazo</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/relatorios/atrasadas" className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
        <Card className="border-red-200 bg-red-50 shadow-none h-full transition-all hover:border-red-300 hover:shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-red-600 uppercase tracking-wide flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-700">{overdueTasks}</p>
            <p className="text-xs text-red-500 mt-1">Ver lista de tarefas atrasadas</p>
          </CardContent>
        </Card>
        </Link>

        <Card className="border-neutral-200 shadow-none">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-neutral-500 uppercase tracking-wide flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />{periodLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-neutral-900">{doneInPeriod}</p>
            <p className="text-xs text-neutral-400 mt-1">{createdInPeriodCount} criadas · {doneInPeriod} concluídas</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar global */}
      <Card className="border-neutral-200 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-neutral-900">Progresso geral — {periodLabel.toLowerCase()}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{doneInPeriod} concluídas de {createdInPeriodCount} criadas</span>
            <span className="font-medium">
              {createdInPeriodCount > 0 ? Math.round((doneInPeriod / createdInPeriodCount) * 100) : 0}%
            </span>
          </div>
          <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-900 rounded-full transition-all"
              style={{
                width: `${createdInPeriodCount > 0 ? Math.min(100, Math.round((doneInPeriod / createdInPeriodCount) * 100)) : 0}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Per-user */}
        <Card className="border-neutral-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-neutral-500" />
              Produtividade por colaborador
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userStats.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-4">Nenhum dado</p>
            ) : (
              <div className="flex flex-col gap-4">
                {userStats.map((u) => (
                  <div key={u.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-neutral-800 truncate flex-1">
                        {u.name.split(" ")[0]}
                      </span>
                      <div className="flex items-center gap-3 text-xs shrink-0 ml-2">
                        <span className="text-green-600 font-medium">{u.done} feitas</span>
                        <span className="text-neutral-400">{u.active} ativas</span>
                        {u.overdue > 0 && (
                          <span className="text-red-500">{u.overdue} atrasadas</span>
                        )}
                        <span className="font-semibold text-neutral-700 w-10 text-right">{u.rate}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${u.rate >= 70 ? "bg-green-500" : u.rate >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${u.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-sector */}
        <Card className="border-neutral-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-neutral-500" />
              Produtividade por setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sectorStats.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-4">Nenhum dado</p>
            ) : (
              <div className="flex flex-col gap-4">
                {sectorStats.map((s) => (
                  <div key={s.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.color ?? "#d1d5db" }}
                        />
                        <span className="text-sm font-medium text-neutral-800 truncate">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs shrink-0 ml-2">
                        <span className="text-green-600 font-medium">{s.done} feitas</span>
                        <span className="text-neutral-400">{s.active} ativas</span>
                        {s.overdue > 0 && (
                          <span className="text-red-500">{s.overdue}↑</span>
                        )}
                        <span className="font-semibold text-neutral-700 w-10 text-right">{s.rate}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${s.rate}%`,
                          backgroundColor: s.color ?? "#d1d5db",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
