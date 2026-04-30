import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Briefcase, FolderKanban, ListTodo } from "lucide-react";
import { EditClientDialog } from "./edit-client-dialog";
import { DeleteClientButton } from "./delete-client-button";
import { NewClientDialog } from "./new-client-dialog";
import { UserAvatar } from "@/components/ui/user-avatar";

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

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed border-neutral-200 rounded-2xl bg-white">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6 text-neutral-400" />
          </div>
          <p className="text-sm font-semibold text-neutral-600">Nenhum cliente cadastrado</p>
          <p className="text-xs text-neutral-400 mt-1">Clique em &quot;Novo cliente&quot; para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clientsWithTaskCount.map((client) => (
            <div
              key={client.id}
              className="relative bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:border-neutral-300 hover:shadow-md transition-all flex flex-col"
            >
              <div className="h-1.5 w-full" style={{ backgroundColor: client.color ?? "#6366f1" }} />

              <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                <EditClientDialog client={client} />
                {user.role === "admin" && (
                  <DeleteClientButton
                    clientId={client.id}
                    clientName={client.name}
                    projectCount={client._count.projects}
                    taskCount={client.activeTasks}
                  />
                )}
              </div>

              <Link
                href={`/projetos?clientId=${client.id}`}
                className="p-5 flex flex-col gap-3 flex-1"
              >
                <div className="flex items-center gap-3 pr-16">
                  <UserAvatar
                    name={client.name}
                    src={client.avatarUrl}
                    size={40}
                    bgColor={client.color}
                  />
                  <h3 className="font-bold text-neutral-900 text-sm leading-tight truncate">{client.name}</h3>
                </div>

                <p className="text-xs text-neutral-500 line-clamp-2 min-h-[2.5rem]">
                  {client.description || <span className="text-neutral-300 italic">Sem descrição</span>}
                </p>

                <div className="flex items-center gap-4 text-xs text-neutral-500 mt-auto pt-3 border-t border-neutral-100">
                  <div className="flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{client._count.projects} projeto{client._count.projects !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{client.activeTasks} tarefa{client.activeTasks !== 1 ? "s" : ""} ativa{client.activeTasks !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
