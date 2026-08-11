import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { taskVisibilityFilter } from "@/lib/task-visibility";
import { ArrowLeft, BriefcaseBusiness, User, Pencil, FolderKanban } from "lucide-react";
import { StatusBadge } from "@/components/tasks/task-badges";
import { TaskBlockedIndicator } from "@/components/tasks/task-blocked-indicator";
import { TaskActions } from "./task-actions";
import { ChecklistSection } from "./checklist-section";
import { CommentsSection } from "./comments-section";
import { ProgressSlider } from "./progress-slider";
import { LinkButton } from "@/components/ui/link-button";
import { Linkify } from "@/components/ui/linkify";
import { TaskContentTabs } from "./task-content-tabs";
import { TaskHistorySection } from "./task-history-section";
import { TaskDueDateEditor } from "@/components/tasks/task-due-date-editor";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const [task, activities] = await Promise.all([
    prisma.task.findFirst({
    where: { id, deletedAt: null, AND: taskVisibilityFilter(user) },
    include: {
      assignee: { select: { id: true, name: true } },
      sector: { select: { name: true, color: true } },
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
      createdBy: { select: { name: true } },
      checklistItems: { orderBy: { position: "asc" } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      },
    },
    }),
    prisma.activityLog.findMany({
      where: { companyId: user.companyId, resourceType: "task", resourceId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
  ]);

  if (!task) notFound();

  const completedItems = task.checklistItems.filter((i) => i.isDone).length;
  const totalItems = task.checklistItems.length;
  const canEdit = user.role === "admin"
    || user.role === "manager"
    || task.assigneeId === user.userId
    || task.createdById === user.userId;

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <Link
        href={task.projectId ? `/projetos/${task.projectId}` : "/dashboard"}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {task.projectId ? "Voltar ao projeto" : "Voltar ao dashboard"}
      </Link>

      <div className="flex flex-col gap-6">
        {/* Header card */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-xl font-semibold text-neutral-900 leading-tight flex-1">
              {task.title}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit && (
                <LinkButton href={`/tarefas/${task.id}/editar`} variant="outline" size="sm">
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Editar
                </LinkButton>
              )}
              <TaskActions
                taskId={task.id}
                currentStatus={task.status}
                isBlocked={task.isBlocked}
                canEdit={canEdit}
              />
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <StatusBadge status={task.status} />
            {task.isBlocked && <TaskBlockedIndicator showLabel />}
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            {task.project && (
              <div className="flex items-center gap-2 text-neutral-600 col-span-2">
                <FolderKanban className="w-4 h-4 text-neutral-400 shrink-0" />
                <Link href={`/projetos/${task.project.id}`} className="hover:text-blue-600 transition-colors font-medium">
                  {task.project.client
                    ? `${task.project.client.name.split(" ").slice(0, 2).join(" ")} — ${task.project.name}`
                    : task.project.name}
                </Link>
              </div>
            )}
            {task.client && (
              <div className="flex items-center gap-2 text-neutral-600 col-span-2">
                <BriefcaseBusiness className="w-4 h-4 text-neutral-400 shrink-0" />
                <span>Cliente: <span className="font-medium">{task.client.name}</span></span>
              </div>
            )}
            {task.assignee && (
              <div className="flex items-center gap-2 text-neutral-600">
                <User className="w-4 h-4 text-neutral-400 shrink-0" />
                <span>{task.assignee.name}</span>
              </div>
            )}
            <TaskDueDateEditor taskId={task.id} dueDate={task.dueDate} canEdit={canEdit} />
            <div className="flex items-center gap-2 text-neutral-500">
              <Pencil className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>por {task.createdBy.name.split(" ")[0]}</span>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div className="mt-5 pt-5 border-t border-neutral-100">
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">
                <Linkify text={task.description} />
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

        <TaskContentTabs
          details={
            <div className="flex flex-col gap-6">
              <CommentsSection
                taskId={task.id}
                comments={task.comments}
                currentUserName={user.name}
                currentUserId={user.userId}
                canModerate={user.role === "admin" || user.role === "manager"}
              />
              <ChecklistSection taskId={task.id} items={task.checklistItems} />
            </div>
          }
          history={<TaskHistorySection activities={activities} />}
        />
      </div>
    </div>
  );
}
