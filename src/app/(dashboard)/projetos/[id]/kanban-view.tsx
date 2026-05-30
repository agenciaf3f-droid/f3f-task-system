"use client";

import { memo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import { isBefore, isToday, format } from "date-fns";
import { Calendar, User, AlertCircle } from "lucide-react";
import { updateTaskStatusAction } from "@/app/(dashboard)/tarefas/actions";

type Assignee = { id: string; name: string; avatarUrl: string | null } | null;

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  assignee: Assignee;
  sector: { name: string; color: string | null } | null;
  _count: { checklistItems: number; comments: number };
  subtasks: { id: string; status: string }[];
};

type Column = { id: string; label: string; color: string; bg: string };

const COLUMNS: Column[] = [
  { id: "todo",        label: "A fazer",       color: "text-neutral-600", bg: "bg-neutral-50"  },
  { id: "in_progress", label: "Em andamento",  color: "text-blue-600",    bg: "bg-blue-50"     },
  { id: "review",      label: "Em revisão",    color: "text-amber-600",   bg: "bg-amber-50"    },
  { id: "blocked",     label: "Bloqueado",     color: "text-red-600",     bg: "bg-red-50"      },
  { id: "done",        label: "Concluído",     color: "text-emerald-600", bg: "bg-emerald-50"  },
];

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high:   "bg-orange-400",
  medium: "bg-yellow-400",
  low:    "bg-neutral-300",
};

const KanbanCard = memo(function KanbanCard({ task, isDragging }: { task: Task; isDragging?: boolean }) {
  const overdue = task.dueDate && !isToday(task.dueDate) && isBefore(task.dueDate, new Date()) && task.status !== "done";

  return (
    <div className={`bg-white border rounded-xl p-3 select-none cursor-grab active:cursor-grabbing shadow-sm transition-shadow ${
      isDragging ? "shadow-lg opacity-80 rotate-1" : "border-neutral-200 hover:shadow-md"
    }`}>
      <div className="flex items-start gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${PRIORITY_DOT[task.priority] ?? "bg-neutral-300"}`} />
        <Link
          href={`/tarefas/${task.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium text-neutral-900 leading-snug hover:text-blue-600 transition-colors line-clamp-2"
        >
          {task.title}
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap pl-4">
        {task.assignee && (
          <span className="flex items-center gap-1 text-xs text-neutral-500">
            <User className="w-3 h-3" />
            {task.assignee.name.split(" ")[0]}
          </span>
        )}
        {task.dueDate && (
          <span className={`flex items-center gap-1 text-xs ${overdue ? "text-red-600 font-medium" : "text-neutral-400"}`}>
            {overdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
            {format(task.dueDate, "dd/MM")}
          </span>
        )}
        {task.sector && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full border"
            style={{
              color: task.sector.color ?? "#6b7280",
              borderColor: task.sector.color ?? "#e5e7eb",
              backgroundColor: task.sector.color ? `${task.sector.color}15` : "#f9fafb",
            }}
          >
            {task.sector.name}
          </span>
        )}
        {task._count.checklistItems > 0 && (
          <span className="text-xs text-neutral-400">
            ✓ {task.subtasks.filter((s) => s.status === "done").length}/{task._count.checklistItems}
          </span>
        )}
      </div>
    </div>
  );
});

const DraggableCard = memo(function DraggableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <KanbanCard task={task} isDragging={isDragging} />
    </div>
  );
});

function KanbanColumn({ column, tasks }: { column: Column; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <div className="flex flex-col min-w-[260px] w-[260px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`text-xs font-semibold uppercase tracking-wide ${column.color}`}>{column.label}</span>
        <span className="text-xs text-neutral-400 bg-neutral-100 rounded-full px-1.5 py-0.5">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 flex-1 min-h-[80px] p-2 rounded-xl transition-colors ${
          isOver ? "bg-blue-50 border-2 border-blue-200 border-dashed" : column.bg
        }`}
      >
        {tasks.map((t) => <DraggableCard key={t.id} task={t} />)}
      </div>
    </div>
  );
}

export function KanbanView({ tasks }: { tasks: Task[] }) {
  const [taskList, setTaskList] = useState(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const activeTask = activeId ? taskList.find((t) => t.id === activeId) : null;

  function groupByStatus() {
    const groups: Record<string, Task[]> = {};
    for (const col of COLUMNS) groups[col.id] = [];
    for (const t of taskList) {
      if (groups[t.status]) groups[t.status].push(t);
      else groups["todo"].push(t);
    }
    return groups;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const newStatus = String(over.id);
    if (!COLUMNS.find((c) => c.id === newStatus)) return;

    const task = taskList.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    setTaskList((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    updateTaskStatusAction(taskId, newStatus as never).catch(() => {
      // Revert on error
      setTaskList((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t));
    });
  }

  const groups = groupByStatus();

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <KanbanColumn key={col.id} column={col} tasks={groups[col.id]} />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <KanbanCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
