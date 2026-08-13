"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarMeeting, deleteCalendarMeeting } from "@/lib/google-calendar";
import { isPastDate, nowInBrazil, todayInBrazil } from "@/lib/meeting-recurrence";
import { resolvePlanCalendarId } from "@/lib/plan-calendar";
import { isElevated } from "@/lib/task-visibility";
import { logActivity } from "@/lib/activity";

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
const manualMeetingSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório.").max(255),
  hostId: z.string().uuid("Responsável inválido."),
  clientId: z.string().uuid().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  startTime: timeSchema,
  endTime: timeSchema,
  audienceUserIds: z.array(z.string().uuid()).max(100),
});

export async function createManualMeetingAction(
  formData: FormData,
): Promise<{ success?: true; error?: string }> {
  const user = await requireAuth();
  const parsed = manualMeetingSchema.safeParse({
    title: formData.get("title"),
    hostId: formData.get("hostId"),
    clientId: formData.get("clientId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    audienceUserIds: formData.getAll("audienceUserIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { title, date, startTime, endTime, clientId } = parsed.data;
  if (isPastDate(date)) return { error: "Não é possível criar reunião no passado." };
  if (endTime <= startTime) return { error: "O horário final deve ser posterior ao inicial." };
  const now = nowInBrazil();
  if (date === now.date && startTime <= now.time) {
    return { error: "O horário inicial deve estar no futuro." };
  }

  const hostId = isElevated(user.role) ? parsed.data.hostId : user.userId;
  const [host, client] = await Promise.all([
    prisma.user.findFirst({
      where: { id: hostId, companyId: user.companyId, isActive: true, deletedAt: null },
      select: { id: true, name: true, calendarSlug: true, googleCalendarId: true },
    }),
    clientId
      ? prisma.client.findFirst({
          where: { id: clientId, companyId: user.companyId, deletedAt: null },
          select: { name: true, whatsappGroupId: true, meetingPlan: true },
        })
      : null,
  ]);
  if (!host) return { error: "Responsável não encontrado." };
  if (clientId && !client) return { error: "Cliente não encontrado." };
  const isInternalHost = host.calendarSlug === "admin" || host.name.trim().toLowerCase() === "admin f3f";
  const audienceUserIds = isInternalHost ? [...new Set(parsed.data.audienceUserIds)] : [];
  if (audienceUserIds.length > 0) {
    const audienceCount = await prisma.user.count({
      where: { id: { in: audienceUserIds }, companyId: user.companyId, isActive: true, deletedAt: null },
    });
    if (audienceCount !== audienceUserIds.length) return { error: "Uma ou mais pessoas selecionadas são inválidas." };
  }
  const displayName = client ? `${title} · ${client.name}` : title;

  const conflict = await prisma.meeting.findFirst({
    where: {
      userId: host.id,
      date,
      status: "confirmed",
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { id: true },
  });
  if (conflict) return { error: "Este responsável já possui uma reunião nesse horário." };

  const meeting = await prisma.meeting.create({
    data: {
      userId: host.id,
      date,
      startTime,
      endTime,
      status: "confirmed",
      clientName: displayName,
      clientGroupId: client?.whatsappGroupId ?? null,
      clientPlan: client?.meetingPlan ?? null,
      visibleTo: audienceUserIds.length
        ? { create: audienceUserIds.map((userId) => ({ userId })) }
        : undefined,
    },
    select: { id: true },
  });

  const calendarId = await resolvePlanCalendarId(client?.meetingPlan ?? null)
    ?? host.googleCalendarId
    ?? undefined;
  const googleEventId = await createCalendarMeeting({
    date,
    startTime,
    endTime,
    ownerName: host.name,
    clientName: displayName,
    clientGroupId: client?.whatsappGroupId ?? undefined,
    calendarId,
  });
  if (googleEventId) {
    await prisma.meeting.update({ where: { id: meeting.id }, data: { googleEventId } });
  }

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "meeting.created",
    resourceType: "meeting",
    resourceId: meeting.id,
    newValue: { title, clientId: clientId || null, hostId: host.id, date, startTime, endTime, audienceUserIds },
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
      ...(isElevated(user.role) ? {} : { userId: user.userId }),
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
      ...(isElevated(user.role) ? {} : { userId: user.userId }),
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
