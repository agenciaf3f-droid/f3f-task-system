"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { ListTodo, Crown, Trash2, Pencil, Loader2 } from "lucide-react";
import { MembersDialog } from "./[id]/members-dialog";
import { deleteSectorAction, renameSectorAction } from "./actions";
import { UserAvatar } from "@/components/ui/user-avatar";

interface Member {
  userId: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
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

export function SectorCard({ sector, allUsers, canManage, canDelete = false, canRename = false }: SectorCardProps & { canDelete?: boolean; canRename?: boolean }) {
  const [open, setOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [isRenaming, startRename] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sector.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const visibleMembers = sector.members.slice(0, 4);
  const extraCount = Math.max(0, sector.members.length - 4);
  const color = sector.color ?? "#6366f1";

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Excluir o setor "${sector.name}"? As tarefas associadas continuarão existindo.`)) return;
    startDelete(() => deleteSectorAction(sector.id));
  }

  function handleRenameStart(e: React.MouseEvent) {
    e.stopPropagation();
    setName(sector.name);
    setEditing(true);
  }

  function commitRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === sector.name) {
      setEditing(false);
      setName(sector.name);
      return;
    }
    startRename(async () => {
      const res = await renameSectorAction(sector.id, trimmed);
      if (res?.error) {
        alert(res.error);
        setName(sector.name);
      }
      setEditing(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative text-left bg-white border border-neutral-200 rounded-2xl overflow-hidden hover:border-neutral-300 hover:shadow-md transition-all flex flex-col cursor-pointer"
      >
        <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
          {canRename && !editing && (
            <button
              type="button"
              onClick={handleRenameStart}
              title="Renomear setor"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              title="Excluir setor"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

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
                {editing ? (
                  <input
                    ref={inputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                      if (e.key === "Escape") { setEditing(false); setName(sector.name); }
                    }}
                    onBlur={commitRename}
                    disabled={isRenaming}
                    maxLength={255}
                    className="font-bold text-neutral-900 text-sm leading-tight bg-white border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full max-w-[180px]"
                  />
                ) : (
                  <h3 className="font-bold text-neutral-900 text-sm leading-tight flex items-center gap-1.5">
                    {sector.name}
                    {isRenaming && <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />}
                  </h3>
                )}
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
                    style={{
                      marginLeft: i > 0 ? "-8px" : "0",
                      zIndex: visibleMembers.length - i,
                      position: "relative",
                    }}
                  >
                    <UserAvatar name={m.user.name} src={m.user.avatarUrl} size={28} ring />
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
