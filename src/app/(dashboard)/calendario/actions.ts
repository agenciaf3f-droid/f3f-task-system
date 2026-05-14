"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteCalendarMeeting } from "@/lib/google-calendar";
import { todayInBrazil } from "@/lib/meeting-recurrence";

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

export async function cancelMeetingAction(
  meetingId: string,
  scope: CancelScope = "single",
) {
  const user = await requireAuth();

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, userId: user.userId },
    select: {
      id: true,
      googleEventId: true,
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
      await deleteCalendarMeeting(meeting.googleEventId);
    }
    revalidatePath("/calendario");
    return;
  }

  // Série: cancela parent + todos os irmãos com date >= hoje, status confirmed.
  const parentId = meeting.recurrenceParentId ?? meeting.id;
  const today = todayInBrazil();

  const targets = await prisma.meeting.findMany({
    where: {
      userId: user.userId,
      status: "confirmed",
      date: { gte: today },
      OR: [{ id: parentId }, { recurrenceParentId: parentId }],
    },
    select: { id: true, googleEventId: true },
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
      .map((t) => deleteCalendarMeeting(t.googleEventId!)),
  );

  revalidatePath("/calendario");
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
