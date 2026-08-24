"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { applyVariables } from "@/lib/broadcast-variables";
import { openSecret } from "@/lib/secret-box";
import {
  sendWhatsAppBulk,
  cancelWhatsAppSchedule,
  isUazapiConfigured,
  isUazapiTestMode,
  type BroadcastOutbound,
  type BroadcastOutboundType,
} from "@/lib/whatsapp";

const MEDIA_BUCKET = "broadcast-media";

/* ─── Upload de mídia ──────────────────────────────────────────────── */

const MAX_MEDIA_BYTES = 16 * 1024 * 1024; // teto do WhatsApp para mídia comum

const ALLOWED_MEDIA: Record<Exclude<BroadcastOutboundType, "text" | "poll">, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/aac", "audio/x-m4a"],
};

export async function uploadBroadcastMediaAction(
  _previous: { url?: string; fileName?: string; error?: string },
  formData: FormData,
): Promise<{ url?: string; fileName?: string; error?: string }> {
  const user = await requireAuth();
  if (!user.companyId) return { error: "Sessão inválida." };

  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione um arquivo." };
  if (kind !== "image" && kind !== "video" && kind !== "audio") return { error: "Tipo de mídia inválido." };
  if (file.size > MAX_MEDIA_BYTES) {
    return { error: `Arquivo acima de ${Math.floor(MAX_MEDIA_BYTES / 1024 / 1024)} MB.` };
  }
  if (!ALLOWED_MEDIA[kind].includes(file.type)) {
    return { error: `Formato não aceito para ${kind}: ${file.type || "desconhecido"}.` };
  }

  // A UAZAPI busca o arquivo por URL, então o bucket precisa ser público.
  await supabaseAdmin.storage.createBucket(MEDIA_BUCKET, { public: true }).catch(() => {});

  const extension = file.name.includes(".") ? file.name.split(".").pop()!.slice(0, 8) : "bin";
  const path = `${user.companyId}/${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadError) return { error: `Falha ao subir o arquivo: ${uploadError.message}` };

  const { data } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, fileName: file.name };
}

/* ─── Criar e disparar ─────────────────────────────────────────────── */

const messageSchema = z
  .object({
    type: z.enum(["text", "image", "video", "audio", "poll"]),
    text: z.string().max(4096).optional().default(""),
    fileUrl: z.string().url().optional().nullable(),
    fileName: z.string().max(255).optional().nullable(),
    choices: z.array(z.string().trim().min(1).max(100)).max(12).optional().default([]),
    selectableCount: z.number().int().min(1).max(12).optional().nullable(),
  })
  .superRefine((message, ctx) => {
    if (message.type === "text" && !message.text.trim()) {
      ctx.addIssue({ code: "custom", message: "Mensagem de texto vazia." });
    }
    if ((message.type === "image" || message.type === "video" || message.type === "audio") && !message.fileUrl) {
      ctx.addIssue({ code: "custom", message: `Faltou o arquivo da mensagem de ${message.type}.` });
    }
    if (message.type === "poll") {
      if (!message.text.trim()) ctx.addIssue({ code: "custom", message: "A enquete precisa de uma pergunta." });
      if (message.choices.length < 2) ctx.addIssue({ code: "custom", message: "A enquete precisa de ao menos 2 opções." });
    }
  });

const createSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao disparo").max(255),
  delayMin: z.coerce.number().int().min(1).max(3600),
  delayMax: z.coerce.number().int().min(1).max(3600),
  clientIds: z.array(z.string().uuid()).min(1, "Selecione ao menos um grupo"),
  messages: z.array(messageSchema).min(1, "Adicione ao menos uma mensagem").max(10),
  scheduledFor: z.string().optional().nullable(),
  senderMode: z.enum(["automation", "manager"]).default("automation"),
});

const SEND_FAILURE_REASONS: Record<string, string> = {
  not_configured: "UAZAPI não configurada.",
  rejected: "A UAZAPI recusou o disparo.",
  request_failed: "Não foi possível falar com a UAZAPI.",
  empty: "Nenhuma mensagem válida para enviar.",
  in_the_past: "O agendamento precisa ser no futuro.",
};

export async function createBroadcastAction(
  _previous: { error?: string; success?: boolean; broadcastId?: string },
  formData: FormData,
): Promise<{ error?: string; success?: boolean; broadcastId?: string }> {
  const user = await requireAuth();
  if (!user.companyId || !user.userId) return { error: "Sessão inválida." };
  if (user.role !== "admin" && user.role !== "manager") {
    return { error: "Sem permissão para disparar mensagens." };
  }
  if (!isUazapiConfigured()) return { error: "UAZAPI não configurada neste ambiente." };

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse({
      name: formData.get("name"),
      delayMin: formData.get("delayMin"),
      delayMax: formData.get("delayMax"),
      clientIds: JSON.parse(String(formData.get("clientIds") ?? "[]")),
      messages: JSON.parse(String(formData.get("messages") ?? "[]")),
      scheduledFor: formData.get("scheduledFor"),
      senderMode: formData.get("senderMode") ?? "automation",
    });
  } catch (error) {
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Dados inválidos." };
    return { error: "Não foi possível ler o formulário." };
  }

  if (input.delayMin > input.delayMax) {
    return { error: "O intervalo mínimo não pode ser maior que o máximo." };
  }

  let scheduledFor: Date | null = null;
  if (input.scheduledFor) {
    scheduledFor = new Date(input.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) return { error: "Data de agendamento inválida." };
    if (scheduledFor.getTime() <= Date.now()) return { error: "O agendamento precisa ser no futuro." };
  }

  // Só cliente ativo entra. "Ativo" aqui é deletedAt nulo: a sync da planilha
  // arquiva quem virou "inativo" lá, então o filtro é o mesmo critério.
  const clients = await prisma.client.findMany({
    where: {
      id: { in: input.clientIds },
      companyId: user.companyId,
      deletedAt: null,
      whatsappGroupId: { not: null },
    },
    select: {
      id: true,
      name: true,
      externalId: true,
      whatsappGroupId: true,
      managerId: true,
      manager: { select: { id: true, name: true, uazapiToken: true } },
    },
  });

  if (clients.length === 0) {
    return { error: "Nenhum cliente ativo com grupo de WhatsApp entre os selecionados." };
  }

  // Cada grupo vira uma chamada à UAZAPI. No modo automação é um só, com o
  // token do ambiente; por gestor, um por gestor, com o token dele.
  type SendGroup = {
    managerId: string | null;
    label: string;
    token: string | null;
    clients: typeof clients;
  };

  const groups: SendGroup[] = [];

  if (input.senderMode === "manager") {
    // Falta de token bloqueia o disparo inteiro em vez de cair no número de
    // automação: descobrir depois que parte dos clientes recebeu de outro
    // número é pior do que não enviar.
    const semGestor = clients.filter((client) => !client.manager);
    if (semGestor.length > 0) {
      const nomes = semGestor.slice(0, 5).map((c) => c.name).join(", ");
      const resto = semGestor.length > 5 ? ` e mais ${semGestor.length - 5}` : "";
      return { error: `Sem gestor responsável: ${nomes}${resto}. Defina o gestor ou use o número de automação.` };
    }

    const porGestor = new Map<string, SendGroup>();
    const semToken = new Set<string>();

    for (const client of clients) {
      const manager = client.manager!;
      const existing = porGestor.get(manager.id);
      if (existing) {
        existing.clients.push(client);
        continue;
      }
      const token = openSecret(manager.uazapiToken);
      if (!token) semToken.add(manager.name);
      porGestor.set(manager.id, {
        managerId: manager.id,
        label: manager.name,
        token,
        clients: [client],
      });
    }

    if (semToken.size > 0) {
      return {
        error: `Sem token da UAZAPI configurado: ${[...semToken].join(", ")}. Configure em Equipe ou use o número de automação.`,
      };
    }

    groups.push(...porGestor.values());
  } else {
    groups.push({ managerId: null, label: "Número de automação", token: null, clients });
  }

  const broadcast = await prisma.broadcast.create({
    data: {
      companyId: user.companyId,
      createdById: user.userId,
      name: input.name,
      status: "draft",
      senderMode: input.senderMode,
      delayMin: input.delayMin,
      delayMax: input.delayMax,
      scheduledFor,
      totalTargets: clients.length,
      totalMessages: clients.length * input.messages.length,
      messages: {
        create: input.messages.map((message, position) => ({
          position,
          type: message.type,
          text: message.text || null,
          fileUrl: message.fileUrl ?? null,
          fileName: message.fileName ?? null,
          choices: message.choices,
          selectableCount: message.selectableCount ?? null,
        })),
      },
      recipients: {
        create: clients.map((client) => ({
          clientId: client.id,
          clientName: client.name,
          groupId: client.whatsappGroupId!,
          externalId: client.externalId,
        })),
      },
    },
    select: { id: true },
  });

  let queuedTotal = 0;
  const falhas: string[] = [];

  for (const group of groups) {
    // Ordem importa: a UAZAPI respeita a ordem do array, então as mensagens de
    // um mesmo cliente precisam sair na sequência montada na tela.
    const outbound: BroadcastOutbound[] = [];
    for (const client of group.clients) {
      const context = { name: client.name, externalId: client.externalId };
      for (const message of input.messages) {
        outbound.push({
          groupId: client.whatsappGroupId!,
          type: message.type,
          text: message.text ? applyVariables(message.text, context) : null,
          fileUrl: message.fileUrl ?? null,
          choices: message.choices.map((choice) => applyVariables(choice, context)),
          selectableCount: message.selectableCount ?? 1,
        });
      }
    }

    const result = await sendWhatsAppBulk({
      outbound,
      delayMin: input.delayMin,
      delayMax: input.delayMax,
      scheduledFor,
      info: `Disparo F3F: ${input.name}${group.managerId ? ` (${group.label})` : ""}`,
      tokenOverride: group.token,
    });

    if (!result.ok) {
      falhas.push(`${group.label}: ${SEND_FAILURE_REASONS[result.reason] ?? result.reason}`);
      continue;
    }

    queuedTotal += result.queued;
    await prisma.broadcastDispatch.create({
      data: {
        broadcastId: broadcast.id,
        managerId: group.managerId,
        senderLabel: group.label,
        folderId: result.folderId,
        queued: result.queued,
      },
    });
  }

  // Parcial é possível quando cada gestor é uma chamada: o que entrou na fila
  // já foi, e cancelar o resto é decisão de quem disparou. Por isso o disparo
  // fica salvo com o aviso, em vez de sumir.
  const falhou = queuedTotal === 0;
  await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: {
      status: falhou ? "failed" : scheduledFor ? "scheduled" : "sending",
      totalMessages: queuedTotal || clients.length * input.messages.length,
      error: falhas.length > 0 ? falhas.join(" · ") : null,
    },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "create",
    resourceType: "broadcast",
    resourceId: broadcast.id,
    newValue: {
      name: input.name,
      destinatarios: clients.length,
      mensagens: queuedTotal,
      envios: groups.length,
      modoRemetente: input.senderMode,
      agendadoPara: scheduledFor?.toISOString() ?? null,
      modo: isUazapiTestMode() ? "test" : "production",
    },
  });

  revalidatePath("/disparos");

  if (falhou) {
    return { error: `Nenhuma mensagem entrou na fila. ${falhas.join(" · ")}` };
  }
  if (falhas.length > 0) {
    return { error: `Disparo criado, mas parte falhou — ${falhas.join(" · ")}. Veja o relatório.`, broadcastId: broadcast.id };
  }
  return { success: true, broadcastId: broadcast.id };
}

/* ─── Cancelar ─────────────────────────────────────────────────────── */

export async function cancelBroadcastAction(broadcastId: string): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!user.companyId || !user.userId) return { error: "Sessão inválida." };
  if (user.role !== "admin" && user.role !== "manager") return { error: "Sem permissão." };

  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, companyId: user.companyId },
    select: {
      id: true,
      folderId: true,
      status: true,
      name: true,
      dispatches: { select: { folderId: true, senderLabel: true, managerId: true } },
    },
  });
  if (!broadcast) return { error: "Disparo não encontrado." };
  if (broadcast.status === "completed" || broadcast.status === "canceled") {
    return { error: "Este disparo já terminou." };
  }

  // Um envio por gestor significa uma campanha por gestor na UAZAPI: todas
  // precisam ser canceladas. O folderId antigo cobre disparos anteriores à
  // tabela de envios.
  const folders = broadcast.dispatches.length > 0
    ? broadcast.dispatches.map((dispatch) => ({ folderId: dispatch.folderId, label: dispatch.senderLabel }))
    : broadcast.folderId
      ? [{ folderId: broadcast.folderId, label: "Número de automação" }]
      : [];
  if (folders.length === 0) return { error: "Este disparo não chegou a ser enviado." };

  const naoCancelados: string[] = [];
  for (const folder of folders) {
    const ok = await cancelWhatsAppSchedule(folder.folderId);
    if (!ok) naoCancelados.push(folder.label);
  }
  if (naoCancelados.length === folders.length) {
    return { error: "A UAZAPI não confirmou o cancelamento." };
  }
  if (naoCancelados.length > 0) {
    // Parte cancelou: marcar como cancelado seria mentir sobre o resto.
    return { error: `Não foi possível cancelar o envio de: ${naoCancelados.join(", ")}. O restante foi cancelado.` };
  }

  await prisma.broadcast.update({ where: { id: broadcast.id }, data: { status: "canceled" } });
  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "update",
    resourceType: "broadcast",
    resourceId: broadcast.id,
    newValue: { status: "canceled", name: broadcast.name },
  });

  revalidatePath("/disparos");
  revalidatePath(`/disparos/${broadcast.id}`);
  return { success: true };
}
