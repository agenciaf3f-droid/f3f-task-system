import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Plus, CheckCircle2, FolderOpen } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import { StatusBadge, PriorityBadge } from "@/components/tasks/task-badges";
import { format, isBefore, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProjectActions } from "./project-actions";
import { ApplyTemplateDialog } from "./apply-template-dialog";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default async function ProjetoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const [project, templates, users] = await Promise.all([
    prisma.project.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, color: true } },
        createdBy: { select: { name: true } },
        tasks: {
          where: { deletedAt: null },
          orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
          include: {
            assignee: { select: { name: true } },
            sector: { select: { name: true, color: true } },
            _count: { select: { checklistItems: true, comments: true } },
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

  const activeTasks = project.tasks.filter((t) => t.status !== "cancelled");
  const doneTasks = activeTasks.filter((t) => t.status === "done");
  const progress = activeTasks.length > 0
    ? Math.round((doneTasks.length / activeTasks.length) * 100)
    : 0;
  const isCompleted = activeTasks.length > 0 && doneTasks.length === activeTasks.length;

  const canManage = user.role === "admin" || user.role === "manager";

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <Link
        href="/projetos"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar aos projetos
      </Link>

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
              <h1 className="text-xl font-semibold text-neutral-900 leading-tight truncate">
                {project.name}
              </h1>
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
              <ApplyTemplateDialog
                projectId={project.id}
                templates={templates}
                users={users}
              />
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
            <span className={`font-bold text-base ${
              isCompleted ? "text-green-600" : progress >= 50 ? "text-blue-600" : "text-neutral-700"
            }`}>
              {progress}%
            </span>
          </div>
          <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCompleted ? "bg-green-500" : progress >= 50 ? "bg-blue-500" : "bg-neutral-400"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            {doneTasks.length} de {activeTasks.length} tarefa{activeTasks.length !== 1 ? "s" : ""} concluída{activeTasks.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-neutral-700 mb-3 uppercase tracking-wide">
          Tarefas do projeto
        </h2>

        {project.tasks.length === 0 ? (
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
          <div className="flex flex-col divide-y divide-neutral-100">
            {project.tasks.filter((t) => t.status !== "cancelled").map((task) => {
              const isOverdue = task.dueDate && isBefore(task.dueDate, new Date()) && task.status !== "done";
              const isDueToday = task.dueDate && isToday(task.dueDate);

              return (
                <Link
                  key={task.id}
                  href={`/tarefas/${task.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50/50 transition-colors duration-200 group"
                >
                  {/* Checkbox indicator */}
                  <div className="w-6 h-6 rounded-md border border-neutral-200 flex items-center justify-center shrink-0 group-hover:border-neutral-300 transition-colors">
                    {task.status === "done" && (
                      <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-normal truncate transition-colors ${
                      task.status === "done"
                        ? "line-through text-neutral-400"
                        : "text-neutral-900 group-hover:text-neutral-950"
                    }`}>
                      {task.title}
                    </p>
                  </div>

                  {/* Meta info - sparse and aligned right */}
                  <div className="flex items-center gap-6 shrink-0">
                    {/* Sector */}
                    {task.sector && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: task.sector.color ?? "#e5e7eb" }}
                        />
                        <span className="text-xs text-neutral-500 hidden sm:inline">
                          {task.sector.name}
                        </span>
                      </div>
                    )}

                    {/* Assignee */}
                    {task.assignee && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-700 text-[11px] font-semibold flex items-center justify-center shrink-0">
                          {task.assignee.name.charAt(0)}
                        </span>
                        <span className="text-xs text-neutral-600 hidden sm:inline max-w-[80px] truncate">
                          {task.assignee.name.split(" ")[0]}
                        </span>
                      </div>
                    )}

                    {/* Priority (just dot) */}
                    <div className="flex items-center">
                      <span className={`w-2 h-2 rounded-full ${
                        task.priority === "urgent" ? "bg-red-500" :
                        task.priority === "high" ? "bg-orange-500" :
                        task.priority === "medium" ? "bg-amber-500" :
                        "bg-neutral-300"
                      }`} />
                    </div>

                    {/* Due date */}
                    {task.dueDate && (
                      <span className={`text-xs whitespace-nowrap transition-colors ${
                        isOverdue ? "text-red-600 font-medium" :
                        isDueToday ? "text-amber-600 font-medium" :
                        "text-neutral-500"
                      }`}>
                        {format(task.dueDate, "dd MMM", { locale: ptBR })}
                      </span>
                    )}

                    {/* Status badge - minimal */}
                    {task.status !== "todo" && (
                      <span className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                        task.status === "done" ? "bg-emerald-50 text-emerald-700" :
                        task.status === "in_progress" ? "bg-blue-50 text-blue-700" :
                        task.status === "review" ? "bg-violet-50 text-violet-700" :
                        task.status === "blocked" ? "bg-orange-50 text-orange-700" :
                        "bg-neutral-100 text-neutral-700"
                      }`}>
                        {task.status === "done" && "Concluído"}
                        {task.status === "in_progress" && "Em andamento"}
                        {task.status === "review" && "Em revisão"}
                        {task.status === "blocked" && "Bloqueado"}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
