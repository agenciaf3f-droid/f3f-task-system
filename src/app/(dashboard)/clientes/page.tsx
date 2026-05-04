import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewClientDialog } from "./new-client-dialog";
import { ClientList } from "./client-list";

export const metadata = { title: "Clientes" };

export default async function ClientesPage() {
  const user = await requireAuth();

  const clients = await prisma.client.findMany({
    where: { companyId: user.companyId, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
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
  });

  const clientsWithTaskCount = clients.map((c) => ({
    ...c,
    activeTasks: c.projects.reduce((sum, p) => sum + p._count.tasks, 0),
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">Clientes</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""} ativo{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <NewClientDialog />
      </div>

      <ClientList clients={clientsWithTaskCount} userRole={user.role} />
    </div>
  );
}
