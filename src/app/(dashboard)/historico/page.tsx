import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, User, FileText, MessageSquare, CheckSquare, Trash2 } from "lucide-react";

const STATIC_LABELS: Record<string, { label: string; color: string }> = {
  "task.created":        { label: "Criou tarefa",            color: "text-green-600"  },
  "task.deleted":        { label: "Excluiu tarefa",          color: "text-red-600"    },
  "task.commented":      { label: "Comentou na tarefa",      color: "text-blue-600"   },
  "task.updated":        { label: "Atualizou tarefa",        color: "text-amber-600"  },
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
  "project.created":     FileText,
  "template.created":    FileText,
  "template.activated":  FileText,
};

const STATUS_TRANSITION_LABELS: Record<string, { label: string; color: string }> = {
  done:         { label: "Concluiu tarefa",  color: "text-green-600"   },
  in_progress:  { label: "Iniciou tarefa",   color: "text-blue-600"    },
  todo:         { label: "Reabriu tarefa",   color: "text-neutral-600" },
  blocked:      { label: "Bloqueou tarefa",  color: "text-red-600"     },
  cancelled:    { label: "Cancelou tarefa",  color: "text-neutral-500" },
  review:       { label: "Enviou para revisão", color: "text-amber-600" },
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
  if (action === "task.created" || action === "project.created" || action === "template.created") {
    const n = log.newValue as { title?: string; name?: string } | null;
    return n?.title ?? n?.name ?? null;
  }
  if (action === "task.deleted") {
    const o = log.oldValue as { title?: string } | null;
    return o?.title ?? null;
  }
  return null;
}

export default async function HistoricoPage() {
  const user = await requireRole(["admin", "manager"]);

  const logs = await prisma.activityLog.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true } },
    },
  });

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Histórico de ações</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Registro completo de todas as atividades da equipe
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400 border border-dashed border-neutral-200 rounded-xl">
          <Activity className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhuma ação registrada</p>
        </div>
      ) : (
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
                        <span className="text-sm text-neutral-500 truncate max-w-xs">
                          — {detail}
                        </span>
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
      )}
    </div>
  );
}
