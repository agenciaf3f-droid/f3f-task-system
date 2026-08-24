import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listCampaignMessages, normalizeGroupId } from "@/lib/whatsapp";
import { BroadcastStatusBadge } from "../status-badge";
import { CancelBroadcastButton } from "./cancel-button";
import { ArrowLeft, Ban, CheckCircle2, Clock, Copy, XCircle } from "lucide-react";

export const metadata = { title: "Disparo" };

// O andamento vem da UAZAPI a cada visita: ela é a dona da fila, e cachear isso
// mostraria número velho justamente enquanto o disparo está andando.
export const dynamic = "force-dynamic";

export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  const broadcast = await prisma.broadcast.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      createdBy: { select: { name: true } },
      messages: { orderBy: { position: "asc" } },
      recipients: { orderBy: { clientName: "asc" } },
    },
  });
  if (!broadcast) notFound();

  const delivery = broadcast.folderId ? await listCampaignMessages(broadcast.folderId) : [];

  // A UAZAPI devolve o destino dela; casamos pelo id normalizado do grupo.
  type Tally = { sent: number; failed: number; queued: number; canceled: number; lastAt: Date | null };
  const emptyTally = (): Tally => ({ sent: 0, failed: 0, queued: 0, canceled: 0, lastAt: null });

  const byGroup = new Map<string, Tally>();
  const totals = emptyTally();

  for (const message of delivery) {
    const key = normalizeGroupId(message.number);
    const entry = byGroup.get(key) ?? emptyTally();
    entry[message.outcome] += 1;
    totals[message.outcome] += 1;
    if (message.sentAt && (!entry.lastAt || message.sentAt > entry.lastAt)) entry.lastAt = message.sentAt;
    byGroup.set(key, entry);
  }

  // Sem cron para fechar o disparo, quem percebe que acabou é esta tela: se a
  // UAZAPI não tem mais nada na fila, o registro para de dizer "Enviando" para
  // sempre — inclusive na listagem, que lê só o banco.
  let status = broadcast.status;
  if (
    (status === "sending" || status === "scheduled") &&
    delivery.length > 0 &&
    totals.queued === 0
  ) {
    status = totals.sent === 0 && totals.failed > 0 ? "failed" : "completed";
    await prisma.broadcast.update({ where: { id: broadcast.id }, data: { status } });
  }

  const canCancel =
    (user.role === "admin" || user.role === "manager") &&
    Boolean(broadcast.folderId) &&
    (status === "scheduled" || status === "sending");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/disparos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-3.5 h-3.5" />Voltar
      </Link>

      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-semibold">{broadcast.name}</h1>
        <div className="flex items-center gap-2">
          <BroadcastStatusBadge status={status} />
          {(user.role === "admin" || user.role === "manager") && (
            <Link
              href={`/disparos?duplicar=${broadcast.id}`}
              title="Duplicar disparo"
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Copy className="w-3.5 h-3.5" />Duplicar
            </Link>
          )}
          {canCancel && <CancelBroadcastButton broadcastId={broadcast.id} />}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {broadcast.totalTargets} grupo(s) · {broadcast.messages.length} mensagem(ns) por grupo ·
        intervalo {broadcast.delayMin}–{broadcast.delayMax}s
        {broadcast.scheduledFor ? ` · agendado para ${broadcast.scheduledFor.toLocaleString("pt-BR")}` : ""}
        {broadcast.createdBy?.name ? ` · por ${broadcast.createdBy.name}` : ""}
      </p>

      {broadcast.error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 mb-5 text-sm">{broadcast.error}</div>
      )}

      <div className={`grid gap-3 mb-6 ${totals.canceled > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
        <Stat icon={CheckCircle2} label="Enviadas" value={totals.sent} className="text-emerald-600" />
        <Stat icon={Clock} label="Na fila" value={totals.queued} className="text-sky-600" />
        <Stat icon={XCircle} label="Falharam" value={totals.failed} className="text-red-600" />
        {totals.canceled > 0 && (
          <Stat icon={Ban} label="Canceladas" value={totals.canceled} className="text-muted-foreground" />
        )}
      </div>

      {!broadcast.folderId && (
        <p className="text-sm text-muted-foreground mb-6">
          Este disparo não chegou a entrar na fila da UAZAPI, então não há entrega para acompanhar.
        </p>
      )}

      <h2 className="text-sm font-semibold mb-2">Mensagens</h2>
      <div className="border rounded-lg divide-y mb-6">
        {broadcast.messages.map((message) => (
          <div key={message.id} className="px-4 py-3 text-sm">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">
              {message.position + 1}. {message.type}
              {message.fileName ? ` · ${message.fileName}` : ""}
            </div>
            {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
            {message.choices.length > 0 && (
              <ul className="mt-1">
                {message.choices.map((choice, i) => (
                  <li key={i} className="text-xs text-muted-foreground">◦ {choice}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold mb-2">Destinatários ({broadcast.recipients.length})</h2>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2">Cliente</th>
              <th className="text-left font-medium px-4 py-2">ID</th>
              <th className="text-center font-medium px-4 py-2">Enviadas</th>
              <th className="text-center font-medium px-4 py-2">Fila</th>
              <th className="text-center font-medium px-4 py-2">Falhas</th>
              <th className="text-left font-medium px-4 py-2">Último envio</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {broadcast.recipients.map((recipient) => {
              const stats = byGroup.get(normalizeGroupId(recipient.groupId));
              return (
                <tr key={recipient.id}>
                  <td className="px-4 py-2 truncate max-w-[260px]">{recipient.clientName}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{recipient.externalId ?? "—"}</td>
                  <td className="px-4 py-2 text-center">{stats?.sent ?? 0}</td>
                  <td className="px-4 py-2 text-center text-muted-foreground">{stats?.queued ?? 0}</td>
                  <td className={`px-4 py-2 text-center ${stats?.failed ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                    {stats?.failed ?? 0}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {stats?.lastAt ? stats.lastAt.toLocaleString("pt-BR") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, className,
}: { icon: React.ElementType; label: string; value: number; className: string }) {
  return (
    <div className="border rounded-lg px-4 py-3">
      <div className={`flex items-center gap-1.5 text-xs ${className}`}>
        <Icon className="w-3.5 h-3.5" />{label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
