"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { dispatchWebhook } from "@/lib/webhook";
import type { TaskStatus, TaskPriority } from "@prisma/client";
import { computeNextOccurrence, parseRecurrenceRuleFromDb } from "@/lib/recurrence";
import { taskVisibilityFilter, projectVisibilityFilter } from "@/lib/task-visibility";

// datetime-local já vem com hora; date-only ("yyyy-MM-dd") seria parseado como UTC midnight
// e mostraria o dia anterior em fusos negativos. Forçamos meio-dia local nesse caso.
function parseDateInput(s: string | null | undefined): Date | null {
  if (!s) return null;
  return new Date(s.includes("T") ? s : s + "T12:00:00");
}

const recurrenceRuleSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(999),
  byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
  monthDay: z.number().int().min(1).max(31).optional(),
});

function parseRecurrenceRuleFromForm(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = recurrenceRuleSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Campos removidos da UI (sectorId, priority) podem vir como null no FormData.
// Pré-processa null → "" pra casar com .or(z.literal("")).
const optStr = z.preprocess(
  (v) => (v == null ? "" : v),
  z.string(),
);
const optUuid = z.preprocess(
  (v) => (v == null ? "" : v),
  z.string().uuid().or(z.literal("")),
);

const taskSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(500),
  description: optStr,
  assigneeId: optUuid,
  sectorId: optUuid,
  projectId: optUuid,
  priority: optStr,
  dueDate: optStr,
});

export async function createTaskAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();

  // Quando keepOpen=1 (modal "criar várias"), retornamos { success } em vez de redirect
  const keepOpen = formData.get("keepOpen") === "1";

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    assigneeId: formData.get("assigneeId"),
    sectorId: formData.get("sectorId"),
    projectId: formData.get("projectId"),
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { title, description, priority, assigneeId, sectorId, projectId, dueDate } = parsed.data;
  const safePriority: TaskPriority = (priority || "medium") as TaskPriority;

  const recurrenceRule = parseRecurrenceRuleFromForm(formData.get("recurrenceRule"));

  const task = await prisma.task.create({
    data: {
      companyId: user.companyId,
      title,
      description: description || null,
      priority: safePriority,
      assigneeId: assigneeId || null,
      sectorId: sectorId || null,
      projectId: projectId || null,
      createdById: user.userId,
      dueDate: parseDateInput(dueDate),
      recurrenceRule: recurrenceRule ?? undefined,
    },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.created",
    resourceType: "task",
    resourceId: task.id,
    newValue: { title, priority, assigneeId },
  });

  if (assigneeId && assigneeId !== user.userId) {
    const [assignee, project] = await Promise.all([
      prisma.user.findUnique({ where: { id: assigneeId }, select: { name: true, email: true } }),
      projectId ? prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }) : null,
    ]);
    const webhookPayload = {
      taskId: task.id,
      taskTitle: title,
      priority,
      assigneeName: assignee?.name,
      assigneeEmail: assignee?.email,
      projectName: project?.name ?? null,
      dueDate: dueDate || null,
      createdBy: user.name,
    };
    dispatchWebhook(user.companyId, "task.assigned", webhookPayload);
  }

  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projetos/${projectId}`);

  if (keepOpen) return { success: true };

  if (projectId) redirect(`/projetos/${projectId}`);
  redirect("/dashboard");
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus) {
  const user = await requireAuth();

  const old = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { status: true, assigneeId: true, title: true, projectId: true, sectorId: true, dueDate: true, recurrenceRule: true, description: true, priority: true, createdById: true },
  });
  if (!old) return;

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: {
      status,
      completedAt: status === "done" ? new Date() : null,
      // Sincroniza progress com status: done=100%, todo=0%, demais (in_progress/cancelled): mantém.
      ...(status === "done" ? { progress: 100 } : {}),
      ...(status === "todo" ? { progress: 0 } : {}),
    },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.status_changed",
    resourceType: "task",
    resourceId: taskId,
    oldValue: { status: old.status },
    newValue: { status },
  });

  if (status === "done") {
    dispatchWebhook(user.companyId, "task.completed", {
      taskId,
      taskTitle: old.title,
      completedBy: user.name,
    });

    // Cria próxima ocorrência se tarefa é recorrente
    const rule = parseRecurrenceRuleFromDb(old.recurrenceRule);
    if (rule) {
      const baseDate = old.dueDate ?? new Date();
      const nextDue = computeNextOccurrence(rule, baseDate);
      await prisma.task.create({
        data: {
          companyId: user.companyId,
          title: old.title,
          description: old.description,
          priority: old.priority,
          assigneeId: old.assigneeId,
          sectorId: old.sectorId,
          projectId: old.projectId,
          createdById: old.createdById,
          recurrenceRule: old.recurrenceRule ?? undefined,
          recurrenceParentId: taskId,
          dueDate: nextDue,
        },
      });
      if (old.projectId) revalidatePath(`/projetos/${old.projectId}`);
    }
  }

  revalidatePath(`/tarefas/${taskId}`);
  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  if (old.projectId) revalidatePath(`/projetos/${old.projectId}`);
}

export async function updateTaskProgressAction(taskId: string, progress: number) {
  const user = await requireAuth();
  const allowed = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { id: true },
  });
  if (!allowed) return;
  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { progress: Math.max(0, Math.min(100, progress)) },
  });
  revalidatePath(`/tarefas/${taskId}`);
}

export async function deleteTaskAction(taskId: string): Promise<{ projectId: string | null }> {
  const user = await requireAuth();

  const task = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { title: true, projectId: true },
  });
  if (!task) return { projectId: null };

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.deleted",
    resourceType: "task",
    resourceId: taskId,
    oldValue: { title: task.title },
  });

  revalidatePath("/dashboard");
  revalidatePath("/tarefas");
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);

  return { projectId: task.projectId };
}

export async function updateTaskAction(
  taskId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    assigneeId: formData.get("assigneeId"),
    sectorId: formData.get("sectorId"),
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { title, description, priority, assigneeId, sectorId, dueDate } = parsed.data;
  const safePriority: TaskPriority = (priority || "medium") as TaskPriority;

  const old = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { assigneeId: true, title: true },
  });
  if (!old) return { error: "Tarefa não encontrada." };

  const recurrenceRule = parseRecurrenceRuleFromForm(formData.get("recurrenceRule"));

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: {
      title,
      description: description || null,
      priority: safePriority,
      assigneeId: assigneeId || null,
      sectorId: sectorId || null,
      dueDate: parseDateInput(dueDate),
      recurrenceRule: recurrenceRule ?? undefined,
    },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.updated",
    resourceType: "task",
    resourceId: taskId,
    newValue: { title, priority, assigneeId },
  });

  if (assigneeId && assigneeId !== old.assigneeId && assigneeId !== user.userId) {
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { name: true, email: true },
    });
    dispatchWebhook(user.companyId, "task.assigned", {
      taskId,
      taskTitle: title,
      priority,
      assigneeName: assignee?.name,
      assigneeEmail: assignee?.email,
      dueDate: dueDate || null,
      createdBy: user.name,
    });
  }

  revalidatePath(`/tarefas/${taskId}`);

  const returnTo = formData.get("returnTo");
  if (typeof returnTo === "string" && returnTo.startsWith("/")) {
    redirect(returnTo);
  }
  redirect(`/tarefas/${taskId}`);
}

export async function updateTaskAssigneeAction(taskId: string, assigneeId: string | null) {
  const user = await requireAuth();
  const task = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { title: true, projectId: true, dueDate: true },
  });
  if (!task) return;
  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { assigneeId: assigneeId || null },
  });

  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
}

export async function updateTaskTitleAction(
  taskId: string,
  title: string,
): Promise<{ error?: string }> {
  const user = await requireAuth();
  const trimmed = title.trim();
  if (!trimmed) return { error: "Título obrigatório." };
  if (trimmed.length > 500) return { error: "Título muito longo." };

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { projectId: true, title: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };
  if (task.title === trimmed) return {};

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { title: trimmed },
  });

  revalidatePath(`/tarefas/${taskId}`);
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  return {};
}

export async function updateTaskDueDateAction(taskId: string, dueDate: string | null) {
  const user = await requireAuth();
  const task = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { projectId: true },
  });
  if (!task) return;
  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { dueDate: parseDateInput(dueDate) },
  });
  
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
}

export async function addSubtaskAction(
  parentTaskId: string,
  title: string,
): Promise<{ error?: string; id?: string }> {
  const user = await requireAuth();
  const trimmed = title.trim();
  if (!trimmed) return { error: "Título obrigatório." };

  const parent = await prisma.task.findFirst({
    where: { id: parentTaskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { id: true, projectId: true, sectorId: true },
  });
  if (!parent) return { error: "Tarefa pai não encontrada." };

  const sub = await prisma.task.create({
    data: {
      companyId: user.companyId,
      title: trimmed,
      priority: "medium",
      parentTaskId: parent.id,
      projectId: parent.projectId,
      sectorId: parent.sectorId,
      createdById: user.userId,
    },
    select: { id: true },
  });

  if (parent.projectId) revalidatePath(`/projetos/${parent.projectId}`);
  return { id: sub.id };
}

export async function addChecklistItemAction(taskId: string, title: string) {
  const user = await requireAuth();

  const owned = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { id: true },
  });
  if (!owned) return null;

  const count = await prisma.taskChecklistItem.count({ where: { taskId } });
  const item = await prisma.taskChecklistItem.create({
    data: { taskId, title, position: count },
  });
  await recalcProgress(taskId, user.companyId);
  revalidatePath(`/tarefas/${taskId}`);
  return item;
}

export async function toggleChecklistItemAction(
  itemId: string,
  taskId: string,
  isDone: boolean,
) {
  const user = await requireAuth();

  const item = await prisma.taskChecklistItem.findFirst({
    where: { id: itemId, task: taskVisibilityFilter(user) },
    select: { id: true },
  });
  if (!item) return;

  await prisma.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      isDone,
      doneAt: isDone ? new Date() : null,
      doneById: isDone ? user.userId : null,
    },
  });
  await recalcProgress(taskId, user.companyId);
  revalidatePath(`/tarefas/${taskId}`);
}

async function recalcProgress(taskId: string, companyId: string) {
  const items = await prisma.taskChecklistItem.findMany({
    where: { taskId },
    select: { isDone: true },
  });
  if (items.length === 0) return;
  const done = items.filter((i) => i.isDone).length;
  const progress = Math.round((done / items.length) * 100);
  await prisma.task.update({
    where: { id: taskId, companyId },
    data: { progress },
  });
}

const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export async function addCommentAction(taskId: string, content: string) {
  const user = await requireAuth();
  if (!content.trim()) return;

  const task = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { assigneeId: true, createdById: true, title: true },
  });
  if (!task) return;

  const comment = await prisma.taskComment.create({
    data: { taskId, userId: user.userId, content: content.trim() },
  });

  // Parse @mentions and create notifications
  const mentionedIds = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, "gi");
  while ((m = re.exec(content)) !== null) {
    const [, , mentionedUserId] = m;
    if (mentionedUserId !== user.userId && !mentionedIds.has(mentionedUserId)) {
      mentionedIds.add(mentionedUserId);
      // Verify user belongs to same company before notifying
      const target = await prisma.user.findFirst({
        where: { id: mentionedUserId, companyId: user.companyId, isActive: true },
        select: { id: true },
      });
      if (target) {
        await prisma.notification.create({
          data: {
            companyId: user.companyId,
            userId: mentionedUserId,
            type: "mention",
            title: `${user.name.split(" ")[0]} mencionou você`,
            body: `Em "${task.title}": ${content.replace(MENTION_RE, "@$1").slice(0, 120)}`,
            resourceType: "task",
            resourceId: taskId,
          },
        });
      }
    }
  }

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.commented",
    resourceType: "task",
    resourceId: taskId,
    newValue: { commentId: comment.id },
  });

  dispatchWebhook(user.companyId, "task.commented", {
    taskId,
    taskTitle: task.title,
    commentBy: user.name,
  });

  revalidatePath(`/tarefas/${taskId}`);
}

export async function getTaskDetailsAction(taskId: string): Promise<{
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  assignee: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  checklistItems: { id: string; title: string; isDone: boolean }[];
  commentsCount: number;
} | null> {
  const user = await requireAuth();
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      dueDate: true,
      assignee: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      checklistItems: { orderBy: { position: "asc" }, select: { id: true, title: true, isDone: true } },
      _count: { select: { comments: true } },
    },
  });
  if (!task) return null;
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    assignee: task.assignee,
    project: task.project,
    checklistItems: task.checklistItems.map((i) => ({ id: i.id, title: i.title, isDone: i.isDone })),
    commentsCount: task._count.comments,
  };
}

export async function fetchProjectsForMoveAction(): Promise<{ id: string; name: string }[]> {
  const user = await requireAuth();
  return prisma.project.findMany({
    where: { deletedAt: null, AND: projectVisibilityFilter(user) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function moveTaskToProjectAction(
  taskId: string,
  projectId: string | null,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { projectId: true, title: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null, AND: projectVisibilityFilter(user) },
      select: { id: true },
    });
    if (!project) return { error: "Projeto não encontrado." };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { projectId: projectId || null },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.updated",
    resourceType: "task",
    resourceId: taskId,
    newValue: { projectId },
  });

  revalidatePath(`/tarefas/${taskId}`);
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  if (projectId) revalidatePath(`/projetos/${projectId}`);
  revalidatePath("/dashboard");
  return {};
}

export async function duplicateTaskAction(taskId: string): Promise<{ error?: string; newTaskId?: string }> {
  const user = await requireAuth();

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: {
      title: true, description: true, priority: true, assigneeId: true,
      sectorId: true, projectId: true, dueDate: true,
      checklistItems: { select: { title: true, position: true } },
      subtasks: {
        where: { deletedAt: null },
        select: { title: true, description: true, priority: true, assigneeId: true, dueDate: true, sectorId: true },
      },
    },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  const copy = await prisma.task.create({
    data: {
      companyId: user.companyId,
      title: `${task.title} (cópia)`,
      description: task.description,
      priority: task.priority,
      assigneeId: task.assigneeId,
      sectorId: task.sectorId,
      projectId: task.projectId,
      dueDate: task.dueDate,
      createdById: user.userId,
      checklistItems: {
        create: task.checklistItems.map((ci) => ({ title: ci.title, position: ci.position })),
      },
    },
    select: { id: true },
  });

  for (const sub of task.subtasks) {
    await prisma.task.create({
      data: {
        companyId: user.companyId,
        title: sub.title,
        description: sub.description,
        priority: sub.priority,
        assigneeId: sub.assigneeId,
        dueDate: sub.dueDate,
        projectId: task.projectId,
        sectorId: task.sectorId,
        parentTaskId: copy.id,
        createdById: user.userId,
      },
    });
  }

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.created",
    resourceType: "task",
    resourceId: copy.id,
    newValue: { title: `${task.title} (cópia)`, duplicatedFrom: taskId },
  });

  revalidatePath("/dashboard");
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  return { newTaskId: copy.id };
}

export async function archiveTaskAction(taskId: string): Promise<{ error?: string }> {
  const user = await requireAuth();

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { title: true, projectId: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: new Date() },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.updated",
    resourceType: "task",
    resourceId: taskId,
    newValue: { archived: true },
  });

  revalidatePath("/dashboard");
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  return {};
}

export async function bulkUpdateTaskStatusAction(
  taskIds: string[],
  status: TaskStatus,
): Promise<{ error?: string }> {
  const user = await requireAuth();
  if (!taskIds.length) return {};

  const owned = await prisma.task.findMany({
    where: { id: { in: taskIds }, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { id: true },
  });
  const safeIds = owned.map((t) => t.id);

  await prisma.task.updateMany({
    where: { id: { in: safeIds } },
    data: { status, completedAt: status === "done" ? new Date() : null },
  });

  revalidatePath("/dashboard");
  return {};
}

export async function bulkAssignAction(
  taskIds: string[],
  assigneeId: string,
): Promise<{ error?: string }> {
  const user = await requireAuth();
  if (!taskIds.length) return {};

  const [owned, assignee] = await Promise.all([
    prisma.task.findMany({
      where: { id: { in: taskIds }, deletedAt: null, AND: taskVisibilityFilter(user) },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { id: assigneeId, companyId: user.companyId },
      select: { id: true },
    }),
  ]);
  if (!assignee) return { error: "Usuário não encontrado." };

  const safeIds = owned.map((t) => t.id);
  await prisma.task.updateMany({
    where: { id: { in: safeIds } },
    data: { assigneeId },
  });

  revalidatePath("/dashboard");
  return {};
}

export async function bulkDeleteAction(taskIds: string[]): Promise<{ error?: string }> {
  const user = await requireAuth();
  if (!taskIds.length) return {};

  const owned = await prisma.task.findMany({
    where: { id: { in: taskIds }, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { id: true, projectId: true },
  });
  const safeIds = owned.map((t) => t.id);
  const projectIds = [...new Set(owned.map((t) => t.projectId).filter(Boolean) as string[])];

  await prisma.task.updateMany({
    where: { id: { in: safeIds } },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/dashboard");
  for (const pid of projectIds) revalidatePath(`/projetos/${pid}`);
  return {};
}
