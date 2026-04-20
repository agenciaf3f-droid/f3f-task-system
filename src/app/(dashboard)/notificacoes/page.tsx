import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Bell, CheckCheck, Link2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { markAllReadAction, markOneReadAction } from "./actions";
import { Button } from "@/components/ui/button";

const TYPE_ICONS: Record<string, string> = {
  task_assigned: "📋",
  task_due: "⏰",
  task_overdue: "🔴",
  comment: "💬",
  mention: "📣",
  system: "🔔",
};

const TYPE_LABELS: Record<string, string> = {
  task_assigned: "Tarefa atribuída",
  task_due: "Prazo hoje",
  task_overdue: "Tarefa atrasada",
  comment: "Comentário",
  mention: "Menção",
  system: "Sistema",
};

export default async function NotificacoesPage() {
  const user = await requireAuth();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Notificações
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-neutral-500 mt-0.5">
              {unreadCount} não lida{unreadCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <form action={markAllReadAction}>
            <Button variant="outline" size="sm" type="submit" className="text-xs">
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              Marcar todas como lidas
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400 border border-dashed border-neutral-200 rounded-xl">
          <Bell className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhuma notificação</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {notifications.map((n) => {
            const taskHref =
              n.resourceType === "task" ? `/tarefas/${n.resourceId}` : null;

            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 rounded-lg transition-colors ${
                  !n.isRead
                    ? "bg-blue-50 border border-blue-100"
                    : "bg-white border border-neutral-100 opacity-70"
                }`}
              >
                <span className="text-lg shrink-0 mt-0.5">
                  {TYPE_ICONS[n.type] ?? "🔔"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-500">
                      {TYPE_LABELS[n.type]}
                    </span>
                    {!n.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-neutral-900 mt-0.5">
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-neutral-500 mt-0.5 truncate">
                      {n.body}
                    </p>
                  )}
                  <p className="text-xs text-neutral-400 mt-1">
                    {formatDistanceToNow(n.createdAt, {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {taskHref && (
                    <Link
                      href={taskHref}
                      className="p-1.5 text-neutral-400 hover:text-neutral-700 transition-colors"
                      title="Ver tarefa"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  {!n.isRead && (
                    <form action={markOneReadAction.bind(null, n.id)}>
                      <button
                        type="submit"
                        className="p-1.5 text-neutral-400 hover:text-blue-600 transition-colors"
                        title="Marcar como lida"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
