"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/notifications";

export async function markAllReadAction() {
  const user = await requireAuth();
  await markNotificationsRead(user.userId);
  revalidatePath("/notificacoes");
}

export async function markOneReadAction(notificationId: string) {
  const user = await requireAuth();
  await markNotificationsRead(user.userId, [notificationId]);
  revalidatePath("/notificacoes");
}
