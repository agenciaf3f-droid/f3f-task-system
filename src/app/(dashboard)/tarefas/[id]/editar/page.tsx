import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { taskVisibilityFilter } from "@/lib/task-visibility";
import { EditTaskForm } from "./form";

export default async function EditarTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;
  const returnTo = typeof sp.returnTo === "string" && sp.returnTo.startsWith("/") ? sp.returnTo : undefined;

  const [task, sectors, users, clients] = await Promise.all([
    prisma.task.findFirst({
      where: { id, deletedAt: null, AND: taskVisibilityFilter(user) },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        assigneeId: true,
        sectorId: true,
        clientId: true,
        projectId: true,
        project: { select: { clientId: true } },
        dueDate: true,
        deliveryDate: true,
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
    prisma.client.findMany({
      where: { companyId: user.companyId, deletedAt: null },
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

  return <EditTaskForm task={task} sectors={sectors} users={users} clients={clients} returnTo={returnTo} />;
}
