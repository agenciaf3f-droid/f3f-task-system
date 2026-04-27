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

export async function getOrCreateCalendarToken(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarToken: true },
  });

  if (existing?.calendarToken) return existing.calendarToken;

  const token = randomBytes(16).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: { calendarToken: token },
  });

  return token;
}
