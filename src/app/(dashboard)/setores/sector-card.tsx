"use client";

import { useState } from "react";
import { ListTodo, Crown } from "lucide-react";
import { MembersDialog } from "./[id]/members-dialog";

interface Member {
  userId: string;
  user: { id: string; name: string; email: string };
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface SectorCardProps {
  sector: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    manager: { name: string } | null;
    members: Member[];
    _count: { tasks: number };
  };
  allUsers: User[];
  canManage: boolean;
}

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

export function SectorCard({ sector, allUsers, canManage }: SectorCardProps) {
  const [open, setOpen] = useState(false);
  const visibleMembers = sector.members.slice(0, 4);
  const extraCount = Math.max(0, sector.members.length - 4);
  const color = sector.color ?? "#6366f1";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:border-neutral-300 hover:shadow-md transition-all flex flex-col cursor-pointer"
      >
        <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

        <div className="p-5 flex flex-col gap-4 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm"
                style={{ backgroundColor: color }}
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

          {sector.description && (
            <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
              {sector.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <div className="flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5 text-neutral-400" />
              <span>{sector._count.tasks} tarefa{sector._count.tasks !== 1 ? "s" : ""} ativa{sector._count.tasks !== 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-auto pt-3 border-t border-neutral-100">
            {sector.members.length === 0 ? (
              <span className="text-xs text-neutral-400 italic">Sem membros</span>
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
        </div>
      </button>

      <MembersDialog
        sectorId={sector.id}
        sectorName={sector.name}
        sectorColor={color}
        members={sector.members}
        availableUsers={allUsers}
        canManage={canManage}
        controlledOpen={open}
        onControlledOpenChange={setOpen}
        hideTrigger
      />
    </>
  );
}
