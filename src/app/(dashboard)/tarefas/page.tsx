import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plus, CheckSquare } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { TaskRow } from "./task-row";
import type { TaskStatus, TaskPriority } from "@prisma/client";

interface SearchParams {
  status?: string;
  priority?: string;
  sectorId?: string;
  mine?: string;
}

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireAuth();
  const params = await searchParams;

  const statusFilter = params.status as TaskStatus | undefined;
  const priorityFilter = params.priority as TaskPriority | undefined;
  const mineOnly = params.mine === "1";

  const [tasks, sectors] = await Promise.all([
    prisma.task.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        ...(statusFilter ? { status: statusFilter } : { status: { notIn: ["cancelled"] } }),
        ...(priorityFilter && { priority: priorityFilter }),
        ...(params.sectorId && { sectorId: params.sectorId }),
        ...(mineOnly && { assigneeId: user.userId }),
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        assignee: { select: { name: true } },
        sector: { select: { name: true, color: true } },
        project: { select: { name: true } },
        _count: { select: { checklistItems: true, comments: true } },
      },
    }),
    prisma.sector.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">Tarefas</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <LinkButton href="/tarefas/nova">
          <Plus className="w-4 h-4 mr-2" />
          Nova tarefa
        </LinkButton>
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400 border border-dashed border-neutral-200 rounded-2xl bg-white">
          <CheckSquare className="w-10 h-10 mb-3 text-neutral-200" />
          <p className="text-sm font-semibold text-neutral-500">Nenhuma tarefa encontrada</p>
          <p className="text-xs mt-1 text-neutral-400">
            Crie uma nova tarefa ou ajuste os filtros
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
