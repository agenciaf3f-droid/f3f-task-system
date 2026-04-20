import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Building2, ListTodo, Crown } from "lucide-react";
import { NewSectorDialog } from "./new-sector-dialog";
import { MembersDialog } from "./[id]/members-dialog";

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    "#6366f1","#f59e0b","#10b981","#ec4899","#3b82f6",
    "#ef4444","#8b5cf6","#06b6d4","#84cc16","#f97316",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

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
          {sectors.map((sector) => {
            const visibleMembers = sector.members.slice(0, 4);
            const extraCount = Math.max(0, sector.members.length - 4);

            return (
              <div
                key={sector.id}
                className="bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:border-neutral-300 hover:shadow-md transition-all flex flex-col"
              >
                {/* Colored top accent */}
                <div className="h-1.5 w-full" style={{ backgroundColor: sector.color ?? "#6366f1" }} />

                <div className="p-5 flex flex-col gap-4 flex-1">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm"
                        style={{ backgroundColor: sector.color ?? "#6366f1" }}
                      >
                        {getInitials(sector.name)}
                      </div>
                      <div>
                        <h3 className="font-bold text-neutral-900 text-sm leading-tight">{sector.name}</h3>
                        {sector.manager && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Crown className="w-3 h-3 text-amber-500" />
                            <span className="text-xs text-neutral-500">{sector.manager.name.split(" ")[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {sector.description && (
                    <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                      {sector.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <div className="flex items-center gap-1.5">
                      <ListTodo className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{sector._count.tasks} tarefa{sector._count.tasks !== 1 ? "s" : ""} ativa{sector._count.tasks !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* Members row */}
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-neutral-100">
                    <div className="flex items-center gap-2">
                      {sector.members.length === 0 ? (
                        canManage ? null : <span className="text-xs text-neutral-400 italic">Sem membros</span>
                      ) : (
                        <div className="flex items-center">
                          {visibleMembers.map((m, i) => (
                            <div
                              key={m.userId}
                              title={m.user.name}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow-sm"
                              style={{
                                backgroundColor: getAvatarColor(m.user.name),
                                marginLeft: i > 0 ? "-8px" : "0",
                                zIndex: visibleMembers.length - i,
                                position: "relative",
                              }}
                            >
                              {m.user.name.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {extraCount > 0 && (
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center bg-neutral-200 text-neutral-600 text-[10px] font-bold border-2 border-white"
                              style={{ marginLeft: "-8px", position: "relative", zIndex: 0 }}
                            >
                              +{extraCount}
                            </div>
                          )}
                          <span className="ml-2 text-xs text-neutral-500">
                            {sector.members.length} membro{sector.members.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>

                    {canManage && (
                      <MembersDialog
                        sectorId={sector.id}
                        sectorName={sector.name}
                        sectorColor={sector.color ?? "#6366f1"}
                        members={sector.members}
                        availableUsers={allUsers}
                        emptyTrigger={sector.members.length === 0}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
