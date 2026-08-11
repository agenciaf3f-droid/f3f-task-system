"use server";

import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { findClientForBooking } from "@/lib/external-db";
import { getMeetingDurationMinutes, getMeetingRecurrence } from "@/lib/meeting-duration";
import { sendWhatsAppText, verifyWhatsAppGroupDestination } from "@/lib/whatsapp";
import { logActivity } from "@/lib/activity";
import { todayInBrazil } from "@/lib/meeting-recurrence";
import { fetchPublishedClientSheet, resolveManager } from "@/lib/client-sheet-sync";

const MAGIC_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SendBookingLinkResult = {
  success?: boolean;
  error?: string;
  durationMinutes?: number;
  recurrence?: "weekly" | "monthly";
  testMode?: boolean;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getClientScheduledMeetingAction(
  clientId: string,
): Promise<{ date?: string }> {
  const user = await requireAuth();
  const parsedClientId = z.string().uuid().safeParse(clientId);
  if (!parsedClientId.success) return {};

  const client = await prisma.client.findFirst({
    where: { id: parsedClientId.data, companyId: user.companyId, deletedAt: null },
    select: { whatsappGroupId: true },
  });
  if (!client?.whatsappGroupId) return {};

  const meeting = await prisma.meeting.findFirst({
    where: {
      clientGroupId: client.whatsappGroupId,
      status: "confirmed",
      date: { gte: todayInBrazil() },
      user: { companyId: user.companyId },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: { date: true },
  });

  return meeting ? { date: meeting.date } : {};
}

function buildMessage({
  clientName,
  managerName,
  bookingUrl,
  durationMinutes,
  recurrence,
}: {
  clientName: string;
  managerName: string;
  bookingUrl: string;
  durationMinutes: number;
  recurrence: "weekly" | "monthly";
}): string {
  const duration = durationMinutes === 60 ? "1 hora" : `${durationMinutes} minutos`;
  const frequency = recurrence === "weekly" ? "semanal" : "mensal";

  return [
    `Olá, ${clientName} 👋`,
    "",
    `Sua reunião com ${managerName} já pode ser agendada.`,
    `Duração: ${duration} · Frequência: ${frequency}.`,
    "",
    `Escolha o melhor dia e horário pelo seu link pessoal: ${bookingUrl}`,
    "",
    "Este link é pessoal e válido por 7 dias. Não é necessário fazer login.",
  ].join("\n");
}

export async function sendClientBookingLinkAction(
  clientId: string,
): Promise<SendBookingLinkResult> {
  const user = await requireAuth();
  const parsedClientId = z.string().uuid().safeParse(clientId);
  if (!parsedClientId.success) return { error: "Cliente inválido." };

  const client = await prisma.client.findFirst({
    where: { id: parsedClientId.data, companyId: user.companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      meetingPlan: true,
      whatsappGroupId: true,
      managerId: true,
      manager: {
        select: {
          id: true,
          name: true,
          isActive: true,
          deletedAt: true,
          calendarSlug: true,
          calendarToken: true,
          _count: { select: { calendarAvailability: true } },
        },
      },
    },
  });
  if (!client) return { error: "Cliente não encontrado." };

  const manager = client.manager;
  if (!manager || !manager.isActive || manager.deletedAt) {
    return { error: "Defina um gestor ativo para este cliente antes de agendar." };
  }
  if (manager._count.calendarAvailability === 0) {
    return { error: `${manager.name} ainda não configurou horários disponíveis.` };
  }

  const needsExternalData = !client.meetingPlan?.trim() || !client.whatsappGroupId?.trim();
  const externalClient = needsExternalData
    ? await findClientForBooking({ email: client.email, name: client.name })
    : null;
  const clientPlan = client.meetingPlan?.trim() || externalClient?.plano?.trim();
  const clientGroupId = client.whatsappGroupId?.trim() || externalClient?.whatsapp_group_id?.trim();
  const clientEmail = client.email?.trim().toLowerCase()
    || externalClient?.email?.trim().toLowerCase()
    || null;

  if (!clientPlan) {
    return { error: "Defina o plano de reuniões deste cliente." };
  }
  if (!clientGroupId) {
    return { error: "Este cliente não possui grupo do WhatsApp configurado." };
  }

  let sheetClient;
  try {
    const sheet = await fetchPublishedClientSheet();
    const groupMatches = sheet.rows.filter(
      (row) => row.status === "active" && row.whatsappGroupId === clientGroupId,
    );
    if (groupMatches.length !== 1) {
      return { error: "Envio bloqueado: o grupo deste cliente não possui uma linha ativa e única na planilha." };
    }
    sheetClient = groupMatches[0];
  } catch {
    return { error: "Envio bloqueado: não foi possível validar o destino na planilha agora." };
  }

  const sheetManager = resolveManager(
    [{ id: manager.id, name: manager.name }],
    sheetClient.managerName,
    sheetClient.clientName,
  );
  if (
    sheetClient.clientName !== client.name
    || sheetClient.plan !== clientPlan
    || sheetManager?.id !== manager.id
  ) {
    return { error: "Envio bloqueado: cliente, gestor ou plano diverge da planilha. Aguarde a sincronização." };
  }

  const verifiedClientName = sheetClient.clientName;
  const verifiedClientPlan = sheetClient.plan;
  const verifiedGroupId = sheetClient.whatsappGroupId;

  try {
    const destinationMatches = await verifyWhatsAppGroupDestination(verifiedGroupId);
    if (!destinationMatches) {
      return { error: "Envio bloqueado: o ID do grupo não foi encontrado na UAZAPI." };
    }
  } catch {
    return { error: "Envio bloqueado: não foi possível confirmar o grupo diretamente na UAZAPI." };
  }

  let hostToken = manager.calendarSlug || manager.calendarToken;
  if (!hostToken) {
    hostToken = randomBytes(16).toString("hex");
    await prisma.user.update({
      where: { id: manager.id },
      data: { calendarToken: hostToken },
    });
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);
  const appUrl = process.env.NODE_ENV === "production"
    ? "https://task.agenciaf3f.com.br"
    : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const bookingUrl = `${appUrl}/agendar/acesso/${rawToken}`;
  const durationMinutes = getMeetingDurationMinutes(verifiedClientPlan);
  const recurrence = getMeetingRecurrence(verifiedClientPlan);
  const message = buildMessage({
    clientName: verifiedClientName,
    managerName: manager.name,
    bookingUrl,
    durationMinutes,
    recurrence,
  });

  const magicLink = await prisma.bookingMagicLink.create({
    data: {
      companyId: user.companyId,
      clientId: client.id,
      managerId: manager.id,
      createdById: user.userId,
      tokenHash,
      clientEmail,
      clientName: verifiedClientName,
      clientPlan: verifiedClientPlan,
      clientGroupId: verifiedGroupId,
      expiresAt,
    },
    select: { id: true },
  });

  const delivery = await sendWhatsAppText({
    groupId: verifiedGroupId,
    message,
    trackId: magicLink.id,
  });

  if (!delivery.delivered) {
    if (delivery.reason !== "request_failed") {
      await prisma.bookingMagicLink.update({
        where: { id: magicLink.id },
        data: { revokedAt: new Date() },
      });
    }
    return {
      error: delivery.reason === "not_configured"
        ? "A integração com a UAZAPI não está configurada corretamente."
        : delivery.reason === "rejected"
          ? `A UAZAPI recusou o envio${delivery.status ? ` (HTTP ${delivery.status})` : ""}.`
        : "Não foi possível confirmar o envio. Verifique o grupo antes de tentar novamente.",
    };
  }

  await prisma.bookingMagicLink.updateMany({
    where: {
      clientId: client.id,
      id: { not: magicLink.id },
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { revokedAt: new Date() },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "meeting.booking_link_sent",
    resourceType: "client",
    resourceId: client.id,
    newValue: {
      managerId: manager.id,
      durationMinutes,
      recurrence,
      expiresAt: expiresAt.toISOString(),
      testMode: delivery.mode === "test",
    },
  });

  return { success: true, durationMinutes, recurrence, testMode: delivery.mode === "test" };
}
