import { History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Activity = {
  id: string;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: Date;
  user: { name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  todo: "A ser iniciado",
  in_progress: "Em andamento",
  review: "Revisão",
  blocked: "Ajustes",
  done: "Concluído",
  cancelled: "Cancelado",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function activityDescription(activity: Activity) {
  const oldValue = asRecord(activity.oldValue);
  const newValue = asRecord(activity.newValue);

  switch (activity.action) {
    case "task.created":
      return "criou a tarefa";
    case "task.status_changed": {
      const from = typeof oldValue.status === "string" ? STATUS_LABEL[oldValue.status] ?? oldValue.status : null;
      const to = typeof newValue.status === "string" ? STATUS_LABEL[newValue.status] ?? newValue.status : null;
      return from && to ? `alterou o status de ${from} para ${to}` : "alterou o status da tarefa";
    }
    case "task.commented":
      return "adicionou um comentário";
    case "task.deleted":
      return "excluiu a tarefa";
    default:
      return "atualizou a tarefa";
  }
}

export function TaskHistorySection({ activities }: { activities: Activity[] }) {
  return (
    <section className="bg-white border border-neutral-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-neutral-400" />
        <h2 className="text-sm font-semibold text-neutral-900">Histórico da tarefa</h2>
      </div>

      {activities.length === 0 ? (
        <p className="text-sm text-neutral-400 py-4 text-center">Nenhuma atividade registrada ainda.</p>
      ) : (
        <ol className="relative border-l border-neutral-200 ml-1 pl-5 flex flex-col gap-5">
          {activities.map((activity) => (
            <li key={activity.id} className="relative">
              <span className="absolute -left-[25px] top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-50" />
              <p className="text-sm text-neutral-700">
                <span className="font-semibold text-neutral-900">{activity.user?.name ?? "Sistema"}</span>{" "}
                {activityDescription(activity)}
              </p>
              <time className="text-xs text-neutral-400 mt-0.5 block">
                {format(activity.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
