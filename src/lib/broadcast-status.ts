import { prisma } from "@/lib/prisma";
import { listCampaignFolders, type CampaignFolder } from "@/lib/whatsapp";
import type { BroadcastStatus } from "@prisma/client";

/**
 * Fecha disparos que já terminaram na UAZAPI.
 *
 * Não existe cron para isso e nem webhook de fim de campanha, então quem
 * percebe o fim é quem abre a tela. Antes só a tela de detalhe fazia isso, e a
 * listagem — que lê apenas o banco — ficava dizendo "Enviando" para sempre
 * enquanto ninguém entrasse no disparo. Agora as duas telas chamam isto.
 *
 * A fonte é o contador da própria UAZAPI (log_total / log_sucess / log_failed),
 * não a soma dos status de cada mensagem: quem conta é o serviço que entrega.
 */

export type BroadcastLike = {
  id: string;
  status: BroadcastStatus;
  folderId: string | null;
  dispatches: { folderId: string }[];
};

export function foldersOf(broadcast: BroadcastLike): string[] {
  // O folderId solto cobre disparos anteriores à tabela de envios.
  return broadcast.dispatches.length > 0
    ? broadcast.dispatches.map((dispatch) => dispatch.folderId)
    : broadcast.folderId
      ? [broadcast.folderId]
      : [];
}

const OPEN_STATUSES: BroadcastStatus[] = ["sending", "scheduled"];

export async function reconcileBroadcasts<T extends BroadcastLike>(
  broadcasts: T[],
): Promise<{ statuses: Map<string, BroadcastStatus>; folders: Map<string, CampaignFolder> }> {
  const statuses = new Map<string, BroadcastStatus>();
  for (const broadcast of broadcasts) statuses.set(broadcast.id, broadcast.status);

  const pending = broadcasts.filter((broadcast) => OPEN_STATUSES.includes(broadcast.status));
  const folderIds = pending.flatMap(foldersOf);
  if (folderIds.length === 0) return { statuses, folders: new Map() };

  const folders = await listCampaignFolders(folderIds);
  if (folders.size === 0) return { statuses, folders };

  for (const broadcast of pending) {
    const own = foldersOf(broadcast).map((id) => folders.get(id));
    // Campanha que a UAZAPI não devolveu é desconhecida, não "terminada".
    if (own.length === 0 || own.some((folder) => !folder)) continue;

    const known = own as CampaignFolder[];
    if (!known.every((folder) => folder.finished)) continue;

    const sent = known.reduce((total, folder) => total + folder.sent, 0);
    const failed = known.reduce((total, folder) => total + folder.failed, 0);
    const next: BroadcastStatus = sent === 0 && failed > 0 ? "failed" : "completed";

    statuses.set(broadcast.id, next);
    await prisma.broadcast.update({ where: { id: broadcast.id }, data: { status: next } });
  }

  return { statuses, folders };
}
