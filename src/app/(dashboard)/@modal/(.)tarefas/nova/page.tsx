import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { NewTaskForm } from "@/app/(dashboard)/tarefas/nova/form";
import { ModalClient } from "../[id]/modal-client";

export default async function NovaTaskModalPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; clientId?: string; self?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;

  const [sectors, users, clients, project, templates] = await Promise.all([
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
    params.projectId
      ? prisma.project.findFirst({
          where: { id: params.projectId, companyId: user.companyId, deletedAt: null },
          select: { id: true, name: true, client: { select: { name: true } } },
        })
      : null,
    prisma.template.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
        deletedAt: null,
        OR: [{ isPersonal: false }, { isPersonal: true, createdById: user.userId }],
      },
      orderBy: [{ isPersonal: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        isPersonal: true,
        templateTasks: {
          orderBy: { position: "asc" },
          select: { _count: { select: { checklistItems: true } } },
        },
      },
    }),
  ]);

  return (
    <ModalClient matchPathname="/tarefas/nova" projectId={project?.id}>
      <NewTaskForm
        sectors={sectors}
        users={users}
        clients={clients}
        project={project ?? null}
        templates={templates.map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          isPersonal: template.isPersonal,
          checklistItemCount: template.templateTasks.reduce(
            (total, task) => total + Math.max(task._count.checklistItems, 1),
            0,
          ),
        }))}
        keepOpenAfterCreate
        draftKey={`${user.userId}:${project?.id ?? params.clientId ?? "avulsa"}`}
        // Tarefa avulsa (?self=1): pré-seleciona o próprio usuário — sem responsável
        // ela não apareceria no board/KPIs da home, que filtram por assignee.
        defaultAssigneeId={params.self === "1" ? user.userId : undefined}
        defaultClientId={params.clientId}
      />
    </ModalClient>
  );
}
