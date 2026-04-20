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
