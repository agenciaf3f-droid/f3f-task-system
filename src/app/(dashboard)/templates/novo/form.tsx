"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { createTemplateAction } from "../actions";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, Loader2, AlertCircle, X, ChevronDown, ChevronRight } from "lucide-react";

interface Sector { id: string; name: string }
interface User { id: string; name: string }
interface Subtask { id: string; title: string }
interface TaskRow {
  id: string;
  title: string;
  days: string;
  priority: string;
  assigneeId: string;
  subtasks: Subtask[];
}

export function NewTemplateForm({ sectors, users }: { sectors: Sector[]; users: User[] }) {
  const [state, action, isPending] = useActionState<{ error?: string }, FormData>(
    createTemplateAction,
    {},
  );
  const [tasks, setTasks] = useState<TaskRow[]>([
    { id: crypto.randomUUID(), title: "", days: "", priority: "medium", assigneeId: "", subtasks: [] },
  ]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

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
      if (s.has(id)) s.delete(id);
      else s.add(id);
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
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/templates" className="text-neutral-500 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900">Novo template</h1>
      </div>

      <form action={action} className="flex flex-col gap-6">
        {/* Template info */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-neutral-700">Informações do template</h2>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" placeholder="Ex: Onboarding de cliente" required disabled={isPending} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" name="description" placeholder="Para que serve este template?" disabled={isPending} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Categoria</Label>
              <Input id="category" name="category" placeholder="Ex: Comercial, Ops..." disabled={isPending} />
            </div>
            {sectors.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sectorId">Setor</Label>
                <select
                  id="sectorId"
                  name="sectorId"
                  disabled={isPending}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Todos os setores</option>
                  {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Template tasks */}
        <div className="bg-white border border-neutral-200 rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">
              Tarefas do template
              <span className="text-xs font-normal text-neutral-400 ml-2">({tasks.length})</span>
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={addTask} className="text-xs h-7">
              <Plus className="w-3.5 h-3.5 mr-1" />Adicionar tarefa
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {tasks.map((task, i) => {
              const isExpanded = expandedTasks.has(task.id);
              return (
                <div key={task.id} className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50/50">
                  {/* Main row */}
                  <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                    <span className="text-xs text-neutral-400 w-5 shrink-0 text-right">{i + 1}.</span>
                    <input
                      type="text"
                      name="taskTitle[]"
                      value={task.title}
                      onChange={(e) => updateTask(task.id, "title", e.target.value)}
                      placeholder="Título da tarefa..."
                      required
                      disabled={isPending}
                      className="flex-1 text-sm bg-transparent border-b border-neutral-200 px-1 py-0.5 focus:outline-none focus:border-violet-400 placeholder:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => removeTask(task.id)}
                      disabled={tasks.length === 1 || isPending}
                      className="text-neutral-300 hover:text-red-500 disabled:opacity-20 transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Secondary row */}
                  <div className="flex items-center gap-2 px-3 pb-3 pl-10">
                    <input
                      type="number"
                      name="taskDays[]"
                      value={task.days}
                      onChange={(e) => updateTask(task.id, "days", e.target.value)}
                      placeholder="Dias"
                      min={0}
                      disabled={isPending}
                      title="Prazo relativo em dias"
                      className="w-16 text-xs border border-neutral-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400 text-center bg-white"
                    />
                    <select
                      name="taskPriority[]"
                      value={task.priority}
                      onChange={(e) => updateTask(task.id, "priority", e.target.value)}
                      disabled={isPending}
                      className="text-xs border border-neutral-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                    {users.length > 0 && (
                      <select
                        name="taskAssigneeId[]"
                        value={task.assigneeId}
                        onChange={(e) => updateTask(task.id, "assigneeId", e.target.value)}
                        disabled={isPending}
                        className="flex-1 text-xs border border-neutral-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                      >
                        <option value="">Responsável padrão</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    )}
                    {users.length === 0 && (
                      <input type="hidden" name="taskAssigneeId[]" value="" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (task.subtasks.length === 0) addSubtask(task.id);
                        else toggleExpand(task.id);
                      }}
                      disabled={isPending}
                      className="ml-auto flex items-center gap-1 text-xs text-neutral-400 hover:text-violet-600 transition-colors shrink-0"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {task.subtasks.length > 0 ? `${task.subtasks.length} subtarefa${task.subtasks.length !== 1 ? "s" : ""}` : "Subtarefas"}
                    </button>
                  </div>

                  {/* Subtasks section */}
                  {isExpanded && (
                    <div className="border-t border-neutral-100 px-3 py-3 pl-10 flex flex-col gap-2 bg-white">
                      {task.subtasks.map((st) => (
                        <div key={st.id} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0 ml-1" />
                          <input
                            type="text"
                            value={st.title}
                            onChange={(e) => updateSubtask(task.id, st.id, e.target.value)}
                            placeholder="Título da subtarefa..."
                            disabled={isPending}
                            className="flex-1 text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400 placeholder:text-neutral-400"
                          />
                          <button
                            type="button"
                            onClick={() => removeSubtask(task.id, st.id)}
                            disabled={isPending}
                            className="text-neutral-300 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addSubtask(task.id)}
                        disabled={isPending}
                        className="flex items-center gap-1 text-xs text-neutral-400 hover:text-violet-600 transition-colors mt-1"
                      >
                        <Plus className="w-3 h-3" />
                        Adicionar subtarefa
                      </button>
                    </div>
                  )}

                  {/* Hidden input for subtasks */}
                  <input
                    type="hidden"
                    name="taskSubtasks[]"
                    value={JSON.stringify(task.subtasks.map((s) => ({ title: s.title })))}
                  />
                </div>
              );
            })}
          </div>

          <p className="text-xs text-neutral-400">
            <strong>Dias:</strong> prazo relativo a partir da data de início (ex: 2 = 2 dias depois)
          </p>
        </div>

        {state.error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {state.error}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar template
          </Button>
          <LinkButton variant="outline" href="/templates">Cancelar</LinkButton>
        </div>
      </form>
    </div>
  );
}
