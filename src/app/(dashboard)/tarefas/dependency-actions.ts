"use server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// BFS: verifica se `from` pode alcançar `target` pelas edges de bloqueio (taskId → blocksTaskId)
async function hasCycle(from: string, target: string, companyId: string): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const edges = await prisma.taskDependency.findMany({
      where: { taskId: current, task: { companyId } },
      select: { blocksTaskId: true },
    });
    queue.push(...edges.map((e) => e.blocksTaskId));
  }
  return false;
}

export async function addDependencyAction(
  taskId: string,        // task que será bloqueada
  blockedByTaskId: string, // task que bloqueia
): Promise<{ error?: string }> {
  const user = await requireAuth();

  if (taskId === blockedByTaskId) return { error: "Uma tarefa não pode depender de si mesma." };

  const [task, blocker] = await Promise.all([
    prisma.task.findFirst({ where: { id: taskId, companyId: user.companyId, deletedAt: null }, select: { id: true } }),
    prisma.task.findFirst({ where: { id: blockedByTaskId, companyId: user.companyId, deletedAt: null }, select: { id: true } }),
  ]);
  if (!task || !blocker) return { error: "Tarefa não encontrada." };

  // Edge: blockedByTaskId → taskId (blocker blocks taskId)
  // Verificar ciclo: se adicionarmos blockedByTaskId → taskId, isso cria ciclo
  // se taskId já pode alcançar blockedByTaskId, adicionar essa edge cria ciclo
  const cycle = await hasCycle(taskId, blockedByTaskId, user.companyId);
  if (cycle) return { error: "Esta dependência criaria um ciclo entre as tarefas." };

  await prisma.taskDependency.upsert({
    where: { taskId_blocksTaskId: { taskId: blockedByTaskId, blocksTaskId: taskId } },
    create: { taskId: blockedByTaskId, blocksTaskId: taskId },
    update: {},
  });

  revalidatePath(`/tarefas/${taskId}`);
  return {};
}

export async function removeDependencyAction(
  taskId: string,
  blockedByTaskId: string,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId: user.companyId, deletedAt: null },
    select: { id: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  await prisma.taskDependency.deleteMany({
    where: { taskId: blockedByTaskId, blocksTaskId: taskId },
  });

  revalidatePath(`/tarefas/${taskId}`);
  return {};
}
