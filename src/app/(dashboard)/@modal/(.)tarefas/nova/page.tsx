import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { NewTaskForm } from "@/app/(dashboard)/tarefas/nova/form";
import { ModalClient } from "../[id]/modal-client";

export default async function NovaTaskModalPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; self?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;

  const [sectors, users, project] = await Promise.all([
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
    params.projectId
      ? prisma.project.findFirst({
          where: { id: params.projectId, companyId: user.companyId, deletedAt: null },
          select: { id: true, name: true, client: { select: { name: true } } },
        })
      : null,
  ]);

  return (
    <ModalClient matchPathname="/tarefas/nova" projectId={project?.id}>
      <NewTaskForm
        sectors={sectors}
        users={users}
        project={project ?? null}
        keepOpenAfterCreate
        // Tarefa avulsa (?self=1): pré-seleciona o próprio usuário — sem responsável
        // ela não apareceria no board/KPIs da home, que filtram por assignee.
        defaultAssigneeId={params.self === "1" ? user.userId : undefined}
      />
    </ModalClient>
  );
}
