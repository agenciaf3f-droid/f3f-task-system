"use client";

import { useState, useTransition, useRef, useEffect, useMemo, useCallback, memo } from "react";
import { ChevronDown, ChevronRight, Plus, Loader2, CheckSquare, X, CheckCircle2, UserCheck, Trash2, GripVertical } from "lucide-react";
import { isBefore, isToday } from "date-fns";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskCheckbox, TaskInlineAssignee, TaskInlineDueDate, TaskInlineTitle } from "./task-inline-edit";
import { addSubtaskAction, bulkUpdateTaskStatusAction, bulkAssignAction, bulkDeleteAction, reorderTasksAction } from "@/app/(dashboard)/tarefas/actions";
import type { TaskStatus } from "@prisma/client";
import { TaskBlockedIndicator } from "@/components/tasks/task-blocked-indicator";

function AddSubtaskInline({ parentTaskId }: { parentTaskId: string }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function submit() {
    const t = title.trim();
    if (!t) { setEditing(false); return; }
    startTransition(async () => {
      await addSubtaskAction(parentTaskId, t);
      setTitle("");
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-blue-600 transition-colors px-1 py-0.5 self-start"
      >
        <Plus className="w-3 h-3" />
        Adicionar subtarefa
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          if (e.key === "Escape") { setTitle(""); setEditing(false); }
        }}
        onBlur={submit}
        disabled={isPending}
        placeholder="Título da subtarefa..."
        className="flex-1 text-xs border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
      />
      {isPending && <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  todo: "A ser iniciado",
  in_progress: "Em andamento",
  review: "Revisão",
  blocked: "Ajustes",
  done: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_STYLES: Record<string, string> = {
  todo: "text-neutral-500 bg-neutral-100 border-neutral-200",
  in_progress: "text-blue-600 bg-blue-50 border-blue-200",
  review: "text-amber-600 bg-amber-50 border-amber-200",
  blocked: "text-rose-600 bg-rose-50 border-rose-200",
  done: "text-emerald-600 bg-emerald-50 border-emerald-200",
  cancelled: "text-neutral-400 bg-neutral-50 border-neutral-200",
};

type Assignee = { id: string; name: string; avatarUrl: string | null } | null;

type Subtask = {
  id: string;
  title: string;
  status: string;
  isBlocked: boolean;
  dueDate: Date | null;
  assignee: Assignee;
};

type Task = {
  id: string;
  title: string;
  status: string;
  isBlocked: boolean;
  priority: string;
  dueDate: Date | null;
  metadata: unknown;
  assignee: Assignee;
  sector: { name: string; color: string | null } | null;
  _count: { checklistItems: number; comments: number };
  subtasks: Subtask[];
};

type UserLite = { id: string; name: string; avatarUrl: string | null };

interface TaskListProps {
  tasks: Task[];
  users: UserLite[];
  projectId: string;
}

function DragHandle({ attributes, listeners }: { attributes: DraggableAttributes; listeners: SyntheticListenerMap | undefined }) {
  return (
    <button
      {...attributes}
      {...listeners}
      className="shrink-0 cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-500 opacity-0 group-hover/row:opacity-100 transition-opacity touch-none"
      aria-label="Arrastar para reordenar"
      onClick={(e) => e.preventDefault()}
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );
}

function BulkToolbar({
  selected,
  users,
  onClear,
}: {
  selected: string[];
  users: UserLite[];
  onClear: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [showAssign, setShowAssign] = useState(false);

  function markDone() {
    startTransition(async () => {
      await bulkUpdateTaskStatusAction(selected, "done" as TaskStatus);
      onClear();
    });
  }

  function assign(userId: string) {
    setShowAssign(false);
    startTransition(async () => {
      await bulkAssignAction(selected, userId);
      onClear();
    });
  }

  function remove() {
    if (!confirm(`Excluir ${selected.length} tarefa(s)?`)) return;
    startTransition(async () => {
      await bulkDeleteAction(selected);
      onClear();
    });
  }

  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-2.5 bg-blue-600 text-white text-sm rounded-t-xl">
      <CheckSquare className="w-4 h-4 shrink-0" />
      <span className="font-medium">{selected.length} selecionada{selected.length !== 1 ? "s" : ""}</span>

      <div className="flex items-center gap-1.5 ml-auto">
        {/* Mark done */}
        <button
          onClick={markDone}
          disabled={isPending}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 transition-colors text-xs font-medium"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Marcar done
        </button>

        {/* Assign */}
        <div className="relative">
          <button
            onClick={() => setShowAssign((v) => !v)}
            disabled={isPending}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 transition-colors text-xs font-medium"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Atribuir
          </button>
          {showAssign && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowAssign(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 w-48 max-h-56 overflow-y-auto">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onMouseDown={() => assign(u.id)}
                    className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors truncate"
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={remove}
          disabled={isPending}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/80 hover:bg-red-500 transition-colors text-xs font-medium"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Excluir
        </button>

        {/* Clear */}
        <button
          onClick={onClear}
          className="ml-1 p-1 rounded hover:bg-white/20 transition-colors"
          title="Limpar seleção"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3" />}
    </div>
  );
}

function SubtaskRow({
  sub,
  projectId,
  users,
  now,
}: {
  sub: Subtask;
  projectId: string;
  users: UserLite[];
  now: Date;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  const subOverdue = sub.dueDate && isBefore(sub.dueDate, now) && sub.status !== "done";
  const subToday = sub.dueDate && isToday(sub.dueDate);

  return (
    <div ref={setNodeRef} style={style} className="group flex items-center gap-2 group/row">
      <DragHandle attributes={attributes} listeners={listeners} />
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
      <TaskCheckbox taskId={sub.id} isDone={sub.status === "done"} />
      <TaskInlineTitle
        taskId={sub.id}
        title={sub.title}
        href={`/tarefas/${sub.id}?projectId=${projectId}`}
        isDone={sub.status === "done"}
        size="sm"
      />
      {sub.isBlocked && <TaskBlockedIndicator />}
      <div className="flex items-center shrink-0">
        <div className="w-32 flex justify-end">
          <TaskInlineAssignee taskId={sub.id} assignee={sub.assignee} users={users} />
        </div>
        <div className="w-24 flex justify-end">
          <TaskInlineDueDate
            taskId={sub.id}
            dueDate={sub.dueDate}
            isOverdue={!!subOverdue}
            isDueToday={!!subToday}
          />
        </div>
        <div className="w-28 flex justify-end pr-1">
          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${
            STATUS_STYLES[sub.status] ?? STATUS_STYLES.todo
          }`}>
            {STATUS_LABELS[sub.status] ?? sub.status}
          </span>
        </div>
      </div>
    </div>
  );
}

type TaskRowProps = {
  task: Task;
  idx: number;
  projectId: string;
  users: UserLite[];
  isCollapsed: boolean;
  isSelected: boolean;
  now: Date;
  activeSubtasks: Subtask[];
  onSelect: (id: string) => void;
  onCollapse: (id: string) => void;
  onReorderSubtasks: (parentId: string, orderedIds: string[]) => void;
};

const TaskRow = memo(function TaskRow({
  task,
  idx,
  projectId,
  users,
  isCollapsed,
  isSelected,
  now,
  activeSubtasks,
  onSelect,
  onCollapse,
  onReorderSubtasks,
}: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  const isOverdue = task.dueDate && isBefore(task.dueDate, now) && task.status !== "done";
  const isDueToday = task.dueDate && isToday(task.dueDate);
  const hasSub = activeSubtasks.length > 0;

  const subSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleSubDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = activeSubtasks.map((s) => s.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorderSubtasks(task.id, arrayMove(ids, oldIdx, newIdx));
  }

  return (
    <div ref={setNodeRef} style={style} className={`group/row ${isSelected ? "bg-blue-50/60" : ""}`}>
      {/* Main row — `group` (plain) p/ o lápis Renomear e edits inline (group-hover) */}
      <div className="group flex items-center gap-2 px-4 py-2.5 hover:bg-neutral-50/60 transition-colors">
        {/* Drag handle */}
        <DragHandle attributes={attributes} listeners={listeners} />

        {/* Index */}
        <div className="w-6 shrink-0 text-xs text-neutral-300 font-medium text-center select-none">
          {idx + 1}
        </div>

        {/* Selection checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(task.id)}
          className="w-3.5 h-3.5 rounded border-neutral-300 accent-blue-600 cursor-pointer shrink-0"
        />

        {/* Chevron */}
        <button
          onClick={() => hasSub && onCollapse(task.id)}
          className={`shrink-0 transition-colors ${
            hasSub
              ? "text-neutral-400 hover:text-neutral-700 cursor-pointer"
              : "text-neutral-200 cursor-default pointer-events-none"
          }`}
          tabIndex={hasSub ? 0 : -1}
          aria-label={isCollapsed ? "Expandir subtarefas" : "Recolher subtarefas"}
        >
          {hasSub && !isCollapsed
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Checkbox de status */}
        <TaskCheckbox taskId={task.id} isDone={task.status === "done"} />

        {/* Title */}
        <TaskInlineTitle
          taskId={task.id}
          title={task.title}
          href={`/tarefas/${task.id}?projectId=${projectId}`}
          isDone={task.status === "done"}
        />
        {task.isBlocked && <TaskBlockedIndicator />}

        {/* Colunas fixas */}
        <div className="flex items-center shrink-0">
          <div className="w-32 flex justify-end">
            <TaskInlineAssignee taskId={task.id} assignee={task.assignee} users={users} />
          </div>
          <div className="w-24 flex justify-end">
            <TaskInlineDueDate
              taskId={task.id}
              dueDate={task.dueDate}
              isOverdue={!!isOverdue}
              isDueToday={!!isDueToday}
            />
          </div>
          <div className="w-28 flex justify-end pr-1">
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${
              STATUS_STYLES[task.status] ?? STATUS_STYLES.todo
            }`}>
              {STATUS_LABELS[task.status] ?? task.status}
            </span>
          </div>
        </div>
      </div>

      {/* Subtarefas */}
      {hasSub && !isCollapsed && (
        <div className="pl-[84px] pr-4 pb-3 pt-1 flex flex-col gap-1.5 border-t border-neutral-50">
          <DndContext sensors={subSensors} collisionDetection={closestCenter} onDragEnd={handleSubDragEnd}>
            <SortableContext items={activeSubtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {activeSubtasks.map((sub) => (
                <SubtaskRow key={sub.id} sub={sub} projectId={projectId} users={users} now={now} />
              ))}
            </SortableContext>
          </DndContext>
          <AddSubtaskInline parentTaskId={task.id} />
        </div>
      )}
      {!hasSub && (
        <div className="pl-[84px] pr-4 pb-2 pt-0.5 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
          <AddSubtaskInline parentTaskId={task.id} />
        </div>
      )}
    </div>
  );
});

export function TaskList({ tasks, users, projectId }: TaskListProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const now = useMemo(() => new Date(), []);

  const visible = useMemo(
    () => tasks.filter((t) => t.status !== "cancelled"),
    [tasks]
  );

  // Ordem local pra drag otimista. Resync quando os ids do prop mudam.
  const [order, setOrder] = useState<Task[]>(visible);
  useEffect(() => {
    setOrder(visible);
  }, [visible]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleTaskDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const ids = prev.map((t) => t.id);
      const oldIdx = ids.indexOf(active.id as string);
      const newIdx = ids.indexOf(over.id as string);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      void reorderTasksAction(next.map((t) => t.id));
      return next;
    });
  }, []);

  const handleReorderSubtasks = useCallback((parentId: string, orderedIds: string[]) => {
    setOrder((prev) =>
      prev.map((t) => {
        if (t.id !== parentId) return t;
        const byId = new Map(t.subtasks.map((s) => [s.id, s]));
        const reordered = orderedIds.map((id) => byId.get(id)).filter((s): s is Subtask => !!s);
        const rest = t.subtasks.filter((s) => !orderedIds.includes(s.id));
        return { ...t, subtasks: [...reordered, ...rest] };
      })
    );
    void reorderTasksAction(orderedIds);
  }, []);

  const subtasksByTask = useMemo(() => {
    const m = new Map<string, Subtask[]>();
    for (const t of order) {
      m.set(t.id, t.subtasks.filter((s) => s.status !== "cancelled"));
    }
    return m;
  }, [order]);

  function toggleAll() {
    if (selected.size === order.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(order.map((t) => t.id)));
    }
  }

  const allSelected = order.length > 0 && selected.size === order.length;

  return (
    <>
      {selected.size > 0 && (
        <BulkToolbar
          selected={[...selected]}
          users={users}
          onClear={() => setSelected(new Set())}
        />
      )}
      <div className="divide-y divide-neutral-100 group/list">
        {/* Header row */}
        <div className="flex items-center gap-2 px-4 py-2 bg-neutral-50/80 border-b border-neutral-100">
          <div className="w-4 shrink-0" />
          <div className="w-6 shrink-0" />
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-3.5 h-3.5 rounded border-neutral-300 accent-blue-600 cursor-pointer shrink-0"
            title="Selecionar todas"
          />
          <span className="flex-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wide pl-9">Tarefa</span>
          <div className="flex items-center shrink-0">
            <div className="w-32 text-right text-[11px] font-semibold text-neutral-400 uppercase tracking-wide pr-2">Responsável</div>
            <div className="w-24 text-right text-[11px] font-semibold text-neutral-400 uppercase tracking-wide pr-2">Data</div>
            <div className="w-28 text-right text-[11px] font-semibold text-neutral-400 uppercase tracking-wide pr-1">Status</div>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
          <SortableContext items={order.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {order.map((task, idx) => (
              <TaskRow
                key={task.id}
                task={task}
                idx={idx}
                projectId={projectId}
                users={users}
                isCollapsed={collapsedIds.has(task.id)}
                isSelected={selected.has(task.id)}
                now={now}
                activeSubtasks={subtasksByTask.get(task.id) ?? []}
                onSelect={toggleSelect}
                onCollapse={toggleCollapse}
                onReorderSubtasks={handleReorderSubtasks}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </>
  );
}
