"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser, hashPassword, verifyPassword } from "@/lib/auth";

const changeSchema = z.object({
  newPassword: z.string().min(6, "Mínimo 6 caracteres"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export async function forceChangePasswordAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const parsed = changeSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const newHash = await hashPassword(parsed.data.newPassword);

  await prisma.user.update({
    where: { id: user.userId },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  redirect("/dashboard");
}
