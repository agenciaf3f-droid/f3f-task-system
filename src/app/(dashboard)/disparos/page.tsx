import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUazapiConfigured, isUazapiTestMode } from "@/lib/whatsapp";
import { NewBroadcastDialog } from "./new-broadcast-dialog";
import { BroadcastStatusBadge } from "./status-badge";
import { Send, AlertTriangle, FlaskConical } from "lucide-react";

export const metadata = { title: "Disparos" };

export default async function DisparosPage() {
  const user = await requireAuth();
  const canSend = user.role === "admin" || user.role === "manager";

  const [broadcasts, clients] = await Promise.all([
    prisma.broadcast.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        status: true,
        totalTargets: true,
        totalMessages: true,
        scheduledFor: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
    // Só cliente ativo (deletedAt nulo) e com grupo cadastrado pode receber.
    prisma.client.findMany({
      where: { companyId: user.companyId, deletedAt: null, whatsappGroupId: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, externalId: true, meetingPlan: true, whatsappGroupId: true },
    }),
  ]);

  const configured = isUazapiConfigured();
  const testMode = isUazapiTestMode();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Send className="w-5 h-5" />
            Disparos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envio em massa para os grupos de WhatsApp dos clientes ativos.
          </p>
        </div>
        {canSend && configured && (
          <NewBroadcastDialog clients={clients.map((c) => ({ ...c, whatsappGroupId: c.whatsappGroupId! }))} />
        )}
      </div>

      {!configured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 mb-4 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <span>UAZAPI não configurada neste ambiente — nenhum disparo pode ser criado.</span>
        </div>
      )}

      {configured && testMode && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 mb-4 text-sm">
          <FlaskConical className="w-4 h-4 mt-0.5 shrink-0 text-sky-600" />
          <span>
            Modo de teste: nada chega aos clientes. Só a sequência do primeiro grupo selecionado é
            enviada, e vai para o grupo de teste.
          </span>
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-4">
        {clients.length} cliente(s) ativo(s) com grupo cadastrado.
      </p>

      {broadcasts.length === 0 ? (
        <div className="border border-dashed rounded-lg py-16 text-center text-sm text-muted-foreground">
          Nenhum disparo criado ainda.
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {broadcasts.map((broadcast) => (
            <Link
              key={broadcast.id}
              href={`/disparos/${broadcast.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50 transition-colors"
            >
              <Send className="w-4 h-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{broadcast.name}</div>
                <div className="text-xs text-muted-foreground">
                  {broadcast.totalTargets} grupo(s) · {broadcast.totalMessages} mensagem(ns)
                  {broadcast.scheduledFor
                    ? ` · agendado para ${broadcast.scheduledFor.toLocaleString("pt-BR")}`
                    : ` · criado em ${broadcast.createdAt.toLocaleString("pt-BR")}`}
                  {broadcast.createdBy?.name ? ` · por ${broadcast.createdBy.name}` : ""}
                </div>
              </div>
              <BroadcastStatusBadge status={broadcast.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
