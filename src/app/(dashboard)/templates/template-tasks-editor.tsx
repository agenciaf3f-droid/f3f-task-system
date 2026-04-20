"use client";

import { useState } from "react";
import { Plus, X, ChevronDown, ChevronRight, GripVertical, Flag, User, Clock } from "lucide-react";

interface Sector { id: string; name: string }
interface User { id: string; name: string }
interface Subtask { id: string; title: string }
export interface TaskRow {
  id: string;
  title: string;
  days: string;
  priority: string;
  assigneeId: string;
  subtasks: Subtask[];
}

const PRIORITY_META: Record<string, { label: string; dot: string; text: string }> = {
  low:    { label: "Baixa",   dot: "bg-neutral-300", text: "text-neutral-500" },
  medium: { label: "Média",   dot: "bg-blue-400",    text: "text-blue-600" },
  high:   { label: "Alta",    dot: "bg-orange-400",  text: "text-orange-600" },
  urgent: { label: "Urgente", dot: "bg-red-500",     text: "text-red-600" },
};

interface Props {
  tasks: TaskRow[];
  setTasks: React.Dispatch<React.SetStateAction<TaskRow[]>>;
  users: User[];
  isPending: boolean;
}

export function TemplateTasksEditor({ tasks, setTasks, users, isPending }: Props) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(
    () => new Set(tasks.filter((t) => t.subtasks.length > 0).map((t) => t.id)),
  );

  function addTask() {
    setTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: "", days: "", priority: "medium", assigneeId: "", subtasks: [] },
    ]);
  }

  function removeTask(id: string) {
    if (tasks.length === 1) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setExpandedTasks((prev) => { const s = new Set(prev); s.delete(id); return s; });
  }

  function updateTask(id: string, field: keyof Omit<TaskRow, "subtasks">, value: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }

  function toggleExpand(id: string) {
    setExpandedTasks((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  function addSubtask(taskId: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: [...t.subtasks, { id: crypto.randomUUID(), title: "" }] }
          : t,
      ),
    );
    setExpandedTasks((prev) => new Set(prev).add(taskId));
  }

  function removeSubtask(taskId: string, subtaskId: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t,
      ),
    );
  }

  function updateSubtask(taskId: string, subtaskId: string, value: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, title: value } : s)) }
          : t,
      ),
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800">Tarefas do template</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {tasks.length} tarefa{tasks.length !== 1 ? "s" : ""} · clique em uma linha para editar
          </p>
        </div>
        <button
          type="button"
          onClick={addTask}
          disabled={isPending}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova tarefa
        </button>
      </div>

      {/* Rows */}
      <div className="divide-y divide-neutral-100">
        {tasks.map((task, i) => {
          const isExpanded = expandedTasks.has(task.id);
          const prio = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
          const assigneeName = users.find((u) => u.id === task.assigneeId)?.name;
          const hasSub = task.subtasks.length > 0;

          return (
            <div key={task.id} className="group">
              {/* Main row */}
              <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-neutral-50/60 transition-colors">
                {/* Drag handle + index */}
                <div className="w-8 shrink-0 flex items-center justify-center text-xs text-neutral-300 group-hover:text-neutral-500 font-medium">
                  <GripVertical className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity absolute" />
                  <span className="group-hover:opacity-0 transition-opacity">{i + 1}</span>
                </div>

                {/* Expand subtasks */}
                <button
                  type="button"
                  onClick={() => {
                    if (!hasSub) addSubtask(task.id);
                    else toggleExpand(task.id);
                  }}
                  disabled={isPending}
                  className="text-neutral-300 hover:text-neutral-600 transition-colors shrink-0"
                  title={hasSub ? "Expandir subtarefas" : "Adicionar subtarefa"}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {/* Title — flat, no border */}
                <input
                  type="text"
                  name="taskTitle[]"
                  value={task.title}
                  onChange={(e) => updateTask(task.id, "title", e.target.value)}
                  placeholder="Digite o título da tarefa..."
                  required
                  disabled={isPending}
                  className="flex-1 text-sm bg-transparent border-none px-1 py-1 focus:outline-none placeholder:text-neutral-300 text-neutral-800 font-medium"
                />

                {/* Chips */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Days chip */}
                  <label className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors cursor-text text-xs">
                    <Clock className="w-3 h-3 text-neutral-400" />
                    <input
                      type="number"
                      name="taskDays[]"
                      value={task.days}
                      onChange={(e) => updateTask(task.id, "days", e.target.value)}
                      placeholder="—"
                      min={0}
                      disabled={isPending}
                      title="Dias antes da data de início"
                      className="w-8 text-xs bg-transparent border-none focus:outline-none text-neutral-700 placeholder:text-neutral-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-neutral-400">d</span>
                  </label>

                  {/* Priority chip */}
                  <label className="relative flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors cursor-pointer text-xs">
                    <span className={`w-2 h-2 rounded-full ${prio.dot}`} />
                    <span className={prio.text}>{prio.label}</span>
                    <select
                      name="taskPriority[]"
                      value={task.priority}
                      onChange={(e) => updateTask(task.id, "priority", e.target.value)}
                      disabled={isPending}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </label>

                  {/* Assignee chip */}
                  {users.length > 0 ? (
                    <label className="relative flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors cursor-pointer text-xs max-w-[140px]">
                      {assigneeName ? (
                        <>
                          <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                            {assigneeName.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-neutral-700 truncate">{assigneeName.split(" ")[0]}</span>
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3 text-neutral-400" />
                          <span className="text-neutral-400">Atribuir</span>
                        </>
                      )}
                      <select
                        name="taskAssigneeId[]"
                        value={task.assigneeId}
                        onChange={(e) => updateTask(task.id, "assigneeId", e.target.value)}
                        disabled={isPending}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      >
                        <option value="">Sem responsável</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </label>
                  ) : (
                    <input type="hidden" name="taskAssigneeId[]" value="" />
                  )}

                  {/* Subtasks counter */}
                  {hasSub && (
                    <span className="text-[10px] text-neutral-400 px-1.5">
                      {task.subtasks.length} sub
                    </span>
                  )}

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    disabled={tasks.length === 1 || isPending}
                    className="text-neutral-300 hover:text-red-500 disabled:opacity-0 transition-colors p-1 opacity-0 group-hover:opacity-100"
                    title="Remover tarefa"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Subtasks */}
              {isExpanded && (
                <div className="pl-[72px] pr-5 pb-3 pt-1 flex flex-col gap-1">
                  {task.subtasks.map((st) => (
                    <div key={st.id} className="flex items-center gap-2 group/sub">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
                      <input
                        type="text"
                        value={st.title}
                        onChange={(e) => updateSubtask(task.id, st.id, e.target.value)}
                        placeholder="Subtarefa..."
                        disabled={isPending}
                        className="flex-1 text-xs bg-transparent border-none px-1 py-1 focus:outline-none focus:bg-neutral-50 rounded placeholder:text-neutral-300 text-neutral-700"
                      />
                      <button
                        type="button"
                        onClick={() => removeSubtask(task.id, st.id)}
                        disabled={isPending}
                        className="text-neutral-300 hover:text-red-500 opacity-0 group-hover/sub:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addSubtask(task.id)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-blue-600 transition-colors mt-1 self-start px-1"
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar subtarefa
                  </button>
                </div>
              )}

              {/* Hidden subtasks payload */}
              <input
                type="hidden"
                name="taskSubtasks[]"
                value={JSON.stringify(task.subtasks.map((s) => ({ title: s.title })))}
              />
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="px-5 py-3 bg-neutral-50/50 border-t border-neutral-100">
        <p className="text-[11px] text-neutral-400">
          <Flag className="w-3 h-3 inline mr-1" />
          <strong className="text-neutral-600">Dias:</strong> quantos dias <em>antes</em> da data de início a tarefa deve ser concluída.
        </p>
      </div>
    </div>
  );
}
