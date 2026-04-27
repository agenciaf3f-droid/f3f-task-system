import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Building2 } from "lucide-react";
import { NewSectorDialog } from "./new-sector-dialog";
import { SectorCard } from "./sector-card";

export default async function SetoresPage() {
  const user = await requireAuth();

  const [sectors, allUsers] = await Promise.all([
    prisma.sector.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        manager: { select: { name: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        _count: {
          select: {
            tasks: { where: { status: { notIn: ["done", "cancelled"] }, deletedAt: null } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { companyId: user.companyId, isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const canManage = user.role === "admin" || user.role === "manager";

  const managersForCreate = await prisma.user.findMany({
    where: {
      companyId: user.companyId,
      isActive: true,
      deletedAt: null,
      role: { in: ["admin", "manager", "supervisor"] },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">Setores</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {sectors.length} setor{sectors.length !== 1 ? "es" : ""}
          </p>
        </div>
        {canManage && <NewSectorDialog managers={managersForCreate} />}
      </div>

      {sectors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed border-neutral-200 rounded-2xl bg-white">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-neutral-400" />
          </div>
          <p className="text-sm font-semibold text-neutral-600">Nenhum setor criado</p>
          <p className="text-xs text-neutral-400 mt-1">Crie setores para organizar sua equipe</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((sector) => (
            <SectorCard
              key={sector.id}
              sector={sector}
              allUsers={allUsers}
              canManage={canManage}
              canDelete={user.role === "admin"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
