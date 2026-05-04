"use client";

import { useState, useTransition } from "react";
import { Users, X, Plus, Loader2 } from "lucide-react";
import { addTaskAssigneeAction, removeTaskAssigneeAction } from "../assignee-actions";
import { UserAvatar } from "@/components/ui/user-avatar";

type Assignee = { userId: string; name: string; avatarUrl?: string | null | undefined };
type AllUser  = { id: string; name: string };

export function AssigneesSection({
  taskId,
  initialAssignees,
  allUsers,
  canEdit,
}: {
  taskId: string;
  initialAssignees: Assignee[];
  allUsers: AllUser[];
  canEdit: boolean;
}) {
  const [assignees, setAssignees] = useState(initialAssignees);
  const [showPicker, setShowPicker] = useState(false);
  const [isPending, startTransition] = useTransition();

  const assigneeIds = new Set(assignees.map((a) => a.userId));
  const available = allUsers.filter((u) => !assigneeIds.has(u.id));

  function handleAdd(u: AllUser) {
    setShowPicker(false);
    setAssignees((prev) => [...prev, { userId: u.id, name: u.name }]);
    startTransition(async () => {
      const result = await addTaskAssigneeAction(taskId, u.id);
      if (result.error) setAssignees((prev) => prev.filter((a) => a.userId !== u.id));
    });
  }

  function handleRemove(userId: string) {
    setAssignees((prev) => prev.filter((a) => a.userId !== userId));
    startTransition(async () => {
      await removeTaskAssigneeAction(taskId, userId);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-neutral-400 shrink-0" />
        <span className="text-sm text-neutral-500">Responsáveis</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-6">
        {assignees.length === 0 && (
          <span className="text-sm text-neutral-400">Nenhum</span>
        )}
        {assignees.map((a) => (
          <div
            key={a.userId}
            className="flex items-center gap-1.5 bg-neutral-100 rounded-full pl-1 pr-2 py-0.5 text-sm text-neutral-700"
          >
            <UserAvatar name={a.name} src={a.avatarUrl ?? undefined} size={20} />
            <span>{a.name.split(" ")[0]}</span>
            {canEdit && (
              <button
                onClick={() => handleRemove(a.userId)}
                disabled={isPending}
                className="text-neutral-400 hover:text-red-600 transition-colors disabled:opacity-40 ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

        {canEdit && available.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowPicker((v) => !v)}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 transition-colors disabled:opacity-40 border border-dashed border-neutral-300 rounded-full px-2 py-1"
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Adicionar
            </button>
            {showPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-48 max-h-48 overflow-y-auto">
                  {available.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleAdd(u)}
                      className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
