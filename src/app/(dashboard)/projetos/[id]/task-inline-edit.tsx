"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, User, Search } from "lucide-react";
import { updateTaskAssigneeAction, updateTaskDueDateAction, updateTaskStatusAction } from "@/app/(dashboard)/tarefas/actions";
import { UserAvatar } from "@/components/ui/user-avatar";

export function TaskCheckbox({ taskId, isDone }: { taskId: string; isDone: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => updateTaskStatusAction(taskId, isDone ? "todo" : "done"));
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all duration-150 ${
        isDone
          ? "bg-emerald-500 border-emerald-500"
          : "border-neutral-300 hover:border-emerald-400 hover:bg-emerald-50"
      } disabled:opacity-40 cursor-pointer`}
    >
      {isDone && (
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

interface UserLite { id: string; name: string; avatarUrl: string | null }

interface TaskInlineAssigneeProps {
  taskId: string;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  users: UserLite[];
}

export function TaskInlineAssignee({ taskId, assignee, users }: TaskInlineAssigneeProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      // foco assíncrono pra dropdown ter renderizado
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  function handleSelect(userId: string) {
    setOpen(false);
    startTransition(() => updateTaskAssigneeAction(taskId, userId || null));
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? users.filter((u) => u.name.toLowerCase().includes(q)) : users;

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        disabled={isPending}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors text-xs max-w-[140px] disabled:opacity-40"
      >
        {assignee ? (
          <>
            <UserAvatar name={assignee.name} src={assignee.avatarUrl} size={16} />
            <span className="text-neutral-700 truncate">{assignee.name.split(" ")[0]}</span>
          </>
        ) : (
          <>
            <User className="w-3 h-3 text-neutral-400" />
            <span className="text-neutral-400">Atribuir</span>
          </>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg w-52 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-1.5 border-b border-neutral-100">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400 pointer-events-none" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
                  }}
                  placeholder="Buscar pessoa..."
                  className="w-full h-7 pl-7 pr-2 text-xs rounded border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
            <div className="py-1 max-h-48 overflow-y-auto">
              {!q && (
                <button
                  onClick={() => handleSelect("")}
                  className="w-full text-left px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-50 transition-colors"
                >
                  Sem responsável
                </button>
              )}
              {filtered.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelect(u.id)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-neutral-50 flex items-center gap-2 ${
                    u.id === assignee?.id ? "font-semibold text-neutral-900" : "text-neutral-700"
                  }`}
                >
                  <UserAvatar name={u.name} src={u.avatarUrl} size={20} />
                  {u.name.split(" ")[0]}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-3 text-xs text-neutral-400 text-center">
                  Nenhum resultado
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface TaskInlineDueDateProps {
  taskId: string;
  dueDate: Date | null;
  isOverdue: boolean;
  isDueToday: boolean;
}

export function TaskInlineDueDate({ taskId, dueDate, isOverdue, isDueToday }: TaskInlineDueDateProps) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const currentVal = dueDate ? format(dueDate, "yyyy-MM-dd") : "";

  function commit(val: string) {
    setEditing(false);
    if (val === currentVal) return;
    startTransition(() => updateTaskDueDateAction(taskId, val || null));
  }

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={currentVal}
        onChange={(e) => commit(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        className="text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none w-32"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true); }}
      disabled={isPending}
      className={`flex items-center gap-1 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors text-xs disabled:opacity-40 ${
        isOverdue ? "text-red-600" :
        isDueToday ? "text-amber-600" :
        "text-neutral-500"
      }`}
    >
      <Clock className="w-3 h-3 text-neutral-400" />
      {dueDate ? format(dueDate, "dd MMM", { locale: ptBR }) : <span className="text-neutral-300">—</span>}
    </button>
  );
}

const PRIORITY_META: Record<string, { label: string; dot: string; text: string }> = {
  low:    { label: "Baixa",   dot: "bg-neutral-300", text: "text-neutral-500" },
  medium: { label: "Média",   dot: "bg-blue-400",    text: "text-blue-600" },
  high:   { label: "Alta",    dot: "bg-orange-400",  text: "text-orange-600" },
  urgent: { label: "Urgente", dot: "bg-red-500",     text: "text-red-600" },
};

export function TaskPriorityChip({ priority }: { priority: string }) {
  const p = PRIORITY_META[priority] ?? PRIORITY_META.medium;
  return (
    <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs">
      <span className={`w-2 h-2 rounded-full ${p.dot}`} />
      <span className={p.text}>{p.label}</span>
    </span>
  );
}
