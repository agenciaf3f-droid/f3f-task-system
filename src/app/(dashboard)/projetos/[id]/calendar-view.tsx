"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, format, isBefore,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high:   "bg-orange-400",
  medium: "bg-yellow-400",
  low:    "bg-neutral-300",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function CalendarView({ tasks }: { tasks: Task[] }) {
  const [month, setMonth] = useState(() => {
    // Start at the month with most tasks, or current month
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const tasksByDay = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const key = format(task.dueDate, "yyyy-MM-dd");
    const list = tasksByDay.get(key) ?? [];
    list.push(task);
    tasksByDay.set(key, list);
  }

  const tasksWithoutDue = tasks.filter((t) => !t.dueDate && t.status !== "done" && t.status !== "cancelled");

  return (
    <div className="flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-semibold text-neutral-800 capitalize">
          {format(month, "MMMM yyyy", { locale: ptBR })}
        </h3>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-neutral-100">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-neutral-400">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, month);
            const today = isToday(day);
            const isLastRow = i >= days.length - 7;

            return (
              <div
                key={key}
                className={`min-h-[80px] p-1.5 border-b border-r border-neutral-100 flex flex-col gap-1 ${
                  !inMonth ? "bg-neutral-50" : ""
                } ${isLastRow ? "border-b-0" : ""} ${(i + 1) % 7 === 0 ? "border-r-0" : ""}`}
              >
                <span
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full self-end ${
                    today
                      ? "bg-neutral-900 text-white"
                      : inMonth
                      ? "text-neutral-700"
                      : "text-neutral-300"
                  }`}
                >
                  {format(day, "d")}
                </span>

                {dayTasks.slice(0, 3).map((t) => {
                  const overdue = t.status !== "done" && isBefore(t.dueDate!, new Date()) && !isToday(t.dueDate!);
                  return (
                    <Link
                      key={t.id}
                      href={`/tarefas/${t.id}`}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs truncate transition-colors ${
                        t.status === "done"
                          ? "bg-emerald-50 text-emerald-600 line-through"
                          : overdue
                          ? "bg-red-50 text-red-700 font-medium"
                          : "bg-neutral-100 text-neutral-700 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority] ?? "bg-neutral-300"}`} />
                      <span className="truncate">{t.title}</span>
                    </Link>
                  );
                })}
                {dayTasks.length > 3 && (
                  <span className="text-xs text-neutral-400 px-1">+{dayTasks.length - 3}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tasks without due date */}
      {tasksWithoutDue.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4">
          <p className="text-xs font-medium text-neutral-500 mb-2">Sem prazo definido ({tasksWithoutDue.length})</p>
          <div className="flex flex-wrap gap-2">
            {tasksWithoutDue.map((t) => (
              <Link
                key={t.id}
                href={`/tarefas/${t.id}`}
                className="flex items-center gap-1.5 text-xs text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-full px-2.5 py-1 transition-colors"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority] ?? "bg-neutral-300"}`} />
                {t.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
