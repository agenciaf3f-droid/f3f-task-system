"use server";

import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { findClientForBooking } from "@/lib/external-db";
import { getMeetingDurationMinutes, getMeetingRecurrence } from "@/lib/meeting-duration";
import { isUazapiTestMode, sendWhatsAppText } from "@/lib/whatsapp";
import { logActivity } from "@/lib/activity";
import { projectVisibilityFilter } from "@/lib/task-visibility";

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

function buildMessage({
  clientName,
  managerName,
  bookingUrl,
  durationMinutes,
  recurrence,
  testMode,
}: {
  clientName: string;
  managerName: string;
  bookingUrl: string;
  durationMinutes: number;
  recurrence: "weekly" | "monthly";
  testMode: boolean;
}): string {
  const firstName = clientName.trim().split(/\s+/)[0] || clientName;
  const duration = durationMinutes === 60 ? "1 hora" : `${durationMinutes} minutos`;
  const frequency = recurrence === "weekly" ? "semanal" : "mensal";

  return [
    ...(testMode ? ["🧪 TESTE DO AGENDAMENTO", ""] : []),
    `Olá, ${firstName}! 👋`,
    "",
    `Sua reunião com ${managerName} já pode ser agendada.`,
    `Duração: ${duration} · Frequência: ${frequency}.`,
    "",
    "Escolha o melhor dia e horário pelo seu link pessoal:",
    bookingUrl,
    "",
    "Este link é pessoal e válido por 7 dias. Não é necessário fazer login.",
  ].join("\n");
}

export async function sendClientBookingLinkAction(
  clientId: string,
): Promise<SendBookingLinkResult> {
  const user = await requireAuth();
  const testMode = isUazapiTestMode();
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

  if (user.role === "member" && client.managerId !== user.userId) {
    const visibleProject = await prisma.project.findFirst({
      where: {
        clientId: client.id,
        deletedAt: null,
        AND: projectVisibilityFilter(user),
      },
      select: { id: true },
    });
    if (!visibleProject) return { error: "Você não tem permissão para enviar este link." };
  }

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
  const clientName = externalClient?.nome?.trim() || client.name;
  const clientEmail = client.email?.trim().toLowerCase()
    || externalClient?.email?.trim().toLowerCase()
    || null;

  if (!clientPlan) {
    return { error: "Defina o plano de reuniões deste cliente." };
  }
  if (!clientGroupId) {
    return { error: "Este cliente não possui grupo do WhatsApp configurado." };
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
  const durationMinutes = getMeetingDurationMinutes(clientPlan);
  const recurrence = getMeetingRecurrence(clientPlan);
  const message = buildMessage({
    clientName,
    managerName: manager.name,
    bookingUrl,
    durationMinutes,
    recurrence,
    testMode,
  });

  const magicLink = await prisma.bookingMagicLink.create({
    data: {
      companyId: user.companyId,
      clientId: client.id,
      managerId: manager.id,
      createdById: user.userId,
      tokenHash,
      clientEmail,
      clientName,
      clientPlan,
      clientGroupId,
      expiresAt,
    },
    select: { id: true },
  });

  const delivery = await sendWhatsAppText({
    groupId: clientGroupId,
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
