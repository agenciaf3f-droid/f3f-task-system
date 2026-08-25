import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUazapiConfigured, isUazapiTestMode } from "@/lib/whatsapp";
import { reconcileBroadcasts } from "@/lib/broadcast-status";
import { formatBrazilDateTime, brazilLocalInputNow } from "@/lib/format-brazil";
import { NewBroadcastDialog, type BroadcastPrefill } from "./new-broadcast-dialog";
import { BroadcastStatusBadge } from "./status-badge";
import { Send, AlertTriangle, FlaskConical, Copy } from "lucide-react";

export const metadata = { title: "Disparos" };

export default async function DisparosPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicar?: string }>;
}) {
  const { duplicar } = await searchParams;
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
        folderId: true,
        dispatches: { select: { folderId: true } },
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

  // Sem cron nem webhook de fim de campanha, quem fecha o disparo é quem abre a
  // tela. Antes só o detalhe fazia isso e a listagem ficava presa em "Enviando".
  const { statuses } = await reconcileBroadcasts(broadcasts);

  // Duplicar não cria rascunho: reabre o formulário com o conteúdo do disparo
  // antigo, para o usuário revisar e disparar. Assim nada sai sem confirmação e
  // todo o caminho de criação continua sendo um só.
  let prefill: BroadcastPrefill | null = null;
  if (duplicar) {
    const source = await prisma.broadcast.findFirst({
      where: { id: duplicar, companyId: user.companyId },
      include: {
        messages: { orderBy: { position: "asc" } },
        recipients: { select: { clientId: true } },
      },
    });
    if (source) {
      // Cliente arquivado ou sem grupo desde o disparo original não pode voltar
      // na seleção; sobra quem ainda está ativo.
      const stillActive = new Set(clients.map((c) => c.id));
      prefill = {
        name: `${source.name} (cópia)`.slice(0, 255),
        delayMin: source.delayMin,
        delayMax: source.delayMax,
        clientIds: source.recipients
          .map((r) => r.clientId)
          .filter((id): id is string => Boolean(id) && stillActive.has(id!)),
        messages: source.messages.map((message) => ({
          type: message.type,
          text: message.text ?? "",
          // A mídia é reaproveitada pela mesma URL pública: duplicar não
          // obriga a subir o arquivo de novo.
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          choices: message.choices,
        })),
      };
    }
  }

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
          // A key força remontar quando entra ou sai um ?duplicar=. Sem ela o
          // componente já está montado, os inicializadores de useState não
          // rodam de novo e o formulário duplicado nunca abre.
          <NewBroadcastDialog
            key={prefill ? `duplicar-${duplicar}` : "novo"}
            clients={clients.map((c) => ({ ...c, whatsappGroupId: c.whatsappGroupId! }))}
            prefill={prefill}
            minScheduledAt={brazilLocalInputNow()}
          />
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
            <div key={broadcast.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
              <Link href={`/disparos/${broadcast.id}`} className="flex items-center gap-4 min-w-0 flex-1">
                <Send className="w-4 h-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{broadcast.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {broadcast.totalTargets} grupo(s) · {broadcast.totalMessages} mensagem(ns)
                    {broadcast.scheduledFor
                      ? ` · agendado para ${formatBrazilDateTime(broadcast.scheduledFor)}`
                      : ` · criado em ${formatBrazilDateTime(broadcast.createdAt)}`}
                    {broadcast.createdBy?.name ? ` · por ${broadcast.createdBy.name}` : ""}
                  </div>
                </div>
              </Link>
              <BroadcastStatusBadge status={statuses.get(broadcast.id) ?? broadcast.status} />
              {canSend && configured && (
                <Link
                  href={`/disparos?duplicar=${broadcast.id}`}
                  title="Duplicar disparo"
                  aria-label={`Duplicar ${broadcast.name}`}
                  className="shrink-0 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <Copy className="w-4 h-4" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
