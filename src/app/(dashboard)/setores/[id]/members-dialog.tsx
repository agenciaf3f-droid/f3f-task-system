"use client";

import { useTransition, useState } from "react";
import { Users, X, UserPlus, Loader2, UserX } from "lucide-react";
import { addSectorMemberAction, removeSectorMemberAction } from "../actions";

interface Member {
  userId: string;
  user: { id: string; name: string; email: string };
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface MembersDialogProps {
  sectorId: string;
  sectorName: string;
  sectorColor: string;
  members: Member[];
  availableUsers: User[];
  emptyTrigger?: boolean;
  canManage?: boolean;
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
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

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function MembersDialog({ sectorId, sectorName, sectorColor, members, availableUsers, emptyTrigger = false, canManage = true, controlledOpen, onControlledOpenChange, hideTrigger = false }: MembersDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) onControlledOpenChange?.(next);
    else setInternalOpen(next);
  };
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [currentMembers, setCurrentMembers] = useState(members);

  const nonMembers = availableUsers.filter(
    (u) => !currentMembers.some((m) => m.userId === u.id),
  );

  function handleAdd() {
    if (!selectedUserId) return;
    const toAdd = availableUsers.find((u) => u.id === selectedUserId);
    if (!toAdd) return;
    startTransition(async () => {
      await addSectorMemberAction(sectorId, selectedUserId);
      setCurrentMembers((prev) => [
        ...prev,
        { userId: toAdd.id, user: { id: toAdd.id, name: toAdd.name, email: toAdd.email } },
      ]);
      setSelectedUserId("");
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      await removeSectorMemberAction(sectorId, userId);
      setCurrentMembers((prev) => prev.filter((m) => m.userId !== userId));
    });
  }

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={() => setOpen(true)}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
            emptyTrigger
              ? "text-white bg-blue-600 hover:bg-blue-700"
              : "text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100"
          }`}
        >
          <UserPlus className="w-3.5 h-3.5" />
          {emptyTrigger ? "Adicionar membros" : "Membros"}
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed right-0 top-0 h-full z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col">

            {/* Header with sector color accent */}
            <div className="shrink-0">
              <div className="h-1" style={{ backgroundColor: sectorColor }} />
              <div className="flex items-center justify-between px-6 py-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: sectorColor }}
                  >
                    {getInitials(sectorName)}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-neutral-900">Membros</h2>
                    <p className="text-xs text-neutral-400">{sectorName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Add member section */}
            {canManage && nonMembers.length > 0 && (
              <div className="px-6 pb-4 shrink-0 border-b border-neutral-100">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-2">Adicionar membro</p>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
                    >
                      <option value="">Selecione uma pessoa...</option>
                      {nonMembers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleAdd}
                    disabled={!selectedUserId || isPending}
                    className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    {isPending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <span>Adicionar</span>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* Members list */}
            <div className="flex-1 overflow-y-auto">
              {currentMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-600">Nenhum membro ainda</p>
                    <p className="text-xs text-neutral-400 mt-1">Adicione pessoas para organizar o setor</p>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-4 flex flex-col gap-1">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest px-2 mb-2">
                    {currentMembers.length} membro{currentMembers.length !== 1 ? "s" : ""}
                  </p>
                  {currentMembers.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-neutral-50 transition-colors group"
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: getAvatarColor(m.user.name) }}
                      >
                        {getInitials(m.user.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">{m.user.name}</p>
                        <p className="text-xs text-neutral-400 truncate">{m.user.email}</p>
                      </div>
                      {canManage && (
                        <button
                          onClick={() => handleRemove(m.userId)}
                          disabled={isPending}
                          title="Remover do setor"
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </>
  );
}
