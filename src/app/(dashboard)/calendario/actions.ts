"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarMeeting, deleteCalendarMeeting, updateCalendarMeeting } from "@/lib/google-calendar";
import { isPastDate, nowInBrazil, todayInBrazil } from "@/lib/meeting-recurrence";
import { resolvePlanCalendarId } from "@/lib/plan-calendar";
import { isElevated } from "@/lib/task-visibility";
import { logActivity } from "@/lib/activity";
import { applyClientResponse, cancelMeetingReminders, scheduleMeetingReminders } from "@/lib/meeting-reminders";

export type AvailabilityInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}[];

export async function saveAvailabilityAction(
  data: AvailabilityInput,
): Promise<{ success?: boolean; error?: string }> {
  const user = await requireAuth();

  for (const d of data) {
    if (d.dayOfWeek < 0 || d.dayOfWeek > 6) {
      return { error: `Dia da semana inválido: ${d.dayOfWeek}` };
    }
    if (!/^\d{2}:\d{2}$/.test(d.startTime) || !/^\d{2}:\d{2}$/.test(d.endTime)) {
      return { error: `Formato de horário inválido (esperado HH:MM).` };
    }
    if (d.endTime <= d.startTime) {
      return { error: `Horário inválido no dia ${d.dayOfWeek}: fim deve ser após início.` };
    }
  }

  // Atomicidade: se algum step falhar, mantém estado anterior.
  await prisma.$transaction([
    prisma.calendarAvailability.deleteMany({ where: { userId: user.userId } }),
    ...(data.length > 0
      ? [
          prisma.calendarAvailability.createMany({
            data: data.map((d) => ({
              userId: user.userId,
              dayOfWeek: d.dayOfWeek,
              startTime: d.startTime,
              endTime: d.endTime,
            })),
          }),
        ]
      : []),
  ]);

  revalidatePath("/calendario");
  return { success: true };
}

export type CancelScope = "single" | "series";

/** Mesma escolha do Google: só esta ocorrência, ou esta e as seguintes. */
export type DeleteScope = "single" | "series";

const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");
const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Data inválida.");
const manualMeetingSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório.").max(255),
  hostId: z.string().uuid("Responsável inválido."),
  clientId: z.string().uuid().or(z.literal("")),
  startDate: dateSchema,
  endDate: dateSchema,
  startTime: timeSchema.or(z.literal("")),
  endTime: timeSchema.or(z.literal("")),
  isAllDay: z.boolean(),
  participantUserIds: z.array(z.string().uuid()).max(100),
  guestEmails: z.string().max(5000),
});

function parseGuestEmails(raw: string): { emails?: string[]; error?: string } {
  const emails = [...new Set(raw.split(/[\s,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (emails.length > 50) return { error: "Adicione no máximo 50 convidados externos." };
  const invalid = emails.find((email) => !z.string().email().safeParse(email).success);
  if (invalid) return { error: `E-mail de convidado inválido: ${invalid}` };
  return { emails };
}

export async function createManualMeetingAction(
  formData: FormData,
): Promise<{ success?: true; error?: string }> {
  const user = await requireAuth();
  const parsed = manualMeetingSchema.safeParse({
    title: formData.get("title"),
    hostId: formData.get("hostId"),
    clientId: formData.get("clientId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    startTime: formData.get("startTime") ?? "",
    endTime: formData.get("endTime") ?? "",
    isAllDay: formData.get("isAllDay") === "on",
    participantUserIds: formData.getAll("participantUserIds"),
    guestEmails: formData.get("guestEmails") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { title, startDate, endDate, clientId, isAllDay } = parsed.data;
  const startTime = isAllDay ? "00:00" : parsed.data.startTime;
  const endTime = isAllDay ? "23:59" : parsed.data.endTime;
  if (!startTime || !endTime) return { error: "Informe os horários de início e término." };
  if (isPastDate(startDate)) return { error: "Não é possível criar reunião no passado." };
  if (endDate < startDate) return { error: "A data final não pode ser anterior à data inicial." };
  const durationDays = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000;
  if (durationDays > 731) return { error: "A reunião pode durar no máximo 2 anos." };
  if (endDate === startDate && endTime <= startTime) {
    return { error: "O horário final deve ser posterior ao inicial." };
  }
  const now = nowInBrazil();
  if (!isAllDay && startDate === now.date && startTime <= now.time) {
    return { error: "O horário inicial deve estar no futuro." };
  }
  const parsedGuests = parseGuestEmails(parsed.data.guestEmails);
  if (parsedGuests.error) return { error: parsedGuests.error };
  const guestEmails = parsedGuests.emails ?? [];

  const hostId = isElevated(user.role) ? parsed.data.hostId : user.userId;
  const participantUserIds = [...new Set(parsed.data.participantUserIds)].filter((id) => id !== hostId);
  const [host, participants, client] = await Promise.all([
    prisma.user.findFirst({
      where: { id: hostId, companyId: user.companyId, isActive: true, deletedAt: null },
      select: { id: true, name: true, email: true, googleCalendarId: true },
    }),
    participantUserIds.length
      ? prisma.user.findMany({
          where: { id: { in: participantUserIds }, companyId: user.companyId, isActive: true, deletedAt: null },
          select: { id: true, name: true, email: true },
        })
      : [],
    clientId
      ? prisma.client.findFirst({
          where: { id: clientId, companyId: user.companyId, deletedAt: null },
          select: { name: true, whatsappGroupId: true, meetingPlan: true },
        })
      : null,
  ]);
  if (!host) return { error: "Responsável não encontrado." };
  if (clientId && !client) return { error: "Cliente não encontrado." };
  if (participants.length !== participantUserIds.length) {
    return { error: "Um ou mais responsáveis adicionais são inválidos." };
  }
  const displayName = client ? `${title} · ${client.name}` : title;

  const meeting = await prisma.meeting.create({
    data: {
      userId: host.id,
      date: startDate,
      endDate,
      startTime,
      endTime,
      isAllDay,
      guestEmails,
      status: "confirmed",
      clientName: displayName,
      clientGroupId: client?.whatsappGroupId ?? null,
      clientPlan: client?.meetingPlan ?? null,
      visibleTo: participantUserIds.length
        ? { create: participantUserIds.map((userId) => ({ userId })) }
        : undefined,
    },
    select: { id: true },
  });

  const calendarId = await resolvePlanCalendarId(client?.meetingPlan ?? null)
    ?? host.googleCalendarId
    ?? undefined;
  const googleEventId = await createCalendarMeeting({
    date: startDate,
    endDate,
    startTime,
    endTime,
    isAllDay,
    ownerName: host.name,
    clientName: displayName,
    clientGroupId: client?.whatsappGroupId ?? undefined,
    attendeeEmails: [...participants.map((participant) => participant.email), ...guestEmails],
    calendarId,
  });
  if (googleEventId) {
    await prisma.meeting.update({ where: { id: meeting.id }, data: { googleEventId } });
  }

  after(async () => {
    try {
      await scheduleMeetingReminders(meeting.id);
    } catch (error) {
      console.error("[calendario] falha ao agendar lembretes", { meetingId: meeting.id, error });
    }
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "meeting.created",
    resourceType: "meeting",
    resourceId: meeting.id,
    newValue: {
      title,
      clientId: clientId || null,
      hostId: host.id,
      participantUserIds,
      guestEmails,
      startDate,
      endDate,
      startTime,
      endTime,
      isAllDay,
    },
  });
  revalidatePath("/calendario");
  return { success: true };
}

export async function updateManualMeetingAction(
  formData: FormData,
): Promise<{ success?: true; error?: string; warning?: string }> {
  const user = await requireAuth();
  const meetingId = z.string().uuid().safeParse(formData.get("meetingId"));
  if (!meetingId.success) return { error: "Reunião inválida." };

  const existing = await prisma.meeting.findFirst({
    where: {
      id: meetingId.data,
      user: { companyId: user.companyId },
      ...(isElevated(user.role)
        ? {}
        : { OR: [{ userId: user.userId }, { visibleTo: { some: { userId: user.userId } } }] }),
    },
    select: {
      id: true,
      userId: true,
      date: true,
      endDate: true,
      startTime: true,
      endTime: true,
      isAllDay: true,
      clientName: true,
      clientGroupId: true,
      clientPlan: true,
      guestEmails: true,
      googleEventId: true,
      user: { select: { name: true, googleCalendarId: true } },
      visibleTo: { select: { userId: true } },
    },
  });
  if (!existing) return { error: "Reunião não encontrada ou sem permissão para editar." };

  const parsed = manualMeetingSchema.safeParse({
    title: formData.get("title"),
    hostId: formData.get("hostId"),
    clientId: formData.get("clientId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    startTime: formData.get("startTime") ?? "",
    endTime: formData.get("endTime") ?? "",
    isAllDay: formData.get("isAllDay") === "on",
    participantUserIds: formData.getAll("participantUserIds"),
    guestEmails: formData.get("guestEmails") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { title, startDate, endDate, clientId, isAllDay } = parsed.data;
  const startTime = isAllDay ? "00:00" : parsed.data.startTime;
  const endTime = isAllDay ? "23:59" : parsed.data.endTime;
  if (!startTime || !endTime) return { error: "Informe os horários de início e término." };
  if (endDate < startDate) return { error: "A data final não pode ser anterior à data inicial." };
  const durationDays = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000;
  if (durationDays > 731) return { error: "A reunião pode durar no máximo 2 anos." };
  if (endDate === startDate && endTime <= startTime) {
    return { error: "O horário final deve ser posterior ao inicial." };
  }
  const parsedGuests = parseGuestEmails(parsed.data.guestEmails);
  if (parsedGuests.error) return { error: parsedGuests.error };
  const guestEmails = parsedGuests.emails ?? [];

  const hostId = isElevated(user.role) ? parsed.data.hostId : existing.userId;
  const participantUserIds = [...new Set(parsed.data.participantUserIds)].filter((id) => id !== hostId);
  const [host, participants, client] = await Promise.all([
    prisma.user.findFirst({
      where: { id: hostId, companyId: user.companyId, isActive: true, deletedAt: null },
      select: { id: true, name: true, email: true, googleCalendarId: true },
    }),
    participantUserIds.length
      ? prisma.user.findMany({
          where: { id: { in: participantUserIds }, companyId: user.companyId, isActive: true, deletedAt: null },
          select: { id: true, name: true, email: true },
        })
      : [],
    clientId
      ? prisma.client.findFirst({
          where: { id: clientId, companyId: user.companyId, deletedAt: null },
          select: { name: true, whatsappGroupId: true, meetingPlan: true },
        })
      : null,
  ]);
  if (!host) return { error: "Responsável não encontrado." };
  if (clientId && !client) return { error: "Cliente não encontrado." };
  if (participants.length !== participantUserIds.length) {
    return { error: "Um ou mais responsáveis adicionais são inválidos." };
  }

  const displayName = client ? `${title} · ${client.name}` : title;
  await prisma.meeting.update({
    where: { id: existing.id },
    data: {
      userId: host.id,
      date: startDate,
      endDate,
      startTime,
      endTime,
      isAllDay,
      guestEmails,
      clientName: displayName,
      clientGroupId: client?.whatsappGroupId ?? null,
      clientPlan: client?.meetingPlan ?? null,
      visibleTo: {
        deleteMany: {},
        ...(participantUserIds.length
          ? { create: participantUserIds.map((participantUserId) => ({ userId: participantUserId })) }
          : {}),
      },
    },
  });

  const oldCalendarId = await resolvePlanCalendarId(existing.clientPlan)
    ?? existing.user.googleCalendarId
    ?? undefined;
  const newCalendarId = await resolvePlanCalendarId(client?.meetingPlan ?? null)
    ?? host.googleCalendarId
    ?? undefined;
  const calendarPayload = {
    date: startDate,
    endDate,
    startTime,
    endTime,
    isAllDay,
    ownerName: host.name,
    clientName: displayName,
    clientGroupId: client?.whatsappGroupId ?? undefined,
    attendeeEmails: [...participants.map((participant) => participant.email), ...guestEmails],
  };
  let warning: string | undefined;
  let nextGoogleEventId = existing.googleEventId;

  if (existing.googleEventId && oldCalendarId === newCalendarId) {
    const updated = await updateCalendarMeeting({
      googleEventId: existing.googleEventId,
      ...calendarPayload,
      calendarId: newCalendarId,
    });
    if (!updated) warning = "Evento salvo no Task, mas não foi possível atualizar o Google Calendar.";
  } else {
    let canCreateGoogleEvent = true;
    if (existing.googleEventId) {
      canCreateGoogleEvent = await deleteCalendarMeeting(existing.googleEventId, oldCalendarId);
    }
    if (canCreateGoogleEvent) {
      nextGoogleEventId = await createCalendarMeeting({ ...calendarPayload, calendarId: newCalendarId });
      if (!nextGoogleEventId && existing.googleEventId) {
        warning = "Evento salvo no Task, mas não foi possível recriá-lo no Google Calendar.";
      }
    } else {
      warning = "Evento salvo no Task, mas não foi possível movê-lo no Google Calendar.";
    }
  }
  if (nextGoogleEventId !== existing.googleEventId) {
    await prisma.meeting.update({ where: { id: existing.id }, data: { googleEventId: nextGoogleEventId } });
  }

  after(async () => {
    try {
      await cancelMeetingReminders([existing.id]);
      await scheduleMeetingReminders(existing.id);
    } catch (error) {
      console.error("[calendario] falha ao reagendar lembretes", { meetingId: existing.id, error });
    }
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "meeting.updated",
    resourceType: "meeting",
    resourceId: existing.id,
    oldValue: {
      hostId: existing.userId,
      participantUserIds: existing.visibleTo.map((item) => item.userId),
      guestEmails: existing.guestEmails,
      startDate: existing.date,
      endDate: existing.endDate ?? existing.date,
      startTime: existing.startTime,
      endTime: existing.endTime,
      isAllDay: existing.isAllDay,
      clientName: existing.clientName,
      clientGroupId: existing.clientGroupId,
    },
    newValue: {
      title,
      clientId: clientId || null,
      hostId: host.id,
      participantUserIds,
      guestEmails,
      startDate,
      endDate,
      startTime,
      endTime,
      isAllDay,
    },
  });
  revalidatePath("/calendario");
  return { success: true, warning };
}

export async function cancelMeetingAction(
  meetingId: string,
  scope: CancelScope = "single",
) {
  const user = await requireAuth();

  const meeting = await prisma.meeting.findFirst({
    where: {
      id: meetingId,
      user: { companyId: user.companyId },
      ...(isElevated(user.role)
        ? {}
        : { OR: [{ userId: user.userId }, { visibleTo: { some: { userId: user.userId } } }] }),
    },
    select: {
      id: true,
      userId: true,
      googleEventId: true,
      clientPlan: true,
      user: { select: { googleCalendarId: true } },
      recurrenceRule: true,
      recurrenceParentId: true,
    },
  });
  if (!meeting) return;

  const isRecurring = meeting.recurrenceRule != null || meeting.recurrenceParentId != null;

  // Sem recorrência: cancela só ela.
  if (!isRecurring || scope === "single") {
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: "cancelled" },
    });
    if (meeting.googleEventId) {
      const calendarId = await resolvePlanCalendarId(meeting.clientPlan)
        ?? meeting.user.googleCalendarId
        ?? undefined;
      await deleteCalendarMeeting(meeting.googleEventId, calendarId);
    }
    revalidatePath("/calendario");
    return;
  }

  // Série: cancela parent + todos os irmãos com date >= hoje, status confirmed.
  const parentId = meeting.recurrenceParentId ?? meeting.id;
  const today = todayInBrazil();

  const targets = await prisma.meeting.findMany({
    where: {
      userId: meeting.userId,
      user: { companyId: user.companyId },
      status: "confirmed",
      date: { gte: today },
      OR: [{ id: parentId }, { recurrenceParentId: parentId }],
    },
    select: {
      id: true,
      googleEventId: true,
      clientPlan: true,
      user: { select: { googleCalendarId: true } },
    },
  });

  if (targets.length === 0) {
    revalidatePath("/calendario");
    return;
  }

  await prisma.meeting.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { status: "cancelled" },
  });

  // Tira os lembretes da fila da UAZAPI. Sem isto o cliente receberia aviso de
  // reunião cancelada — a mensagem já está agendada do lado de lá.
  await cancelMeetingReminders(targets.map((t) => t.id));

  // Google deletes em paralelo (best-effort, fora da transação DB).
  await Promise.allSettled(
    targets
      .filter((t) => t.googleEventId)
      .map(async (t) => {
        const calendarId = await resolvePlanCalendarId(t.clientPlan)
          ?? t.user.googleCalendarId
          ?? undefined;
        await deleteCalendarMeeting(t.googleEventId!, calendarId);
      }),
  );

  revalidatePath("/calendario");
}

export async function deleteMeetingForeverAction(
  meetingId: string,
  scope: DeleteScope = "single",
): Promise<{ success?: true; error?: string }> {
  const user = await requireAuth();
  const meeting = await prisma.meeting.findFirst({
    where: {
      id: meetingId,
      user: { companyId: user.companyId },
      ...(isElevated(user.role)
        ? {}
        : { OR: [{ userId: user.userId }, { visibleTo: { some: { userId: user.userId } } }] }),
    },
    select: {
      id: true,
      userId: true,
      date: true,
      googleEventId: true,
      clientPlan: true,
      recurrenceParentId: true,
      user: { select: { googleCalendarId: true } },
      recurrenceChildren: {
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        select: { id: true },
      },
    },
  });
  if (!meeting) return { error: "Reunião não encontrada ou sem permissão." };

  if (scope === "series") {
    // "Esta e as seguintes", como no Google: apaga a partir da data desta
    // ocorrência, não do dia de hoje. Quem abre uma reunião passada de uma série
    // e manda apagar a série espera que ela suma dali para a frente.
    const parentId = meeting.recurrenceParentId ?? meeting.id;
    const alvos = await prisma.meeting.findMany({
      where: {
        userId: meeting.userId,
        user: { companyId: user.companyId },
        date: { gte: meeting.date },
        OR: [{ id: parentId }, { recurrenceParentId: parentId }],
      },
      select: {
        id: true,
        googleEventId: true,
        clientPlan: true,
        user: { select: { googleCalendarId: true } },
      },
    });

    // Antes do delete: a linha do lembrete sai por cascata e levaria o
    // folder_id junto, deixando a campanha viva e órfã na UAZAPI.
    await cancelMeetingReminders(alvos.map((alvo) => alvo.id));

    const falhasNoGoogle = await Promise.allSettled(
      alvos
        .filter((alvo) => alvo.googleEventId)
        .map(async (alvo) => {
          const calendarId = await resolvePlanCalendarId(alvo.clientPlan)
            ?? alvo.user.googleCalendarId
            ?? undefined;
          const ok = await deleteCalendarMeeting(alvo.googleEventId!, calendarId);
          if (!ok) throw new Error(alvo.id);
        }),
    );
    // Falha no Google não impede apagar aqui: o evento lá vira um resíduo
    // visível, enquanto uma reunião que não some do Task confunde mais.
    const naoApagados = falhasNoGoogle.filter((r) => r.status === "rejected").length;

    await prisma.meeting.deleteMany({ where: { id: { in: alvos.map((alvo) => alvo.id) } } });

    await logActivity({
      companyId: user.companyId,
      userId: user.userId,
      action: "meeting.deleted",
      resourceType: "meeting",
      resourceId: meeting.id,
      newValue: { escopo: "series", apagadas: alvos.length, aPartirDe: meeting.date },
    });
    revalidatePath("/calendario");
    return naoApagados > 0
      ? { error: `${alvos.length} reunião(ões) apagada(s), mas ${naoApagados} evento(s) continuam no Google Calendar.` }
      : { success: true };
  }

  if (meeting.googleEventId) {
    const calendarId = await resolvePlanCalendarId(meeting.clientPlan)
      ?? meeting.user.googleCalendarId
      ?? undefined;
    const deleted = await deleteCalendarMeeting(meeting.googleEventId, calendarId);
    if (!deleted) return { error: "Não foi possível remover o evento do Google Calendar." };
  }

  // Antes do delete: a linha do lembrete sai por cascata e levaria o folder_id
  // junto, deixando a campanha órfã e viva na UAZAPI.
  await cancelMeetingReminders([meeting.id]);

  await prisma.$transaction(async (transaction) => {
    const [nextParent, ...remainingChildren] = meeting.recurrenceChildren;
    if (nextParent) {
      await transaction.meeting.update({
        where: { id: nextParent.id },
        data: { recurrenceParentId: null },
      });
      if (remainingChildren.length > 0) {
        await transaction.meeting.updateMany({
          where: { id: { in: remainingChildren.map((child) => child.id) } },
          data: { recurrenceParentId: nextParent.id },
        });
      }
    }
    await transaction.meeting.delete({ where: { id: meeting.id } });
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "meeting.deleted",
    resourceType: "meeting",
    resourceId: meeting.id,
  });
  revalidatePath("/calendario");
  return { success: true };
}

export async function updateCalendarSlugAction(slug: string): Promise<{ error?: string; success?: true }> {
  const user = await requireAuth();
  const trimmed = slug.trim().toLowerCase();

  if (!trimmed) {
    await prisma.user.update({ where: { id: user.userId }, data: { calendarSlug: null } });
    revalidatePath("/calendario");
    return { success: true };
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(trimmed)) {
    return { error: "Use apenas letras minúsculas, números e hífen (3 a 60 caracteres)." };
  }

  const taken = await prisma.user.findFirst({
    where: { calendarSlug: trimmed, NOT: { id: user.userId } },
    select: { id: true },
  });
  if (taken) return { error: "Este link já está em uso por outro membro." };

  await prisma.user.update({
    where: { id: user.userId },
    data: { calendarSlug: trimmed },
  });
  revalidatePath("/calendario");
  return { success: true };
}

export async function getOrCreateCalendarToken(): Promise<string> {
  const user = await requireAuth();

  const existing = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { calendarToken: true },
  });

  if (existing?.calendarToken) return existing.calendarToken;

  const token = randomBytes(16).toString("hex");
  await prisma.user.update({
    where: { id: user.userId },
    data: { calendarToken: token },
  });

  return token;
}

/**
 * Marca (ou desmarca) a confirmação do cliente pela tela, sem depender de ele
 * apertar o botão do WhatsApp.
 *
 * Na prática o cliente muitas vezes responde por áudio, por telefone ou na
 * própria reunião anterior — e nesses casos a agenda continuava dizendo
 * "aguardando confirmação". Aqui o gestor registra o que já sabe.
 *
 * Passa pelo MESMO caminho do botão (applyClientResponse), então tem os mesmos
 * efeitos: os lembretes que ainda não saíram são remarcados sem os botões, e
 * "não vai conseguir" cancela a reunião e libera o horário no Google.
 */
export async function setMeetingClientResponseAction(
  meetingId: string,
  response: "confirmed" | "declined" | "clear",
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (!user.companyId || !user.userId) return { error: "Sessão inválida." };

  // Mesma regra de visibilidade das outras ações da agenda: dono da reunião,
  // quem enxerga ela, ou gestão. Filtrar na consulta evita revelar por
  // diferença de mensagem que a reunião existe.
  const meeting = await prisma.meeting.findFirst({
    where: {
      id: meetingId,
      user: { companyId: user.companyId },
      ...(isElevated(user.role)
        ? {}
        : { OR: [{ userId: user.userId }, { visibleTo: { some: { userId: user.userId } } }] }),
    },
    select: { id: true, clientResponse: true },
  });
  if (!meeting) return { error: "Reunião não encontrada." };

  if (response === "clear") {
    if (!meeting.clientResponse) return { success: true };
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { clientResponse: null, clientRespondedAt: null },
    });
    // Volta a perguntar: os lembretes que ainda não saíram precisam levar os
    // botões de novo, senão o cliente perde a chance de responder.
    await cancelMeetingReminders([meeting.id]);
    await scheduleMeetingReminders(meeting.id);
    await logActivity({
      companyId: user.companyId,
      userId: user.userId,
      action: "update",
      resourceType: "meeting",
      resourceId: meeting.id,
      newValue: { clientResponse: null, origem: "manual" },
    });
    revalidatePath("/calendario");
    return { success: true };
  }

  const resultado = await applyClientResponse(meeting.id, response);
  if (!resultado.ok) {
    const motivos: Record<string, string> = {
      not_found: "Reunião não encontrada.",
      already_cancelled: "Esta reunião já está cancelada.",
    };
    return { error: motivos[resultado.reason] ?? "Não foi possível registrar a resposta." };
  }

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "update",
    resourceType: "meeting",
    resourceId: meeting.id,
    newValue: { clientResponse: response, origem: "manual" },
  });

  revalidatePath("/calendario");
  return { success: true };
}
