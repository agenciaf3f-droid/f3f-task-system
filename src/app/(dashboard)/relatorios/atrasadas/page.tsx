import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, ArrowUpDown, CalendarClock } from "lucide-react";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { StatusBadge } from "@/components/tasks/task-badges";

type SortColumn = "title" | "assignee" | "client" | "days";
type SortDirection = "asc" | "desc";

const columns: { key: SortColumn; label: string }[] = [
  { key: "title", label: "Tarefa" },
  { key: "assignee", label: "Responsável" },
  { key: "client", label: "Cliente" },
  { key: "days", label: "Dias em atraso" },
];

export default async function OverdueTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const user = await requireRole(["admin", "manager"]);
  const sp = await searchParams;
  const sort: SortColumn = columns.some((column) => column.key === sp.sort)
    ? sp.sort as SortColumn
    : "days";
  const dir: SortDirection = sp.dir === "asc" ? "asc" : "desc";
  const todayStart = startOfDay(new Date());

  const tasks = await prisma.task.findMany({
    where: {
      companyId: user.companyId,
      deletedAt: null,
      archivedAt: null,
      parentTaskId: null,
      dueDate: { lt: todayStart },
      status: { notIn: ["done", "cancelled"] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      assignee: { select: { name: true } },
      client: { select: { name: true } },
      project: { select: { client: { select: { name: true } } } },
    },
  });

  const rows = tasks.map((task) => ({
    ...task,
    assigneeName: task.assignee?.name ?? "Sem responsável",
    clientName: task.client?.name ?? task.project?.client.name ?? "—",
    daysOverdue: differenceInCalendarDays(todayStart, startOfDay(task.dueDate!)),
  })).sort((a, b) => {
    const aValue = sort === "title" ? a.title : sort === "assignee" ? a.assigneeName : sort === "client" ? a.clientName : a.daysOverdue;
    const bValue = sort === "title" ? b.title : sort === "assignee" ? b.assigneeName : sort === "client" ? b.clientName : b.daysOverdue;
    const result = typeof aValue === "number" && typeof bValue === "number"
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue), "pt-BR", { sensitivity: "base" });
    return dir === "asc" ? result : -result;
  });

  function sortHref(column: SortColumn) {
    const nextDir: SortDirection = sort === column && dir === "desc" ? "asc" : "desc";
    return `/relatorios/atrasadas?sort=${column}&dir=${nextDir}`;
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <Link href="/relatorios" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" />
          Voltar aos relatórios
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Tarefas atrasadas</h1>
            <p className="text-sm text-neutral-500">{rows.length} tarefa{rows.length !== 1 ? "s" : ""} com prazo vencido antes de hoje.</p>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-neutral-200 rounded-2xl py-16 text-center text-sm text-neutral-400">
          Nenhuma tarefa atrasada. Tudo em dia!
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className={`px-4 py-3 text-left text-xs font-semibold text-neutral-500 ${column.key === "days" ? "text-right" : ""}`}>
                    <Link href={sortHref(column.key)} className="inline-flex items-center gap-1.5 hover:text-neutral-900 transition-colors">
                      {column.label}
                      <ArrowUpDown className={`w-3.5 h-3.5 ${sort === column.key ? "text-blue-600" : "text-neutral-300"}`} />
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((task) => (
                <tr key={task.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 max-w-[360px]">
                    <Link href={`/tarefas/${task.id}`} className="font-medium text-neutral-900 hover:text-blue-600 transition-colors line-clamp-1">{task.title}</Link>
                    <div className="mt-1"><StatusBadge status={task.status} /></div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{task.assigneeName}</td>
                  <td className="px-4 py-3 text-neutral-600">{task.clientName}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-red-600">{task.daysOverdue} dia{task.daysOverdue !== 1 ? "s" : ""}</span>
                    <span className="block text-xs text-neutral-400 mt-0.5">prazo: {format(task.dueDate!, "dd/MM/yyyy")}</span>
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
