"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const createUserSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  role: z.enum(["admin", "manager", "supervisor", "member"]),
  sectorId: z.string().uuid().optional().or(z.literal("")),
});

export async function createUserAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireRole(["admin", "manager"]);

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    sectorId: formData.get("sectorId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  const emailLower = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: emailLower },
    select: { id: true, mustChangePassword: true, lastLoginAt: true },
  });

  // Bloquear apenas se o usuário já ativou a conta (já fez login)
  if (existing && existing.lastLoginAt !== null) {
    return { error: "E-mail já pertence a um membro ativo." };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");

  // Se existia mas nunca ativou, limpar o registro antigo para re-convidar
  if (existing) {
    await prisma.sectorMember.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
    // Deletar também do Supabase Auth para poder re-convidar
    const supabaseUsers = await supabaseAdmin.auth.admin.listUsers();
    const supabaseUser = supabaseUsers.data.users.find((u) => u.email === emailLower);
    if (supabaseUser) {
      await supabaseAdmin.auth.admin.deleteUser(supabaseUser.id);
    }
  }

  const newUser = await prisma.user.create({
    data: {
      companyId: user.companyId,
      name: parsed.data.name,
      email: emailLower,
      passwordHash: "supabase-auth",
      role: parsed.data.role,
      mustChangePassword: true,
    },
  });

  const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(emailLower, {
    redirectTo: `${appUrl}/auth/callback`,
    data: { name: parsed.data.name },
  });

  if (inviteError) {
    await prisma.user.delete({ where: { id: newUser.id } });
    console.error("[invite] Supabase error:", inviteError);
    if (inviteError.message?.includes("rate limit")) {
      return { error: "Limite de emails atingido. Aguarde alguns minutos e tente novamente." };
    }
    return { error: "Erro ao enviar convite. Tente novamente." };
  }

  if (parsed.data.sectorId) {
    await prisma.sectorMember.create({
      data: { sectorId: parsed.data.sectorId, userId: newUser.id },
    });
  }

  revalidatePath("/equipe");
  return { success: true };
}

export async function toggleUserActiveAction(targetUserId: string) {
  const user = await requireRole(["admin"]);

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, companyId: user.companyId },
  });
  if (!target) return;

  await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: !target.isActive },
  });

  revalidatePath("/equipe");
}

export async function deleteUserAction(targetUserId: string): Promise<{ error?: string }> {
  const user = await requireRole(["admin"]);

  if (targetUserId === user.userId) {
    return { error: "Você não pode excluir sua própria conta." };
  }

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, companyId: user.companyId, deletedAt: null },
    select: {
      id: true,
      email: true,
      _count: { select: { assignedTasks: { where: { deletedAt: null, status: { notIn: ["done", "cancelled"] } } } } },
    },
  });
  if (!target) return { error: "Usuário não encontrado." };

  if (target._count.assignedTasks > 0) {
    return { error: `Este membro tem ${target._count.assignedTasks} tarefa(s) ativa(s). Reatribua-as antes de excluir.` };
  }

  // Remove from Supabase Auth
  const { data: authUser } = await supabaseAdmin.auth.admin.listUsers();
  const supaUser = authUser.users.find((u) => u.email === target.email);
  if (supaUser) {
    await supabaseAdmin.auth.admin.deleteUser(supaUser.id);
  }

  // Reassign records with Restrict FK before hard delete
  await prisma.task.updateMany({
    where: { createdById: targetUserId },
    data: { createdById: user.userId },
  });
  await prisma.project.updateMany({
    where: { createdById: targetUserId },
    data: { createdById: user.userId },
  });
  await prisma.template.updateMany({
    where: { createdById: targetUserId },
    data: { createdById: user.userId },
  });

  // Hard delete — remove completely from DB
  await prisma.sectorMember.deleteMany({ where: { userId: targetUserId } });
  await prisma.user.delete({ where: { id: targetUserId } });

  revalidatePath("/equipe");
  return {};
}
