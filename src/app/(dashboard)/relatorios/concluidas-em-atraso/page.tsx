import Link from "next/link";
import { ArrowLeft, ArrowUpDown, ClockAlert } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReportPeriodRange, parseReportPeriod } from "@/lib/report-period";
import { calendarDaysLate, completedLate, formatDateInBrazil } from "@/lib/task-delay";
import { ReportPeriodFilter } from "../period-filter";

type SortColumn = "title" | "assignee" | "client" | "dueDate" | "completedAt" | "days";
type SortDirection = "asc" | "desc";

const columns: { key: SortColumn; label: string; align?: "right" }[] = [
  { key: "title", label: "Tarefa" },
  { key: "assignee", label: "Responsável" },
  { key: "client", label: "Cliente" },
  { key: "dueDate", label: "Prazo original" },
  { key: "completedAt", label: "Data de conclusão" },
  { key: "days", label: "Dias de atraso", align: "right" },
];

export default async function CompletedLateTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; sort?: string; dir?: string }>;
}) {
  const user = await requireRole(["admin", "manager"]);
  const sp = await searchParams;
  const period = parseReportPeriod(sp.period);
  const sort: SortColumn = columns.some((column) => column.key === sp.sort)
    ? sp.sort as SortColumn
    : "days";
  const dir: SortDirection = sp.dir === "asc" ? "asc" : "desc";
  const { start, end, label: periodLabel } = getReportPeriodRange(period, new Date());

  const tasks = await prisma.task.findMany({
    where: {
      companyId: user.companyId,
      deletedAt: null,
      parentTaskId: null,
      status: "done",
      dueDate: { not: null },
      completedAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      completedAt: true,
      assignee: { select: { name: true } },
      client: { select: { name: true } },
      project: { select: { client: { select: { name: true } } } },
    },
  });

  const rows = tasks
    .filter((task) => task.dueDate && task.completedAt && completedLate(task.dueDate, task.completedAt))
    .map((task) => ({
      ...task,
      assigneeName: task.assignee?.name ?? "Sem responsável",
      clientName: task.client?.name ?? task.project?.client.name ?? "—",
      daysLate: calendarDaysLate(task.dueDate!, task.completedAt!),
    }))
    .sort((a, b) => {
      const aValue = valueForSort(a, sort);
      const bValue = valueForSort(b, sort);
      const result = typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), "pt-BR", { sensitivity: "base" });
      return dir === "asc" ? result : -result;
    });

  function sortHref(column: SortColumn) {
    const nextDir: SortDirection = sort === column && dir === "desc" ? "asc" : "desc";
    return `/relatorios/concluidas-em-atraso?period=${period}&sort=${column}&dir=${nextDir}`;
  }

  return (
    <div className="flex max-w-7xl flex-col gap-6">
      <div>
        <Link
          href={`/relatorios?period=${period}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos relatórios
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <ClockAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900">Tarefas concluídas em atraso</h1>
              <p className="text-sm text-neutral-500">
                {rows.length} tarefa{rows.length !== 1 ? "s" : ""} concluída{rows.length !== 1 ? "s" : ""} após o prazo em {periodLabel.toLowerCase()}.
              </p>
            </div>
          </div>
          <ReportPeriodFilter value={period} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white py-16 text-center text-sm text-neutral-400">
          Nenhuma tarefa foi concluída em atraso neste período.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 text-left text-xs font-semibold text-neutral-500 ${column.align === "right" ? "text-right" : ""}`}
                  >
                    <Link
                      href={sortHref(column.key)}
                      className={`inline-flex items-center gap-1.5 transition-colors hover:text-neutral-900 ${column.align === "right" ? "justify-end" : ""}`}
                    >
                      {column.label}
                      <ArrowUpDown className={`h-3.5 w-3.5 ${sort === column.key ? "text-amber-600" : "text-neutral-300"}`} />
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((task) => (
                <tr key={task.id} className="transition-colors hover:bg-neutral-50">
                  <td className="max-w-[360px] px-4 py-3">
                    <Link href={`/tarefas/${task.id}`} className="line-clamp-2 font-medium text-neutral-900 transition-colors hover:text-blue-600">
                      {task.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{task.assigneeName}</td>
                  <td className="px-4 py-3 text-neutral-600">{task.clientName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{formatDateInBrazil(task.dueDate!)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{formatDateInBrazil(task.completedAt!)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-amber-700">
                    {task.daysLate} dia{task.daysLate !== 1 ? "s" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function valueForSort(
  task: {
    title: string;
    assigneeName: string;
    clientName: string;
    dueDate: Date | null;
    completedAt: Date | null;
    daysLate: number;
  },
  sort: SortColumn,
): string | number {
  switch (sort) {
    case "title": return task.title;
    case "assignee": return task.assigneeName;
    case "client": return task.clientName;
    case "dueDate": return task.dueDate?.getTime() ?? 0;
    case "completedAt": return task.completedAt?.getTime() ?? 0;
    case "days": return task.daysLate;
  }
}
