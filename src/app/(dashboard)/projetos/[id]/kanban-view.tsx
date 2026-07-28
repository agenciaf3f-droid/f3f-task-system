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

// Cor por status: dot + label + tint sutil da coluna. Como as colunas têm altura
// natural (items-start) o tint claro vira color-coding elegante, não bloco cheio.
const STATUS_DOT: Record<string, string> = {
  todo:        "bg-slate-400",
  in_progress: "bg-blue-500",
  review:      "bg-amber-500",
  blocked:     "bg-rose-500",
  done:        "bg-emerald-500",
};

const STATUS_TEXT: Record<string, string> = {
  todo:        "text-slate-500",
  in_progress: "text-blue-600",
  review:      "text-amber-600",
  blocked:     "text-rose-600",
  done:        "text-emerald-600",
};

const STATUS_TINT: Record<string, string> = {
  todo:        "bg-slate-50",
  in_progress: "bg-blue-50/60",
  review:      "bg-amber-50/60",
  blocked:     "bg-rose-50/60",
  done:        "bg-emerald-50/60",
};

const KanbanCard = memo(function KanbanCard({ task, isDragging }: { task: Task; isDragging?: boolean }) {
  const overdue = task.dueDate && !isToday(task.dueDate) && isBefore(task.dueDate, new Date()) && task.status !== "done";

  const doneItems = task.subtasks.filter((s) => s.status === "done").length;
  const hasMeta = task.assignee || task.dueDate || task.sector || task._count.checklistItems > 0;

  return (
    <div className={`bg-white border rounded-lg p-2.5 select-none cursor-grab active:cursor-grabbing transition-all ${
      isDragging ? "shadow-lg ring-1 ring-blue-300 rotate-[1.5deg]" : "border-neutral-200/80 hover:border-neutral-300 hover:shadow-sm"
    }`}>
      <div className="flex items-start gap-2">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-[7px] ${PRIORITY_DOT[task.priority] ?? "bg-neutral-300"}`} />
        <Link
          href={`/tarefas/${task.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[13px] font-medium text-neutral-800 leading-snug hover:text-blue-600 transition-colors line-clamp-2"
        >
          {task.title}
        </Link>
      </div>

      {hasMeta && (
        <div className="flex items-center gap-2.5 flex-wrap mt-2 pl-3.5">
          {task.assignee && (
            <span className="flex items-center gap-1 text-[11px] text-neutral-500">
              <User className="w-3 h-3" />
              {task.assignee.name.split(" ")[0]}
            </span>
          )}
          {task.dueDate && (
            <span className={`flex items-center gap-1 text-[11px] ${overdue ? "text-red-600 font-semibold" : "text-neutral-400"}`}>
              {overdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
              {format(task.dueDate, "dd/MM")}
            </span>
          )}
          {task.sector && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium"
              style={{
                color: task.sector.color ?? "#6b7280",
                borderColor: task.sector.color ? `${task.sector.color}40` : "#e5e7eb",
                backgroundColor: task.sector.color ? `${task.sector.color}12` : "#f9fafb",
              }}
            >
              {task.sector.name}
            </span>
          )}
          {task._count.checklistItems > 0 && (
            <span className="text-[11px] text-neutral-400 tabular-nums">
              ✓ {doneItems}/{task._count.checklistItems}
            </span>
          )}
        </div>
      )}
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
    <div className="flex flex-col flex-1 min-w-[230px] max-w-[360px]">
      <div className="flex items-center gap-2 mb-2.5 px-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[column.id] ?? "bg-neutral-400"}`} />
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${STATUS_TEXT[column.id] ?? "text-neutral-500"}`}>{column.label}</span>
        <span className="text-[11px] font-semibold text-neutral-400 bg-neutral-100 rounded-full px-1.5 min-w-[1.25rem] text-center tabular-nums">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 p-2 rounded-xl min-h-[64px] max-h-[60vh] overflow-y-auto transition-colors ${
          isOver ? "bg-blue-100 ring-2 ring-inset ring-blue-300" : (STATUS_TINT[column.id] ?? "bg-neutral-100/60")
        }`}
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-[11px] text-neutral-300 select-none">
            Sem tarefas
          </div>
        ) : (
          tasks.map((t) => <DraggableCard key={t.id} task={t} />)
        )}
      </div>
    </div>
  );
}

export function KanbanView({
  tasks,
  columns = COLUMNS,
  statusColumnMap = {},
}: {
  tasks: Task[];
  columns?: Column[];
  // Mapeia status sem coluna própria pra uma coluna existente (ex: dashboard 3 colunas:
  // review/blocked → "in_progress"). Só afeta a exibição; o drag grava o status real da coluna alvo.
  statusColumnMap?: Record<string, string>;
}) {
  const [taskList, setTaskList] = useState(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const activeTask = activeId ? taskList.find((t) => t.id === activeId) : null;

  function groupByStatus() {
    const groups: Record<string, Task[]> = {};
    for (const col of columns) groups[col.id] = [];
    for (const t of taskList) {
      const colId = statusColumnMap[t.status] ?? t.status;
      if (groups[colId]) groups[colId].push(t);
      // Colunas custom (ex: dashboard, subset de status): descarta task cujo status
      // não tem coluna — senão ela cairia na 1ª coluna e um drag reescreveria o
      // status errado. Default (projeto, 5 colunas): mantém legacy (órfão → 1ª coluna).
      else if (columns === COLUMNS) groups[columns[0].id].push(t);
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
    if (!columns.find((c) => c.id === newStatus)) return;

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
      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <KanbanColumn key={col.id} column={col} tasks={groups[col.id]} />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <KanbanCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
