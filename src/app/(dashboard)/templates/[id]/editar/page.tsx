import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditTemplateForm } from "./form";

export default async function EditarTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const [template, sectors, users] = await Promise.all([
    prisma.template.findFirst({
      where: { id, companyId: user.companyId, deletedAt: null },
      include: {
        templateTasks: {
          orderBy: { position: "asc" },
          include: { checklistItems: { orderBy: { position: "asc" } } },
        },
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
      select: { id: true, name: true, avatarUrl: true },
    }),
  ]);

  if (!template) notFound();
  const canEdit = template.isPersonal
    ? template.createdById === user.userId
    : user.role === "admin" || user.role === "manager";
  if (!canEdit) notFound();

  const initialTasks = template.templateTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    days: t.daysToComplete?.toString() ?? "",
    priority: t.priority,
    assigneeId: t.defaultAssigneeId ?? "",
    subtasks: t.checklistItems.map((c) => ({ id: c.id, title: c.title })),
  }));

  return (
    <EditTemplateForm
      templateId={template.id}
      initialData={{
        name: template.name,
        description: template.description ?? "",
        category: template.category ?? "",
        sectorId: template.sectorId ?? "",
      }}
      initialTasks={initialTasks}
      sectors={sectors}
      users={users}
      personal={template.isPersonal}
    />
  );
}
