import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, User, FileText, MessageSquare, CheckSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import { HistoricoFilters } from "./historico-filters";

const PAGE_SIZE = 50;

const STATIC_LABELS: Record<string, { label: string; color: string }> = {
  "task.created":        { label: "Criou tarefa",            color: "text-green-600"  },
  "task.deleted":        { label: "Excluiu tarefa",          color: "text-red-600"    },
  "task.commented":      { label: "Comentou na tarefa",      color: "text-blue-600"   },
  "task.updated":        { label: "Atualizou tarefa",        color: "text-amber-600"  },
  "task.blocked":        { label: "Bloqueou tarefa",         color: "text-red-600"    },
  "task.unblocked":      { label: "Desbloqueou tarefa",      color: "text-green-600"  },
  "project.created":     { label: "Criou projeto",           color: "text-green-600"  },
  "template.created":    { label: "Criou template",          color: "text-green-600"  },
  "template.activated":  { label: "Ativou template",         color: "text-blue-600"   },
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  "task.created":        CheckSquare,
  "task.status_changed": Activity,
  "task.deleted":        Trash2,
  "task.commented":      MessageSquare,
  "task.updated":        FileText,
  "task.blocked":        Activity,
  "task.unblocked":      Activity,
  "project.created":     FileText,
  "template.created":    FileText,
  "template.activated":  FileText,
};

const STATUS_TRANSITION_LABELS: Record<string, { label: string; color: string }> = {
  done:         { label: "Concluiu tarefa",      color: "text-green-600"   },
  in_progress:  { label: "Iniciou tarefa",        color: "text-blue-600"    },
  todo:         { label: "Reabriu tarefa",        color: "text-neutral-600" },
  blocked:      { label: "Bloqueou tarefa",       color: "text-red-600"     },
  cancelled:    { label: "Cancelou tarefa",       color: "text-neutral-500" },
  review:       { label: "Enviou para revisão",   color: "text-amber-600"   },
};

function getActionMeta(action: string, log: { oldValue: unknown; newValue: unknown }) {
  if (action === "task.status_changed") {
    const n = log.newValue as { status?: string } | null;
    if (n?.status && STATUS_TRANSITION_LABELS[n.status]) return STATUS_TRANSITION_LABELS[n.status];
    return { label: "Status alterado", color: "text-blue-600" };
  }
  return STATIC_LABELS[action] ?? { label: action, color: "text-neutral-600" };
}

function formatActionDetail(action: string, log: { oldValue: unknown; newValue: unknown }) {
  if (["task.created","project.created","template.created"].includes(action)) {
    const n = log.newValue as { title?: string; name?: string } | null;
    return n?.title ?? n?.name ?? null;
  }
  if (action === "task.deleted") {
    const o = log.oldValue as { title?: string } | null;
    return o?.title ?? null;
  }
  return null;
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; action?: string; resource?: string; from?: string; to?: string; page?: string }>;
}) {
  const user = await requireRole(["admin", "manager"]);
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10));

  const toDate = sp.to ? new Date(sp.to) : null;
  if (toDate) toDate.setHours(23, 59, 59, 999);

  const where = {
    companyId: user.companyId,
    ...(sp.userId   ? { userId: sp.userId }          : {}),
    ...(sp.action   ? { action: sp.action }           : {}),
    ...(sp.resource ? { resourceType: sp.resource }   : {}),
    ...((sp.from || sp.to) ? {
      createdAt: {
        ...(sp.from ? { gte: new Date(sp.from) } : {}),
        ...(toDate  ? { lte: toDate }            : {}),
      },
    } : {}),
  };

  const [logs, total, users] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { user: { select: { name: true } } },
    }),
    prisma.activityLog.count({ where }),
    prisma.user.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (sp.userId)   params.set("userId",   sp.userId);
    if (sp.action)   params.set("action",   sp.action);
    if (sp.resource) params.set("resource", sp.resource);
    if (sp.from)     params.set("from",     sp.from);
    if (sp.to)       params.set("to",       sp.to);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/historico${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Histórico de ações</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Registro completo de todas as atividades da equipe
          {total > 0 && <span className="ml-1">— {total} evento{total !== 1 ? "s" : ""}</span>}
        </p>
      </div>

      <HistoricoFilters users={users} />

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400 border border-dashed border-neutral-200 rounded-xl">
          <Activity className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhuma ação encontrada</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-neutral-100" />
            <div className="flex flex-col gap-0">
              {logs.map((log) => {
                const meta = getActionMeta(log.action, log);
                const Icon = ACTION_ICONS[log.action] ?? Activity;
                const detail = formatActionDetail(log.action, log);

                return (
                  <div key={log.id} className="flex items-start gap-4 py-3 pl-0">
                    <div className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white border border-neutral-200 shrink-0">
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0 pt-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5 text-sm text-neutral-700">
                          <User className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="font-medium">{log.user?.name.split(" ")[0] ?? "Sistema"}</span>
                        </span>
                        <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
                        {detail && (
                          <span className="text-sm text-neutral-500 truncate max-w-xs">— {detail}</span>
                        )}
                        {log.resourceId && log.resourceType === "task" && (
                          <Link
                            href={`/tarefas/${log.resourceId}`}
                            className="text-xs text-neutral-400 hover:text-blue-600 transition-colors"
                          >
                            ver tarefa →
                          </Link>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {format(log.createdAt, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-neutral-100">
              <Link
                href={page > 1 ? buildPageUrl(page - 1) : "#"}
                className={`text-sm px-3 py-1.5 rounded border transition-colors ${
                  page > 1
                    ? "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                    : "border-neutral-100 text-neutral-300 pointer-events-none"
                }`}
              >
                ← Anterior
              </Link>
              <span className="text-sm text-neutral-500">
                Página {page} de {totalPages}
              </span>
              <Link
                href={page < totalPages ? buildPageUrl(page + 1) : "#"}
                className={`text-sm px-3 py-1.5 rounded border transition-colors ${
                  page < totalPages
                    ? "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                    : "border-neutral-100 text-neutral-300 pointer-events-none"
                }`}
              >
                Próxima →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
