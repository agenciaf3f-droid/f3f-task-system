"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { updateTaskAssigneeAction, updateTaskDueDateAction, updateTaskStatusAction } from "@/app/(dashboard)/tarefas/actions";

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
      className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-all duration-150 ${
        isDone
          ? "bg-emerald-500 border-emerald-500"
          : "border-neutral-300 hover:border-emerald-400 hover:bg-emerald-50"
      } disabled:opacity-40 cursor-pointer`}
    >
      {isDone && (
        <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

interface User { id: string; name: string }

interface TaskInlineAssigneeProps {
  taskId: string;
  assignee: { id: string; name: string } | null;
  users: User[];
}

export function TaskInlineAssignee({ taskId, assignee, users }: TaskInlineAssigneeProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSelect(userId: string) {
    setOpen(false);
    startTransition(() => updateTaskAssigneeAction(taskId, userId || null));
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        disabled={isPending}
        className="flex items-center gap-1.5 hover:bg-neutral-100 rounded-md px-1.5 py-0.5 transition-colors disabled:opacity-40"
      >
        <span className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-700 text-[11px] font-semibold flex items-center justify-center shrink-0">
          {assignee ? assignee.name.charAt(0) : "?"}
        </span>
        <span className="text-xs text-neutral-600 max-w-[80px] truncate hidden sm:inline">
          {assignee ? assignee.name.split(" ")[0] : "Sem responsável"}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-44 max-h-48 overflow-y-auto">
            <button
              onClick={() => handleSelect("")}
              className="w-full text-left px-3 py-2 text-xs text-neutral-500 hover:bg-neutral-50 transition-colors"
            >
              Sem responsável
            </button>
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelect(u.id)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-neutral-50 flex items-center gap-2 ${
                  u.id === assignee?.id ? "font-semibold text-neutral-900" : "text-neutral-700"
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                  {u.name.charAt(0)}
                </span>
                {u.name.split(" ")[0]}
              </button>
            ))}
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setEditing(false);
    startTransition(() => updateTaskDueDateAction(taskId, val || null));
  }

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={dueDate ? format(dueDate, "yyyy-MM-dd") : ""}
        onChange={handleChange}
        onBlur={() => setEditing(false)}
        className="text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none w-32"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      />
    );
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true); }}
      disabled={isPending}
      className={`text-xs whitespace-nowrap transition-colors hover:underline disabled:opacity-40 ${
        isOverdue ? "text-red-600 font-medium" :
        isDueToday ? "text-amber-600 font-medium" :
        "text-neutral-500 hover:text-neutral-800"
      }`}
    >
      {dueDate ? format(dueDate, "dd MMM", { locale: ptBR }) : <span className="text-neutral-300">+ data</span>}
    </button>
  );
}
