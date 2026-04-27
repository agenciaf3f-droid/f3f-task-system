import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Briefcase, Mail, Phone, FolderKanban } from "lucide-react";

export const metadata = { title: "Clientes" };

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default async function ClientesPage() {
  const user = await requireAuth();

  const clients = await prisma.client.findMany({
    where: { companyId: user.companyId, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { projects: { where: { deletedAt: null } } },
      },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">Clientes</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          {clients.length} cliente{clients.length !== 1 ? "s" : ""} ativo{clients.length !== 1 ? "s" : ""}
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed border-neutral-200 rounded-2xl bg-white">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
            <Briefcase className="w-6 h-6 text-neutral-400" />
          </div>
          <p className="text-sm font-semibold text-neutral-600">Nenhum cliente cadastrado</p>
          <p className="text-xs text-neutral-400 mt-1">Crie um projeto para adicionar clientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/projetos?clientId=${client.id}`}
              className="bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:border-neutral-300 hover:shadow-md transition-all flex flex-col"
            >
              <div className="h-1.5 w-full" style={{ backgroundColor: client.color ?? "#6366f1" }} />
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm"
                    style={{ backgroundColor: client.color ?? "#6366f1" }}
                  >
                    {getInitials(client.name)}
                  </div>
                  <h3 className="font-bold text-neutral-900 text-sm leading-tight truncate">{client.name}</h3>
                </div>

                {(client.email || client.phone) && (
                  <div className="flex flex-col gap-1 text-xs text-neutral-500">
                    {client.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-auto pt-3 border-t border-neutral-100">
                  <FolderKanban className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{client._count.projects} projeto{client._count.projects !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
