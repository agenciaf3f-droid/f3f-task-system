import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewClientDialog } from "./new-client-dialog";
import { ClientList } from "./client-list";

export const metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const user = await requireAuth();

  const [allClients, managers] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" },
      include: {
        manager: { select: { id: true, name: true } },
        _count: {
          select: { projects: { where: { deletedAt: null } } },
        },
        projects: {
          where: { deletedAt: null },
          select: {
            _count: {
              select: {
                tasks: { where: { status: { notIn: ["done", "cancelled"] }, deletedAt: null } },
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { companyId: user.companyId, deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const clientsWithTaskCount = allClients.map((c) => ({
    ...c,
    activeTasks: c.projects.reduce((sum, p) => sum + p._count.tasks, 0),
  }));
  const clients = clientsWithTaskCount.filter((client) => !client.deletedAt);
  const archivedClients = clientsWithTaskCount.filter((client) => client.deletedAt);

  // Computa IDs dos "meus clientes":
  //  - clientes onde o user logado é o manager (Client.managerId)
  //  - OU clientes que têm projeto com task atribuída ao user (legado)
  // Toggle aparece pra qualquer user que tenha pelo menos 1 cliente nesse conjunto.
  const [managedClients, projectsWithMyTasks] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: user.companyId, deletedAt: null, managerId: user.userId },
      select: { id: true },
    }),
    prisma.project.findMany({
      where: {
        deletedAt: null,
        companyId: user.companyId,
        tasks: { some: { assigneeId: user.userId, deletedAt: null } },
      },
      select: { clientId: true },
    }),
  ]);
  const ids = new Set<string>([
    ...managedClients.map((c) => c.id),
    ...projectsWithMyTasks.map((p) => p.clientId),
  ]);
  const myClientIds: string[] | null = ids.size > 0 ? Array.from(ids) : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">Clientes</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""} ativo{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <NewClientDialog managers={managers} />
      </div>

      <ClientList
        clients={clients}
        archivedClients={archivedClients}
        userRole={user.role}
        myClientIds={myClientIds}
        managers={managers}
      />
    </div>
  );
}
