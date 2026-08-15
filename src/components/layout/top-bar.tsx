"use client";

import { memo, useState, useRef, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, Bell, AlertTriangle, Clock, CheckCheck } from "lucide-react";
import { format, isBefore, differenceInHours, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { markAllReadAction, markOneReadAction } from "@/app/(dashboard)/notificacoes/actions";

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

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: Date | string;
}

interface TopBarProps {
  userName: string;
  unreadCount?: number;
  notifications?: NotificationItem[];
  userAvatar?: string | null;
  upcomingTasks?: UpcomingTask[];
}

// Cor por tipo de notificação — família indigo/violeta pra distinguir do vermelho das tarefas.
const NOTIF_ACCENT: Record<string, string> = {
  task_assigned: "bg-indigo-500",
  comment: "bg-violet-500",
  mention: "bg-blue-500",
  task_due: "bg-amber-500",
  task_overdue: "bg-red-500",
  system: "bg-neutral-400",
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function notifHref(n: NotificationItem) {
  return n.resourceType === "task" && n.resourceId ? `/tarefas/${n.resourceId}` : "/notificacoes";
}

interface BellDropdownProps {
  notifications: NotificationItem[];
  upcomingTasks: UpcomingTask[];
  bellOpen: boolean;
  onClose: () => void;
  onNotifClick: (n: NotificationItem) => void;
  onMarkAll: () => void;
}

const BellDropdown = memo(function BellDropdown({
  notifications, upcomingTasks, bellOpen, onClose, onNotifClick, onMarkAll,
}: BellDropdownProps) {
  const now = new Date();
  const overdueCount = upcomingTasks.filter(
    (t) => t.dueDate && isBefore(new Date(t.dueDate), now)
  ).length;
  const unreadNotifs = notifications.filter((n) => !n.isRead).length;

  if (!bellOpen) return null;

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden">
      {/* Notificações */}
      <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
        <p className="text-sm font-bold text-neutral-900">Notificações</p>
        {unreadNotifs > 0 && (
          <button
            onClick={onMarkAll}
            className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Marcar lidas
          </button>
        )}
      </div>
      {notifications.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-neutral-400">Nenhuma notificação</p>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto divide-y divide-neutral-50">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => onNotifClick(n)}
              className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors ${
                n.isRead ? "hover:bg-neutral-50" : "bg-indigo-50/60 hover:bg-indigo-50"
              }`}
            >
              <span className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${NOTIF_ACCENT[n.type] ?? "bg-neutral-400"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{n.title}</p>
                {n.body && <p className="text-[11px] text-neutral-500 truncate mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  {formatDistanceToNow(new Date(n.createdAt), { locale: ptBR, addSuffix: true })}
                </p>
              </div>
              {!n.isRead && <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500" />}
            </button>
          ))}
        </div>
      )}

      {/* Tarefas próximas */}
      <div className="px-4 py-3 border-y border-neutral-100 flex items-center justify-between bg-neutral-50/50">
        <p className="text-sm font-bold text-neutral-900">Tarefas próximas</p>
        {overdueCount > 0 && (
          <span className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
            {overdueCount} atrasada{overdueCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {upcomingTasks.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-neutral-400">Nenhuma tarefa vencendo nas próximas 48h</p>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto divide-y divide-neutral-50">
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

export function TopBar({ userName, unreadCount = 0, notifications = [], userAvatar, upcomingTasks = [] }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [, startTransition] = useTransition();
  const [notifs, setNotifs] = useState<NotificationItem[]>(notifications);
  const [unread, setUnread] = useState(unreadCount);
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

  // Notificações por consulta periódica.
  //
  // Antes isto era um stream SSE: cada aba aberta segurava uma função da Vercel
  // rodando sem parar (300s por conexão, reconectando sozinha). Uma pessoa com o
  // sistema aberto 8h consumia 8 HORAS de execução por dia, e uma aba esquecida
  // consumia 24h — o que estourava a cota do plano Hobby sozinho.
  //
  // Aqui cada verificação dura uns 100ms. Duas escolhas mantêm o custo baixo sem
  // parecer lento:
  //   - aba em segundo plano não consulta nada (aba esquecida custa zero);
  //   - ao voltar para a aba, consulta na hora — que é justamente quando a
  //     pessoa olha para o sininho.
  useEffect(() => {
    const POLL_MS = 60_000;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const mergeItems = (incoming: NotificationItem[]) =>
      setNotifs((prev) => {
        const byId = new Map(prev.map((n) => [n.id, n]));
        for (const it of incoming) byId.set(it.id, it);
        return [...byId.values()]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 30);
      });

    async function refetch() {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/notifications/recent");
        if (!res.ok) return;
        const data = (await res.json()) as { items: NotificationItem[]; unread: number };
        if (stopped) return;
        mergeItems(data.items);
        setUnread(data.unread);
      } catch {
        // erro transitório de rede — tenta no próximo ciclo
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void refetch();
    }

    void refetch();
    timer = setInterval(() => void refetch(), POLL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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

  function handleNotifClick(n: NotificationItem) {
    if (!n.isRead) {
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      markOneReadAction(n.id);
    }
    setBellOpen(false);
    router.push(notifHref(n));
  }

  function handleMarkAll() {
    setNotifs((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    markAllReadAction();
  }

  const { alertCount } = useMemo(() => {
    const now = new Date();
    const overdueCount = upcomingTasks.filter(
      (t) => t.dueDate && isBefore(new Date(t.dueDate), now)
    ).length;
    const alertCount = overdueCount > 0 ? overdueCount : upcomingTasks.length;
    return { alertCount };
  }, [upcomingTasks]);

  // Badge: notificações (indigo + pisca) têm prioridade; senão tarefas atrasando (vermelho).
  const showNotif = unread > 0;
  const badgeCount = showNotif ? unread : alertCount;
  const badgeColor = showNotif ? "bg-indigo-500" : "bg-red-500";

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
            {badgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
                {showNotif && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-ping" />
                )}
                <span className={`relative inline-flex items-center justify-center w-4 h-4 rounded-full ${badgeColor} text-white text-[10px] font-bold leading-none`}>
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              </span>
            )}
          </button>

          <BellDropdown
            notifications={notifs}
            upcomingTasks={upcomingTasks}
            bellOpen={bellOpen}
            onClose={() => setBellOpen(false)}
            onNotifClick={handleNotifClick}
            onMarkAll={handleMarkAll}
          />
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
