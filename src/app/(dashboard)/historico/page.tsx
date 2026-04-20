import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, User, FileText, MessageSquare, CheckSquare, Trash2 } from "lucide-react";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "task.created":        { label: "Tarefa criada",          color: "text-green-600"  },
  "task.status_changed": { label: "Status alterado",        color: "text-blue-600"   },
  "task.deleted":        { label: "Tarefa excluída",        color: "text-red-600"    },
  "task.commented":      { label: "Comentário adicionado",  color: "text-purple-600" },
  "task.updated":        { label: "Tarefa atualizada",      color: "text-amber-600"  },
  "template.created":    { label: "Template criado",        color: "text-green-600"  },
  "template.activated":  { label: "Template ativado",       color: "text-blue-600"   },
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  "task.created":        CheckSquare,
  "task.status_changed": Activity,
  "task.deleted":        Trash2,
  "task.commented":      MessageSquare,
  "task.updated":        FileText,
  "template.created":    FileText,
  "template.activated":  FileText,
};

function formatActionDetail(action: string, log: { oldValue: unknown; newValue: unknown }) {
  if (action === "task.status_changed") {
    const o = log.oldValue as { status?: string } | null;
    const n = log.newValue as { status?: string } | null;
    if (o?.status && n?.status) return `${o.status} → ${n.status}`;
  }
  if (action === "task.created") {
    const n = log.newValue as { title?: string } | null;
    return n?.title ?? null;
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
              const meta = ACTION_LABELS[log.action] ?? { label: log.action, color: "text-neutral-600" };
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
