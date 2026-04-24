"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  password: z.string().min(8, "Mínimo 8 caracteres"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export type ResetState = { error?: string };

export async function resetPasswordAction(
  _token: string,
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // Validar token
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token: _token },
    include: { user: true },
  });

  if (!resetToken) {
    return { error: "Link de reset inválido ou expirado." };
  }

  // Verificar expiração
  if (resetToken.expiresAt < new Date()) {
    return { error: "Link expirado. Solicite um novo link de redefinição." };
  }

  // Verificar se já foi usado
  if (resetToken.usedAt) {
    return { error: "Este link já foi utilizado." };
  }

  // Hash da nova senha
  const passwordHash = await hash(parsed.data.password, 10);

  // Atualizar senha e marcar token como usado
  await Promise.all([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  redirect("/login");
}
