import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditTaskForm } from "./form";

export default async function EditarTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const [task, sectors, users] = await Promise.all([
    prisma.task.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        assigneeId: true,
        sectorId: true,
        dueDate: true,
        recurrenceRule: true,
        createdById: true,
      },
    }),
    prisma.sector.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { companyId: user.companyId, isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!task) notFound();

  const canEdit =
    user.role === "admin" ||
    user.role === "manager" ||
    task.assigneeId === user.userId ||
    task.createdById === user.userId;

  if (!canEdit) notFound();

  return <EditTaskForm task={task} sectors={sectors} users={users} />;
}
