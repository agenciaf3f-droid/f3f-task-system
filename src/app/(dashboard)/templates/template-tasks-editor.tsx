"use client";

import { useState } from "react";
import { Plus, X, GripVertical, User, Clock, FileText, CheckSquare, Pencil, ArrowLeft, FolderOpen } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface User { id: string; name: string; avatarUrl?: string | null }
interface Subtask { id: string; title: string }
export interface TaskRow {
  id: string;
  title: string;
  description: string;
  days: string;
  priority: string;
  assigneeId: string;
  subtasks: Subtask[];
}

interface Props {
  tasks: TaskRow[];
  setTasks: React.Dispatch<React.SetStateAction<TaskRow[]>>;
  users: User[];
  isPending: boolean;
  templateName?: string;
}

export function TemplateTasksEditor({ tasks, setTasks, users, isPending, templateName }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  function addTask() {
    const newId = crypto.randomUUID();
    setTasks((prev) => [
      ...prev,
      { id: newId, title: "", description: "", days: "", priority: "medium", assigneeId: "", subtasks: [] },
    ]);
    setEditingId(newId);
  }

  function removeTask(id: string) {
    if (tasks.length === 1) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function updateTask(id: string, field: keyof Omit<TaskRow, "subtasks">, value: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }

  function addSubtask(taskId: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: [...t.subtasks, { id: crypto.randomUUID(), title: "" }] }
          : t,
      ),
    );
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

  const editingTask = editingId ? tasks.find((t) => t.id === editingId) ?? null : null;
  function closeModal() { setEditingId(null); }

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
          const assigneeUser = users.find((u) => u.id === task.assigneeId);
          const hasSub = task.subtasks.length > 0;
          const hasDesc = (task.description ?? "").trim() !== "";

          return (
            <div key={task.id} className="group">
              <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-neutral-50/60 transition-colors">
                {/* Drag handle + index */}
                <div className="w-8 shrink-0 flex items-center justify-center text-xs text-neutral-300 group-hover:text-neutral-500 font-medium relative">
                  <GripVertical className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity absolute" />
                  <span className="group-hover:opacity-0 transition-opacity">{i + 1}</span>
                </div>

                {/* Title — click opens modal */}
                <button
                  type="button"
                  onClick={() => setEditingId(task.id)}
                  disabled={isPending}
                  className="flex-1 text-left text-sm px-1 py-1 hover:text-blue-600 transition-colors truncate text-neutral-800 font-medium"
                >
                  {task.title || <span className="text-neutral-300 italic">Sem título — clique para editar</span>}
                </button>

                {/* Indicators */}
                <div className="flex items-center gap-1 shrink-0 text-[10px] text-neutral-400">
                  {hasDesc && <FileText className="w-3 h-3" />}
                  {hasSub && (
                    <span className="flex items-center gap-0.5">
                      <CheckSquare className="w-3 h-3" />
                      {task.subtasks.length}
                    </span>
                  )}
                </div>

                {/* Chips */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Days */}
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

                  {/* Assignee */}
                  {users.length > 0 ? (
                    <label className="relative flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors cursor-pointer text-xs max-w-[140px]">
                      {assigneeUser ? (
                        <>
                          <UserAvatar name={assigneeUser.name} src={assigneeUser.avatarUrl ?? null} size={16} />
                          <span className="text-neutral-700 truncate">{assigneeUser.name.split(" ")[0]}</span>
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

                  {/* Edit button */}
                  <button
                    type="button"
                    onClick={() => setEditingId(task.id)}
                    disabled={isPending}
                    className="text-neutral-300 hover:text-blue-600 transition-colors p-1"
                    title="Editar tarefa"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

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

              {/* Hidden payloads pra o POST do form */}
              <input type="hidden" name="taskTitle[]" value={task.title} />
              <input type="hidden" name="taskPriority[]" value={task.priority} />
              <input type="hidden" name="taskDescription[]" value={task.description} />
              <input
                type="hidden"
                name="taskSubtasks[]"
                value={JSON.stringify(task.subtasks.map((s) => ({ title: s.title })))}
              />
            </div>
          );
        })}
      </div>

      {/* Edit modal — visual idêntico ao /tarefas/nova */}
      <Dialog open={editingTask !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {editingTask && (
            <div className="p-6">
              {/* Header com breadcrumb + título grande */}
              <div className="flex items-center gap-3 mb-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-neutral-500 hover:text-neutral-900 transition-colors"
                  title="Voltar"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  {templateName && (
                    <p className="text-xs text-neutral-400 flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5" />
                      {templateName}
                    </p>
                  )}
                  <h1 className="text-2xl font-semibold text-neutral-900">Editar tarefa</h1>
                </div>
              </div>

              {/* Card branco com inputs */}
              <div className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col gap-5">
                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-task-title">Título <span className="text-red-500">*</span></Label>
                  <Input
                    id="tpl-task-title"
                    type="text"
                    value={editingTask.title}
                    onChange={(e) => updateTask(editingTask.id, "title", e.target.value)}
                    placeholder="Descreva a tarefa claramente..."
                    disabled={isPending}
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-task-desc">Descrição</Label>
                  <textarea
                    id="tpl-task-desc"
                    value={editingTask.description}
                    onChange={(e) => updateTask(editingTask.id, "description", e.target.value)}
                    disabled={isPending}
                    rows={4}
                    placeholder="Detalhes, contexto, instruções..."
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                </div>

                {/* Responsável */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-task-assignee">Responsável</Label>
                  <select
                    id="tpl-task-assignee"
                    value={editingTask.assigneeId}
                    onChange={(e) => updateTask(editingTask.id, "assigneeId", e.target.value)}
                    disabled={isPending}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Sem responsável</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {/* Dias antes do início */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-task-days">Dias antes do início</Label>
                  <Input
                    id="tpl-task-days"
                    type="number"
                    min={0}
                    value={editingTask.days}
                    onChange={(e) => updateTask(editingTask.id, "days", e.target.value)}
                    disabled={isPending}
                    placeholder="—"
                  />
                </div>

                {/* Subtarefas */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label>
                      Subtarefas
                      {editingTask.subtasks.length > 0 && (
                        <span className="text-neutral-400 font-normal ml-1">({editingTask.subtasks.length})</span>
                      )}
                    </Label>
                    <button
                      type="button"
                      onClick={() => addSubtask(editingTask.id)}
                      disabled={isPending}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="w-3 h-3" /> Adicionar
                    </button>
                  </div>
                  {editingTask.subtasks.length === 0 ? (
                    <p className="text-xs text-neutral-400 italic">Nenhuma subtarefa.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {editingTask.subtasks.map((st) => (
                        <div key={st.id} className="flex items-center gap-2 group/sub">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
                          <input
                            type="text"
                            value={st.title}
                            onChange={(e) => updateSubtask(editingTask.id, st.id, e.target.value)}
                            placeholder="Subtarefa..."
                            disabled={isPending}
                            className="flex-1 text-sm bg-transparent border-none px-1 py-1 focus:outline-none focus:bg-neutral-50 rounded placeholder:text-neutral-300 text-neutral-700"
                          />
                          <button
                            type="button"
                            onClick={() => removeSubtask(editingTask.id, st.id)}
                            disabled={isPending}
                            className="text-neutral-300 hover:text-red-500 opacity-0 group-hover/sub:opacity-100 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botões — igual ao /tarefas/nova: azul + outline */}
                <div className="flex gap-3 pt-1">
                  <Button type="button" onClick={closeModal} disabled={isPending}>
                    Salvar
                  </Button>
                  <Button type="button" variant="outline" onClick={closeModal} disabled={isPending}>
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
