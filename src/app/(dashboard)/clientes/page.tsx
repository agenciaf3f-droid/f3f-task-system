import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewClientDialog } from "./new-client-dialog";
import { ClientList } from "./client-list";

export const metadata = { title: "Clientes" };

// Email do owner que vê o toggle "Meus clientes".
const MY_CLIENTS_OWNER_EMAIL = "rdlecal342@gmail.com";

export default async function ClientesPage() {
  const user = await requireAuth();

  const [clients, managers] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: user.companyId, deletedAt: null },
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

  const clientsWithTaskCount = clients.map((c) => ({
    ...c,
    activeTasks: c.projects.reduce((sum, p) => sum + p._count.tasks, 0),
  }));

  // Computa IDs dos "meus clientes" — clientes onde o user logado é assignee de pelo menos 1 task.
  // Só calcula pro owner; demais usuários recebem null e o toggle fica escondido.
  let myClientIds: string[] | null = null;
  if (user.email === MY_CLIENTS_OWNER_EMAIL) {
    const myProjects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        companyId: user.companyId,
        tasks: { some: { assigneeId: user.userId, deletedAt: null } },
      },
      select: { clientId: true },
    });
    myClientIds = Array.from(new Set(myProjects.map((p) => p.clientId)));
  }

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
        clients={clientsWithTaskCount}
        userRole={user.role}
        myClientIds={myClientIds}
        managers={managers}
      />
    </div>
  );
}
