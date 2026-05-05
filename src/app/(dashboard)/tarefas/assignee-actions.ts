"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { taskVisibilityFilter } from "@/lib/task-visibility";
import { revalidatePath } from "next/cache";

export async function addTaskAssigneeAction(
  taskId: string,
  userId: string,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { id: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  const target = await prisma.user.findFirst({
    where: { id: userId, companyId: user.companyId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!target) return { error: "Usuário não encontrado." };

  await prisma.taskAssignee.upsert({
    where: { taskId_userId: { taskId, userId } },
    create: { taskId, userId, assignedById: user.userId },
    update: {},
  });

  revalidatePath(`/tarefas/${taskId}`);
  return {};
}

export async function removeTaskAssigneeAction(
  taskId: string,
  userId: string,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { id: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  await prisma.taskAssignee.deleteMany({
    where: { taskId, userId },
  });

  revalidatePath(`/tarefas/${taskId}`);
  return {};
}
