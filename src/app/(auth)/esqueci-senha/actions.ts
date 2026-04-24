"use server";

import { randomBytes } from "crypto";
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
  });

  // Responde sucesso mesmo se email não existir (evitar enumeração)
  if (!user) return { success: true };

  // Gerar token seguro (64 caracteres hex)
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hora

  // Salvar token no banco
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  // Enviar email com link de reset
  await sendPasswordResetEmail({
    toEmail: user.email,
    toName: user.name,
    resetToken: token,
  });

  return { success: true };
}
