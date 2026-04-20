import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Calendar, User, Building2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusBadge, PriorityBadge } from "@/components/tasks/task-badges";
import { TaskActions } from "./task-actions";
import { ChecklistSection } from "./checklist-section";
import { CommentsSection } from "./comments-section";
import { ProgressSlider } from "./progress-slider";
import { LinkButton } from "@/components/ui/link-button";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const task = await prisma.task.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    include: {
      assignee: { select: { id: true, name: true } },
      sector: { select: { name: true, color: true } },
      createdBy: { select: { name: true } },
      checklistItems: { orderBy: { position: "asc" } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!task) notFound();

  const completedItems = task.checklistItems.filter((i) => i.isDone).length;
  const totalItems = task.checklistItems.length;

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <Link
        href="/tarefas"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar às tarefas
      </Link>

      <div className="flex flex-col gap-6">
        {/* Header card */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-xl font-semibold text-neutral-900 leading-tight flex-1">
              {task.title}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              {(user.role === "admin" || user.role === "manager" || task.assigneeId === user.userId || task.createdById === user.userId) && (
                <LinkButton href={`/tarefas/${task.id}/editar`} variant="outline" size="sm">
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Editar
                </LinkButton>
              )}
              <TaskActions
                taskId={task.id}
                currentStatus={task.status}
                currentProgress={task.progress}
                canEdit={
                  user.role === "admin" ||
                  user.role === "manager" ||
                  task.assigneeId === user.userId ||
                  task.createdById === user.userId
                }
              />
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            {task.assignee && (
              <div className="flex items-center gap-2 text-neutral-600">
                <User className="w-4 h-4 text-neutral-400 shrink-0" />
                <span>{task.assignee.name}</span>
              </div>
            )}
            {task.sector && (
              <div className="flex items-center gap-2 text-neutral-600">
                <Building2 className="w-4 h-4 text-neutral-400 shrink-0" />
                <span>{task.sector.name}</span>
              </div>
            )}
            {task.dueDate && (
              <div className="flex items-center gap-2 text-neutral-600">
                <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
                <span>
                  {format(task.dueDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-neutral-500">
              <Pencil className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>por {task.createdBy.name.split(" ")[0]}</span>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div className="mt-5 pt-5 border-t border-neutral-100">
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Progress */}
          <div className="mt-5 pt-5 border-t border-neutral-100">
            {totalItems > 0 ? (
              <>
                <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
                  <span>Progresso (checklist)</span>
                  <span className="font-medium">{task.progress}%</span>
                </div>
                <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-neutral-900 rounded-full transition-all"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-400">
                  {completedItems} de {totalItems} itens concluídos
                </p>
              </>
            ) : (
              <ProgressSlider taskId={task.id} initialProgress={task.progress} />
            )}
          </div>
        </div>

        {/* Checklist */}
        <ChecklistSection
          taskId={task.id}
          items={task.checklistItems}
        />

        {/* Comments */}
        <CommentsSection
          taskId={task.id}
          comments={task.comments}
          currentUserName={user.name}
        />
      </div>
    </div>
  );
}
