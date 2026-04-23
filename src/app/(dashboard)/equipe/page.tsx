import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Users, UserCheck, UserX, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NewUserDialog } from "./new-user-dialog";
import { ToggleUserButton } from "./toggle-user-button";
import { DeleteUserButton } from "./delete-user-button";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Gestor",
  supervisor: "Supervisor",
  member: "Colaborador",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-50 text-red-700 border-red-200",
  manager: "bg-blue-50 text-blue-700 border-blue-200",
  supervisor: "bg-blue-50 text-blue-700 border-blue-200",
  member: "bg-neutral-50 text-neutral-600 border-neutral-200",
};

export default async function EquipePage() {
  const currentUser = await requireRole(["admin", "manager"]);

  const [users, sectors] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: currentUser.companyId, deletedAt: null },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        sectorMemberships: {
          include: { sector: { select: { name: true } } },
        },
        _count: {
          select: {
            assignedTasks: {
              where: { status: { notIn: ["done", "cancelled"] }, deletedAt: null },
            },
          },
        },
      },
      // include mustChangePassword to detect pending status
    }),
    prisma.sector.findMany({
      where: { companyId: currentUser.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const pending = users.filter((u) => u.isActive && u.mustChangePassword);
  const active = users.filter((u) => u.isActive && !u.mustChangePassword);
  const inactive = users.filter((u) => !u.isActive);

  function initials(name: string) {
    return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Equipe</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {active.length} membro{active.length !== 1 ? "s" : ""} ativo
            {active.length !== 1 ? "s" : ""}
            {pending.length > 0 && ` · ${pending.length} convite${pending.length !== 1 ? "s" : ""} pendente${pending.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {currentUser.role === "admin" && (
          <NewUserDialog sectors={sectors} />
        )}
      </div>

      {/* Pending users (invited, never logged in) */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-amber-600 mb-3 flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            Convite pendente ({pending.length})
          </h2>
          <div className="grid gap-2">
            {pending.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3"
              >
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-sm font-semibold text-amber-700 shrink-0">
                  {initials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{u.name}</p>
                  <p className="text-xs text-neutral-500 truncate">{u.email}</p>
                  {u.sectorMemberships.length > 0 && (
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {u.sectorMemberships.map((sm) => sm.sector.name).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border bg-amber-50 text-amber-700 border-amber-300">
                    <Clock className="w-3 h-3" />
                    Pendente
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${ROLE_COLORS[u.role]}`}
                  >
                    {ROLE_LABELS[u.role]}
                  </span>
                  {currentUser.role === "admin" && (
                    <DeleteUserButton userId={u.id} userName={u.name} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active users */}
      <div className="grid gap-3">
        {active.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-4 bg-white border border-neutral-200 rounded-lg px-4 py-3"
          >
            <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-semibold text-neutral-700 shrink-0">
              {initials(u.name)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900">{u.name}</p>
              <p className="text-xs text-neutral-500 truncate">{u.email}</p>
              {u.sectorMemberships.length > 0 && (
                <p className="text-xs text-neutral-400 mt-0.5">
                  {u.sectorMemberships.map((sm) => sm.sector.name).join(", ")}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${ROLE_COLORS[u.role]}`}
              >
                {ROLE_LABELS[u.role]}
              </span>

              {u._count.assignedTasks > 0 && (
                <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                  {u._count.assignedTasks} tarefa
                  {u._count.assignedTasks !== 1 ? "s" : ""}
                </span>
              )}

              {currentUser.role === "admin" && u.id !== currentUser.userId && (
                <>
                  <ToggleUserButton userId={u.id} isActive={u.isActive} />
                  <DeleteUserButton userId={u.id} userName={u.name} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Inactive users */}
      {inactive.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-1.5">
            <UserX className="w-4 h-4" />
            Desativados ({inactive.length})
          </h2>
          <div className="grid gap-2">
            {inactive.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-4 bg-neutral-50 border border-neutral-100 rounded-lg px-4 py-3 opacity-60"
              >
                <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-semibold text-neutral-500 shrink-0">
                  {initials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-600">{u.name}</p>
                  <p className="text-xs text-neutral-400">{u.email}</p>
                </div>
                {currentUser.role === "admin" && (
                  <>
                    <ToggleUserButton userId={u.id} isActive={u.isActive} />
                    <DeleteUserButton userId={u.id} userName={u.name} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
