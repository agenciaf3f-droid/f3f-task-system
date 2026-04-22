import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Plus, CheckCircle2, FolderOpen, ArrowUpDown } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { format, isBefore, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProjectActions } from "./project-actions";
import { ApplyTemplateDialog } from "./apply-template-dialog";
import { TaskInlineAssignee, TaskInlineDueDate, TaskCheckbox } from "./task-inline-edit";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function PriorityChip({ priority }: { priority: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    urgent: { label: "Urgente", cls: "bg-red-50 text-red-700 border-red-100" },
    high:   { label: "Alta",    cls: "bg-orange-50 text-orange-700 border-orange-100" },
    medium: { label: "Média",   cls: "bg-blue-50 text-blue-600 border-blue-100" },
    low:    { label: "Baixa",   cls: "bg-neutral-100 text-neutral-500 border-neutral-200" },
  };
  const p = map[priority];
  if (!p) return null;
  return (
    <span className={`hidden sm:inline text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${p.cls}`}>
      {p.label}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "todo") return <span className="text-xs text-neutral-300">A fazer</span>;
  const map: Record<string, string> = {
    done: "bg-emerald-50 text-emerald-700",
    in_progress: "bg-blue-50 text-blue-700",
    review: "bg-violet-50 text-violet-700",
    blocked: "bg-orange-50 text-orange-700",
  };
  const label: Record<string, string> = {
    done: "Concluído",
    in_progress: "Em andamento",
    review: "Em revisão",
    blocked: "Bloqueado",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${map[status] ?? "bg-neutral-100 text-neutral-600"}`}>
      {label[status] ?? status}
    </span>
  );
}

type SortBy = "dueDate" | "assignee" | "default";

export default async function ProjetoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sortBy?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;
  const sortBy = (sp.sortBy as SortBy) ?? "default";

  const [project, templates, users] = await Promise.all([
    prisma.project.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, color: true } },
        createdBy: { select: { name: true } },
        tasks: {
          where: { deletedAt: null, parentTaskId: null },
          orderBy: { createdAt: "asc" },
          include: {
            assignee: { select: { id: true, name: true } },
            sector: { select: { name: true, color: true } },
            _count: { select: { checklistItems: true, comments: true } },
            subtasks: {
              where: { deletedAt: null },
              orderBy: { createdAt: "asc" as const },
              include: {
                assignee: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.template.findMany({
      where: { companyId: user.companyId, isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, _count: { select: { templateTasks: true } } },
    }),
    prisma.user.findMany({
      where: { companyId: user.companyId, isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!project) notFound();

  // Flatten all tasks + subtasks for progress calculation
  const allTasks = project.tasks.flatMap((t) => [t, ...t.subtasks]);
  const activeTasks = allTasks.filter((t) => t.status !== "cancelled");
  const doneTasks = activeTasks.filter((t) => t.status === "done");
  const progress = activeTasks.length > 0
    ? Math.round((doneTasks.length / activeTasks.length) * 100)
    : 0;
  const isCompleted = activeTasks.length > 0 && doneTasks.length === activeTasks.length;
  const canManage = user.role === "admin" || user.role === "manager";

  // Sort tasks in JS to respect templatePosition stored in metadata
  function getTemplatePos(meta: unknown): number {
    if (meta && typeof meta === "object" && "templatePosition" in meta) {
      return (meta as { templatePosition: number }).templatePosition;
    }
    return 9999;
  }

  const sortedTasks = [...project.tasks].sort((a, b) => {
    if (sortBy === "dueDate") {
      const da = a.dueDate ? a.dueDate.getTime() : Infinity;
      const db = b.dueDate ? b.dueDate.getTime() : Infinity;
      if (da !== db) return da - db;
    }
    if (sortBy === "assignee") {
      const na = a.assignee?.name ?? "zzz";
      const nb = b.assignee?.name ?? "zzz";
      if (na !== nb) return na.localeCompare(nb);
    }
    const pa = getTemplatePos(a.metadata);
    const pb = getTemplatePos(b.metadata);
    if (pa !== pb) return pa - pb;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Membros com tarefas no projeto
  const memberMap = new Map<string, { name: string; total: number; done: number }>();
  for (const task of activeTasks) {
    if (!task.assignee) continue;
    const entry = memberMap.get(task.assignee.id) ?? { name: task.assignee.name, total: 0, done: 0 };
    entry.total++;
    if (task.status === "done") entry.done++;
    memberMap.set(task.assignee.id, entry);
  }
  const members = Array.from(memberMap.entries())
    .map(([id, data]) => ({ id, ...data, progress: Math.round((data.done / data.total) * 100) }))
    .sort((a, b) => b.progress - a.progress);

  function sortLink(by: SortBy) {
    return `/projetos/${id}?sortBy=${sortBy === by ? "default" : by}`;
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <Link href="/projetos" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Voltar aos projetos
      </Link>

      {/* Project header */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: project.client.color ?? "#6366f1" }}
            >
              {getInitials(project.client.name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-neutral-400 font-medium">{project.client.name}</p>
              <h1 className="text-xl font-semibold text-neutral-900 leading-tight truncate">{project.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {isCompleted && (
              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Concluído
              </span>
            )}
            {canManage && templates.length > 0 && (
              <ApplyTemplateDialog projectId={project.id} templates={templates} users={users} />
            )}
            {canManage && (
              <ProjectActions projectId={project.id} currentStatus={project.status} />
            )}
            <LinkButton href={`/tarefas/nova?projectId=${project.id}`} size="sm">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nova tarefa
            </LinkButton>
          </div>
        </div>

        {project.description && (
          <p className="text-sm text-neutral-600 mt-4 leading-relaxed">{project.description}</p>
        )}

        <div className="mt-5 pt-5 border-t border-neutral-100">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-neutral-500 font-medium">Progresso do projeto</span>
            <span className={`font-bold text-base ${isCompleted ? "text-green-600" : progress >= 50 ? "text-blue-600" : "text-neutral-700"}`}>
              {progress}%
            </span>
          </div>
          <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isCompleted ? "bg-green-500" : progress >= 50 ? "bg-blue-500" : "bg-neutral-400"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            {doneTasks.length} de {activeTasks.length} tarefa{activeTasks.length !== 1 ? "s" : ""} concluída{activeTasks.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
            Tarefas do projeto
          </h2>
          {activeTasks.length > 0 && (
            <div className="flex items-center gap-1">
              <Link
                href={sortLink("assignee")}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  sortBy === "assignee" ? "bg-neutral-900 text-white border-neutral-900" : "text-neutral-500 border-neutral-200 hover:border-neutral-400"
                }`}
              >
                <ArrowUpDown className="w-3 h-3" />
                Responsável
              </Link>
              <Link
                href={sortLink("dueDate")}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  sortBy === "dueDate" ? "bg-neutral-900 text-white border-neutral-900" : "text-neutral-500 border-neutral-200 hover:border-neutral-400"
                }`}
              >
                <ArrowUpDown className="w-3 h-3" />
                Data
              </Link>
              {sortBy !== "default" && (
                <Link
                  href={`/projetos/${id}`}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-neutral-200 text-neutral-400 hover:border-neutral-400 transition-colors"
                >
                  Padrão
                </Link>
              )}
            </div>
          )}
        </div>

        {sortedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-400 border border-dashed border-neutral-200 rounded-xl">
            <FolderOpen className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhuma tarefa neste projeto</p>
            <p className="text-xs mt-1 mb-5 opacity-70">Adicione tarefas ou aplique um template para começar</p>
            <LinkButton href={`/tarefas/nova?projectId=${project.id}`} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar tarefa
            </LinkButton>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            {sortedTasks.filter((t) => t.status !== "cancelled").map((task, idx) => {
              const isOverdue = task.dueDate && isBefore(task.dueDate, new Date()) && task.status !== "done";
              const isDueToday = task.dueDate && isToday(task.dueDate);
              const activeSubtasks = task.subtasks.filter((s) => s.status !== "cancelled");
              const doneSubtasks = activeSubtasks.filter((s) => s.status === "done");

              return (
                <div key={task.id} className="divide-y divide-neutral-100 border-b border-neutral-100 last:border-b-0">
                  {/* ── Tarefa principal ── */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50/60 transition-colors">
                    <span className="w-5 text-center text-xs font-mono text-neutral-300 shrink-0 select-none">
                      {idx + 1}
                    </span>
                    <TaskCheckbox taskId={task.id} isDone={task.status === "done"} />

                    <Link href={`/tarefas/${task.id}`} className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-snug truncate ${
                        task.status === "done" ? "line-through text-neutral-400" : "text-neutral-900"
                      }`}>
                        {task.title}
                      </p>
                      {task.sector && (
                        <span className="flex items-center gap-1 text-xs text-neutral-400 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.sector.color ?? "#e5e7eb" }} />
                          {task.sector.name}
                        </span>
                      )}
                    </Link>

                    <div className="flex items-center gap-3 shrink-0">
                      {activeSubtasks.length > 0 && (
                        <span className="hidden sm:flex items-center gap-1 text-[11px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-md font-medium">
                          {doneSubtasks.length}/{activeSubtasks.length} sub
                        </span>
                      )}
                      <PriorityChip priority={task.priority} />
                      <div className="w-28 hidden sm:block">
                        <TaskInlineAssignee taskId={task.id} assignee={task.assignee} users={users} />
                      </div>
                      <div className="w-16 hidden sm:block">
                        <TaskInlineDueDate taskId={task.id} dueDate={task.dueDate} isOverdue={!!isOverdue} isDueToday={!!isDueToday} />
                      </div>
                      <div className="w-24">
                        <StatusChip status={task.status} />
                      </div>
                    </div>
                  </div>

                  {/* ── Subtarefas ── */}
                  {activeSubtasks.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-3 pl-12 pr-4 py-2.5 bg-neutral-50/50 hover:bg-neutral-50 transition-colors border-t border-neutral-100">
                      <span className="w-2 h-2 rounded-full bg-neutral-200 shrink-0" />
                      <TaskCheckbox taskId={sub.id} isDone={sub.status === "done"} />
                      <Link href={`/tarefas/${sub.id}`} className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${
                          sub.status === "done" ? "line-through text-neutral-400" : "text-neutral-600"
                        }`}>
                          {sub.title}
                        </p>
                      </Link>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-28 hidden sm:block">
                          <TaskInlineAssignee taskId={sub.id} assignee={sub.assignee} users={users} />
                        </div>
                        <div className="w-24">
                          <StatusChip status={sub.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Membros do projeto */}
      {members.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-neutral-700 mb-3 uppercase tracking-wide">
            Membros do projeto
          </h2>
          <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center shrink-0">
                  {getInitials(member.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-neutral-800">{member.name}</span>
                    <span className={`text-xs font-bold ${member.progress === 100 ? "text-emerald-600" : member.progress >= 50 ? "text-blue-600" : "text-neutral-500"}`}>
                      {member.done}/{member.total} · {member.progress}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${member.progress === 100 ? "bg-emerald-500" : member.progress >= 50 ? "bg-blue-500" : "bg-blue-400"}`}
                      style={{ width: `${member.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
