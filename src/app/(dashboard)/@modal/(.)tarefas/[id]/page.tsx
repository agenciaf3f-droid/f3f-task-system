import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { taskVisibilityFilter } from "@/lib/task-visibility";
import { BriefcaseBusiness, Calendar, Pencil, FolderKanban } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusBadge } from "@/components/tasks/task-badges";
import { TaskActions } from "@/app/(dashboard)/tarefas/[id]/task-actions";
import { MoveTaskButton } from "@/app/(dashboard)/tarefas/[id]/move-task-button";
import { ChecklistSection } from "@/app/(dashboard)/tarefas/[id]/checklist-section";
import { CommentsSection } from "@/app/(dashboard)/tarefas/[id]/comments-section";
import { AttachmentsSection } from "@/app/(dashboard)/tarefas/[id]/attachments-section";
import { AssigneesSection } from "@/app/(dashboard)/tarefas/[id]/assignees-section";
import { DependenciesSection } from "@/app/(dashboard)/tarefas/[id]/dependencies-section";
import { ProgressSlider } from "@/app/(dashboard)/tarefas/[id]/progress-slider";
import { TaskContentTabs } from "@/app/(dashboard)/tarefas/[id]/task-content-tabs";
import { TaskHistorySection } from "@/app/(dashboard)/tarefas/[id]/task-history-section";
import { LinkButton } from "@/components/ui/link-button";
import { Linkify } from "@/components/ui/linkify";
import { ModalClient } from "./modal-client";
import Link from "next/link";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TaskModalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  // Rotas estáticas como /tarefas/nova caem aqui — não renderiza modal, deixa o children mostrar a página real.
  if (!UUID_RE.test(id)) return null;

  const [task, allUsers, activities] = await Promise.all([
    prisma.task.findFirst({
      where: { id, deletedAt: null, AND: taskVisibilityFilter(user) },
      include: {
        assignee: { select: { id: true, name: true } },
        assignees: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        blockedBy: {
          include: { task: { select: { id: true, title: true, status: true } } },
        },
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
        attachments: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { name: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { companyId: user.companyId, isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.activityLog.findMany({
      where: { companyId: user.companyId, resourceType: "task", resourceId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
  ]);

  if (!task) notFound();

  const projectId = sp.projectId || task.projectId;

  // Candidatas para dependências: tarefas do mesmo projeto (ou company se sem projeto), filtradas por visibilidade
  const allTasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      id: { not: id },
      ...(task.projectId ? { projectId: task.projectId } : {}),
      AND: taskVisibilityFilter(user),
    },
    select: { id: true, title: true, status: true },
    orderBy: { title: "asc" },
    take: 100,
  });
  const completedItems = task.checklistItems.filter((i) => i.isDone).length;
  const totalItems = task.checklistItems.length;
  const canEdit =
    user.role === "admin" ||
    user.role === "manager" ||
    task.assigneeId === user.userId ||
    task.createdById === user.userId;
  const displayedAssignees = task.assignees.map((a) => ({
    userId: a.user.id,
    name: a.user.name,
    avatarUrl: a.user.avatarUrl,
  }));
  if (task.assignee && !displayedAssignees.some((a) => a.userId === task.assignee!.id)) {
    displayedAssignees.unshift({
      userId: task.assignee.id,
      name: task.assignee.name,
      avatarUrl: null,
    });
  }

  return (
    <ModalClient matchPathname={`/tarefas/${task.id}`} projectId={projectId || undefined}>
      {/* Header card */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-xl font-semibold text-neutral-900 leading-tight flex-1 pr-8">
            {task.title}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <>
                <LinkButton
                  href={`/tarefas/${task.id}/editar?returnTo=${encodeURIComponent(projectId ? `/projetos/${projectId}` : "/dashboard")}`}
                  variant="outline"
                  size="sm"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Editar
                </LinkButton>
                <MoveTaskButton taskId={task.id} currentProjectId={task.project?.id ?? null} />
              </>
            )}
            <TaskActions
              taskId={task.id}
              currentStatus={task.status}
              currentProgress={task.progress}
              canEdit={canEdit}
            />
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <StatusBadge status={task.status} />
        </div>

        {/* Meta */}
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
          <div className="col-span-2">
            <AssigneesSection
              taskId={task.id}
              initialAssignees={displayedAssignees}
              allUsers={allUsers}
              canEdit={canEdit}
              primaryAssigneeId={task.assigneeId}
            />
          </div>
          {task.dueDate && (
            <div className="flex items-center gap-2 text-neutral-600">
              <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{format(task.dueDate, "dd/MM/yyyy", { locale: ptBR })}</span>
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
            <p className="text-sm text-neutral-700 whitespace-pre-wrap"><Linkify text={task.description} /></p>
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
                <div className="h-full bg-neutral-900 rounded-full transition-all" style={{ width: `${task.progress}%` }} />
              </div>
              <p className="text-xs text-neutral-400">{completedItems} de {totalItems} itens concluídos</p>
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
              users={allUsers}
            />
            <ChecklistSection taskId={task.id} items={task.checklistItems} />
            <DependenciesSection
              taskId={task.id}
              initialBlockedBy={task.blockedBy.map((d) => d.task)}
              allTasks={allTasks}
              canEdit={canEdit}
            />
            <AttachmentsSection taskId={task.id} initialAttachments={task.attachments} canEdit={canEdit} />
          </div>
        }
        history={<TaskHistorySection activities={activities} />}
      />
    </ModalClient>
  );
}
