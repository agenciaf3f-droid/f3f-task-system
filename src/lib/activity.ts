import { prisma } from "@/lib/prisma";

interface LogActivityInput {
  companyId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

export async function logActivity(input: LogActivityInput) {
  return prisma.activityLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      oldValue: input.oldValue ? JSON.parse(JSON.stringify(input.oldValue)) : undefined,
      newValue: input.newValue ? JSON.parse(JSON.stringify(input.newValue)) : undefined,
    },
  });
}
