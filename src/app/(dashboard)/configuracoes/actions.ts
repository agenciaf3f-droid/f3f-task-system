"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/auth";

const profileSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(100),
  email: z.string().email("E-mail inválido"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual obrigatória"),
  newPassword: z.string().min(8, "Mínimo 8 caracteres"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const companySchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(255),
});

const webhookSchema = z.object({
  url: z.string().url("URL inválida"),
  secret: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export async function updateProfileAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await requireAuth();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { name, email } = parsed.data;

  const emailTaken = await prisma.user.findFirst({
    where: { email, id: { not: user.userId } },
  });
  if (emailTaken) return { error: "E-mail já está em uso por outro usuário." };

  await prisma.user.update({
    where: { id: user.userId },
    data: { name, email },
  });

  revalidatePath("/configuracoes");
  return { success: "Perfil atualizado com sucesso." };
}

export async function changePasswordAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await requireAuth();

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { passwordHash: true },
  });
  if (!dbUser) return { error: "Usuário não encontrado." };

  const valid = await verifyPassword(parsed.data.currentPassword, dbUser.passwordHash);
  if (!valid) return { error: "Senha atual incorreta." };

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: user.userId },
    data: { passwordHash: newHash },
  });

  return { success: "Senha alterada com sucesso." };
}

export async function updateCompanyAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await requireAuth();
  if (user.role !== "admin") return { error: "Sem permissão." };

  const parsed = companySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await prisma.company.update({
    where: { id: user.companyId },
    data: { name: parsed.data.name },
  });

  revalidatePath("/configuracoes");
  return { success: "Empresa atualizada com sucesso." };
}

export async function saveWebhookAction(
  _prev: { error?: string; success?: string },
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await requireAuth();
  if (user.role !== "admin") return { error: "Sem permissão." };

  const parsed = webhookSchema.safeParse({
    url: formData.get("url"),
    secret: formData.get("secret"),
    isActive: formData.get("isActive") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await prisma.webhookConfig.upsert({
    where: { companyId: user.companyId },
    create: {
      companyId: user.companyId,
      url: parsed.data.url,
      secret: parsed.data.secret || null,
      isActive: parsed.data.isActive ?? true,
    },
    update: {
      url: parsed.data.url,
      secret: parsed.data.secret || null,
      isActive: parsed.data.isActive ?? true,
    },
  });

  revalidatePath("/configuracoes");
  return { success: "Webhook salvo com sucesso." };
}
