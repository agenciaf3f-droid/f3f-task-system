import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

interface CreateNotificationInput {
  companyId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  resourceType?: string;
  resourceId?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({ data: input });
}

export async function markNotificationsRead(
  userId: string,
  ids?: string[],
) {
  return prisma.notification.updateMany({
    where: { userId, ...(ids ? { id: { in: ids } } : { isRead: false }) },
    data: { isRead: true },
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

const notificationClientSelect = {
  id: true, type: true, title: true, body: true, isRead: true,
  resourceType: true, resourceId: true, createdAt: true,
} as const;

export async function getRecentNotifications(userId: string, limit = 15) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: notificationClientSelect,
  });
}

// Gera notificações de "vence hoje" / "atrasada" pro responsável.
// Dedup: 1 notificação por tarefa por tipo (task_due muda pra task_overdue no dia seguinte).
// Roda no cron diário — granularidade diária é suficiente.
export async function generateDueNotifications() {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      archivedAt: null,
      status: { notIn: ["done", "cancelled"] },
      assigneeId: { not: null },
      dueDate: { not: null, lte: todayEnd },
    },
    select: { id: true, companyId: true, title: true, assigneeId: true, dueDate: true },
  });

  let created = 0;
  for (const t of tasks) {
    if (!t.assigneeId || !t.dueDate) continue;
    const type: NotificationType = t.dueDate < todayStart ? "task_overdue" : "task_due";
    const exists = await prisma.notification.findFirst({
      where: { userId: t.assigneeId, type, resourceType: "task", resourceId: t.id },
      select: { id: true },
    });
    if (exists) continue;
    await createNotification({
      companyId: t.companyId,
      userId: t.assigneeId,
      type,
      title: type === "task_overdue" ? "Tarefa atrasada" : "Tarefa vence hoje",
      body: t.title,
      resourceType: "task",
      resourceId: t.id,
    });
    created++;
  }
  return created;
}

// Notifica o responsável quando uma tarefa é atribuída a ele por outra pessoa.
export async function notifyTaskAssigned(params: {
  companyId: string;
  assigneeId: string;
  actorName: string;
  taskId: string;
  taskTitle: string;
}) {
  return createNotification({
    companyId: params.companyId,
    userId: params.assigneeId,
    type: "task_assigned",
    title: `${params.actorName.split(" ")[0]} atribuiu uma tarefa a você`,
    body: params.taskTitle,
    resourceType: "task",
    resourceId: params.taskId,
  });
}
