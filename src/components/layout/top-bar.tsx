"use client";

import { memo, useState, useRef, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, Bell, AlertTriangle, Clock } from "lucide-react";
import { format, isBefore, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SearchResult {
  id: string;
  title: string;
  status: string;
}

interface UpcomingTask {
  id: string;
  title: string;
  dueDate: Date | string | null;
  status: string;
  project: { name: string } | null;
}

interface TopBarProps {
  userName: string;
  unreadCount?: number;
  userAvatar?: string | null;
  upcomingTasks?: UpcomingTask[];
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

interface BellDropdownProps {
  upcomingTasks: UpcomingTask[];
  bellOpen: boolean;
  onClose: () => void;
}

const BellDropdown = memo(function BellDropdown({ upcomingTasks, bellOpen, onClose }: BellDropdownProps) {
  const now = new Date();
  const overdueCount = upcomingTasks.filter(
    (t) => t.dueDate && isBefore(new Date(t.dueDate), now)
  ).length;

  if (!bellOpen) return null;

  return (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                <p className="text-sm font-bold text-neutral-900">Tarefas próximas</p>
                {overdueCount > 0 && (
                  <span className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                    {overdueCount} atrasada{overdueCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {upcomingTasks.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-neutral-600">Tudo em dia!</p>
                  <p className="text-xs text-neutral-400 mt-1">Nenhuma tarefa vencendo nas próximas 48h</p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-neutral-50">
                  {upcomingTasks.map((task) => {
                    const due = task.dueDate ? new Date(task.dueDate) : null;
                    const isOverdue = due && isBefore(due, now);
                    const hoursLeft = due ? differenceInHours(due, now) : null;
                    return (
                      <Link
                        key={task.id}
                        href={`/tarefas/${task.id}`}
                        onClick={() => onClose()}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors"
                      >
                        <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isOverdue ? "bg-red-100" : "bg-amber-100"}`}>
                          {isOverdue
                            ? <AlertTriangle className="w-3 h-3 text-red-600" />
                            : <Clock className="w-3 h-3 text-amber-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">{task.title}</p>
                          {task.project && (
                            <p className="text-[11px] text-neutral-400 truncate">{task.project.name}</p>
                          )}
                        </div>
                        {due && (
                          <div className="shrink-0 text-right">
                            <p className={`text-xs font-bold ${isOverdue ? "text-red-600" : "text-amber-600"}`}>
                              {isOverdue
                                ? `${Math.abs(hoursLeft!)}h atraso`
                                : hoursLeft! < 24
                                ? `${hoursLeft}h`
                                : format(due, "dd/MM", { locale: ptBR })}
                            </p>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
  );
});

export function TopBar({ userName, unreadCount = 0, userAvatar, upcomingTasks = [] }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const initials = getInitials(userName);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
      if (e.key === "Escape") {
        setSearchOpen(false); setQuery(""); setResults([]);
        setBellOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false); setQuery(""); setResults([]);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    const timeout = setTimeout(() => {
      startTransition(async () => {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) { const data = await res.json(); setResults(data.tasks ?? []); }
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  function selectResult(id: string) {
    setSearchOpen(false); setQuery(""); setResults([]);
    router.push(`/tarefas/${id}`);
  }

  const { overdueCount, alertCount } = useMemo(() => {
    const now = new Date();
    const overdueCount = upcomingTasks.filter(
      (t) => t.dueDate && isBefore(new Date(t.dueDate), now)
    ).length;
    const alertCount = overdueCount > 0 ? overdueCount : upcomingTasks.length;
    return { overdueCount, alertCount };
  }, [upcomingTasks]);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-8 py-3 bg-white border-b border-neutral-200/80 backdrop-blur-sm">
      {/* Search */}
      <div ref={searchRef} className="relative">
        <button
          onClick={() => { setSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 10); }}
          className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-neutral-400 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors w-64"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left text-xs">Buscar tarefas...</span>
          <kbd className="text-[10px] text-neutral-300 bg-white px-1.5 py-0.5 rounded border border-neutral-200 font-mono">⌘K</kbd>
        </button>

        {searchOpen && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-neutral-100">
              <Search className="w-4 h-4 text-neutral-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por título..."
                className="flex-1 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
              />
              {query && (
                <button onClick={() => { setQuery(""); setResults([]); }}>
                  <X className="w-4 h-4 text-neutral-400 hover:text-neutral-600" />
                </button>
              )}
            </div>
            {results.length > 0 ? (
              <div className="max-h-64 overflow-y-auto py-1">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectResult(r.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-neutral-800 truncate flex-1">{r.title}</span>
                    <span className="text-xs text-neutral-400 shrink-0">{r.status}</span>
                  </button>
                ))}
              </div>
            ) : query.length >= 2 ? (
              <div className="px-3 py-6 text-center text-sm text-neutral-400">Nenhuma tarefa encontrada</div>
            ) : (
              <div className="px-3 py-4 text-center text-xs text-neutral-400">Digite para buscar tarefas</div>
            )}
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Bell */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setBellOpen((v) => !v)}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </button>

          <BellDropdown upcomingTasks={upcomingTasks} bellOpen={bellOpen} onClose={() => setBellOpen(false)} />
        </div>

        {/* Avatar */}
        <Link href="/minha-conta">
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="w-8 h-8 rounded-full object-cover border border-neutral-200 hover:ring-2 hover:ring-blue-400 transition-all"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white shadow shadow-blue-500/30 hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer">
              {initials}
            </div>
          )}
        </Link>
      </div>
    </header>
  );
}
