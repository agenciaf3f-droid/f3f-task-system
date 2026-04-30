"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteCalendarMeeting } from "@/lib/google-calendar";

export type AvailabilityInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}[];

export async function saveAvailabilityAction(data: AvailabilityInput) {
  const user = await requireAuth();

  // Delete all existing, then recreate
  await prisma.calendarAvailability.deleteMany({ where: { userId: user.userId } });

  if (data.length > 0) {
    await prisma.calendarAvailability.createMany({
      data: data.map((d) => ({
        userId: user.userId,
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
      })),
    });
  }

  revalidatePath("/calendario");
  return { success: true };
}

export async function cancelMeetingAction(meetingId: string) {
  const user = await requireAuth();

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, userId: user.userId },
    select: { googleEventId: true },
  });

  await prisma.meeting.updateMany({
    where: { id: meetingId, userId: user.userId },
    data: { status: "cancelled" },
  });

  if (meeting?.googleEventId) {
    await deleteCalendarMeeting(meeting.googleEventId);
  }

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
