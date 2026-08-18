"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarMeeting, deleteCalendarMeeting } from "@/lib/google-calendar";
import { isPastDate, nowInBrazil, todayInBrazil } from "@/lib/meeting-recurrence";
import { resolvePlanCalendarId } from "@/lib/plan-calendar";
import { isElevated } from "@/lib/task-visibility";
import { logActivity } from "@/lib/activity";
import { cancelMeetingReminders, scheduleMeetingReminders } from "@/lib/meeting-reminders";

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

function eventStart(date: string, time: string): string {
  return `${date}T${time}`;
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
  const responsibleIds = [host.id, ...participantUserIds];

  const candidates = await prisma.meeting.findMany({
    where: {
      user: { companyId: user.companyId },
      status: "confirmed",
      date: { lte: endDate },
      AND: [
        { OR: [{ endDate: { gte: startDate } }, { endDate: null, date: { gte: startDate } }] },
        { OR: [{ userId: { in: responsibleIds } }, { visibleTo: { some: { userId: { in: responsibleIds } } } }] },
      ],
    },
    select: {
      id: true,
      userId: true,
      date: true,
      endDate: true,
      startTime: true,
      endTime: true,
      visibleTo: { select: { userId: true } },
    },
  });
  const requestedStart = eventStart(startDate, startTime);
  const requestedEnd = eventStart(endDate, endTime);
  const conflict = candidates.find((meeting) => {
    const meetingEndDate = meeting.endDate ?? meeting.date;
    const overlaps = requestedStart < eventStart(meetingEndDate, meeting.endTime)
      && requestedEnd > eventStart(meeting.date, meeting.startTime);
    if (!overlaps) return false;
    const meetingResponsibleIds = new Set([meeting.userId, ...meeting.visibleTo.map((item) => item.userId)]);
    return responsibleIds.some((id) => meetingResponsibleIds.has(id));
  });
  if (conflict) return { error: "Um dos responsáveis já possui uma reunião nesse período." };

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
