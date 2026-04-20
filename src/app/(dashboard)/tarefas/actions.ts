"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { dispatchWebhook } from "@/lib/webhook";
import type { TaskStatus, TaskPriority } from "@prisma/client";

const taskSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(500),
  description: z.string().optional(),
  assigneeId: z.string().uuid().optional().or(z.literal("")),
  sectorId: z.string().uuid().optional().or(z.literal("")),
  projectId: z.string().uuid().optional().or(z.literal("")),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string().optional().or(z.literal("")),
});

export async function createTaskAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireAuth();

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

  const task = await prisma.task.create({
    data: {
      companyId: user.companyId,
      title,
      description: description || null,
      priority: priority as TaskPriority,
      assigneeId: assigneeId || null,
      sectorId: sectorId || null,
      projectId: projectId || null,
      createdById: user.userId,
      dueDate: dueDate ? new Date(dueDate) : null,
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
    dispatchWebhook(user.companyId, "task.assigned", {
      taskId: task.id,
      taskTitle: title,
      priority,
      assigneeName: assignee?.name,
      assigneeEmail: assignee?.email,
      projectName: project?.name ?? null,
      dueDate: dueDate || null,
      createdBy: user.name,
    });
  }

  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  if (projectId) {
    revalidatePath(`/projetos/${projectId}`);
    redirect(`/projetos/${projectId}`);
  }
  redirect("/tarefas");
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus) {
  const user = await requireAuth();

  const old = await prisma.task.findFirst({
    where: { id: taskId, companyId: user.companyId },
    select: { status: true, assigneeId: true, title: true, projectId: true },
  });
  if (!old) return;

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: {
      status,
      completedAt: status === "done" ? new Date() : null,
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
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${taskId}`);
  revalidatePath("/dashboard");
  if (old.projectId) revalidatePath(`/projetos/${old.projectId}`);
}

export async function updateTaskProgressAction(taskId: string, progress: number) {
  const user = await requireAuth();
  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { progress: Math.max(0, Math.min(100, progress)) },
  });
  revalidatePath(`/tarefas/${taskId}`);
}

export async function deleteTaskAction(taskId: string) {
  const user = await requireAuth();

  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: user.companyId },
    select: { title: true },
  });

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { deletedAt: new Date() },
  });

  if (task) {
    await logActivity({
      companyId: user.companyId,
      userId: user.userId,
      action: "task.deleted",
      resourceType: "task",
      resourceId: taskId,
      oldValue: { title: task.title },
    });
  }

  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  redirect("/tarefas");
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

  const old = await prisma.task.findFirst({
    where: { id: taskId, companyId: user.companyId },
    select: { assigneeId: true, title: true },
  });
  if (!old) return { error: "Tarefa não encontrada." };

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: {
      title,
      description: description || null,
      priority: priority as TaskPriority,
      assigneeId: assigneeId || null,
      sectorId: sectorId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
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
  revalidatePath("/tarefas");
  redirect(`/tarefas/${taskId}`);
}

export async function updateTaskAssigneeAction(taskId: string, assigneeId: string | null) {
  const user = await requireAuth();
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: user.companyId },
    select: { projectId: true },
  });
  if (!task) return;
  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { assigneeId: assigneeId || null },
  });
  revalidatePath("/tarefas");
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
}

export async function updateTaskDueDateAction(taskId: string, dueDate: string | null) {
  const user = await requireAuth();
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: user.companyId },
    select: { projectId: true },
  });
  if (!task) return;
  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { dueDate: dueDate ? new Date(dueDate) : null },
  });
  revalidatePath("/tarefas");
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
}

export async function addChecklistItemAction(taskId: string, title: string) {
  const user = await requireAuth();
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

export async function addCommentAction(taskId: string, content: string) {
  const user = await requireAuth();
  if (!content.trim()) return;

  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: user.companyId },
    select: { assigneeId: true, createdById: true, title: true },
  });

  await prisma.taskComment.create({
    data: { taskId, userId: user.userId, content: content.trim() },
  });

  if (task) {
    await logActivity({
      companyId: user.companyId,
      userId: user.userId,
      action: "task.commented",
      resourceType: "task",
      resourceId: taskId,
    });

    dispatchWebhook(user.companyId, "task.commented", {
      taskId,
      taskTitle: task.title,
      commentBy: user.name,
    });
  }

  revalidatePath(`/tarefas/${taskId}`);
}
