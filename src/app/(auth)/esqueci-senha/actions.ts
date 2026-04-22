"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

export type ForgotState = { error?: string; success?: boolean };

export async function forgotPasswordAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) return { error: "E-mail obrigatório." };

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null, isActive: true },
    select: { id: true, name: true, email: true },
  });

  // Responde sucesso mesmo se email não existir (evitar enumeração)
  if (!user) return { success: true };

  // Invalida tokens antigos do mesmo usuário
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  sendPasswordResetEmail({
    toEmail: user.email,
    toName: user.name,
    resetToken: token,
  }).catch((err) => console.error("[email] Password reset error:", err));

  return { success: true };
}
