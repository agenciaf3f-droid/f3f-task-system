"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/email";
import { listAllCalendarSummaries } from "@/lib/google-calendar";
import { centralEnabled, centralProvisionTaskUser } from "@/lib/f3f-central";

const createUserSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  role: z.enum(["admin", "manager", "supervisor", "member"]),
  sectorId: z.string().uuid().optional().or(z.literal("")),
});

// Gerar senha temporária aleatória
function generateTempPassword(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase();
}

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
    select: { id: true, mustChangePassword: true, lastLoginAt: true, companyId: true },
  });

  if (existing) {
    // Bloquear se já ativou a conta (em qualquer empresa)
    if (existing.lastLoginAt !== null) {
      return { error: "E-mail já pertence a um membro ativo." };
    }
    // E-mail é único globalmente, mas só podemos reciclar registro
    // pendente que pertença à MESMA empresa do convidador.
    if (existing.companyId !== user.companyId) {
      return { error: "E-mail já está em uso em outra organização." };
    }
  }

  // Se existia na mesma empresa e nunca ativou, limpar registro antigo para re-convidar
  if (existing) {
    await prisma.sectorMember.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  // Gerar senha temporária
  const tempPassword = generateTempPassword();
  const passwordHash = await hash(tempPassword, 10);

  // Buscar nome da empresa
  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { name: true },
  });

  const newUser = await prisma.user.create({
    data: {
      companyId: user.companyId,
      name: parsed.data.name,
      email: emailLower,
      passwordHash,
      role: parsed.data.role,
      mustChangePassword: true,
    },
  });

  // Provisionar no login central F3F. Se a pessoa já tem conta central
  // (veio de outro sistema da agência), a senha dela NÃO muda — o convite
  // então diz "use sua senha F3F" em vez de mandar senha temporária.
  let existedCentrally = false;
  if (centralEnabled()) {
    try {
      const central = await centralProvisionTaskUser({
        email: emailLower,
        name: parsed.data.name,
        tempPassword,
        localUserId: newUser.id,
      });
      existedCentrally = central.existedCentrally;
    } catch (error) {
      await prisma.sectorMember.deleteMany({ where: { userId: newUser.id } });
      await prisma.user.delete({ where: { id: newUser.id } });
      console.error("[invite] Central error:", error);
      return { error: "Erro ao criar login central. Tente novamente." };
    }
  }

  // Enviar convite via Resend
  try {
    await sendInviteEmail({
      toEmail: emailLower,
      toName: parsed.data.name,
      tempPassword,
      invitedByName: user.name,
      companyName: company?.name || "sua empresa",
      existingCentralAccount: existedCentrally,
    });
  } catch (error) {
    await prisma.user.delete({ where: { id: newUser.id } });
    console.error("[invite] Email error:", error);
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

const roleEnum = z.enum(["admin", "manager", "supervisor", "member"]);

export async function updateUserRoleAction(
  targetUserId: string,
  role: string,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireRole(["admin"]);

  const parsed = roleEnum.safeParse(role);
  if (!parsed.success) return { error: "Cargo inválido." };
  const newRole = parsed.data;

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, companyId: user.companyId, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!target) return { error: "Usuário não encontrado." };
  if (target.role === newRole) return { success: true };

  // Nunca deixar a empresa sem nenhum admin
  if (target.role === "admin" && newRole !== "admin") {
    const otherAdmins = await prisma.user.count({
      where: { companyId: user.companyId, role: "admin", isActive: true, deletedAt: null, id: { not: targetUserId } },
    });
    if (otherAdmins === 0) return { error: "A empresa precisa de pelo menos um admin." };
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
  });

  revalidatePath("/equipe");
  return { success: true };
}

export async function setUserGoogleCalendarAction(
  targetUserId: string,
  googleCalendarId: string | null,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireRole(["admin"]);
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, companyId: user.companyId },
    select: { id: true },
  });
  if (!target) return { error: "Usuário não encontrado." };

  const value = googleCalendarId?.trim() || null;
  try {
    await prisma.user.update({
      where: { id: targetUserId },
      data: { googleCalendarId: value },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique") || msg.includes("unique")) {
      return { error: "Essa agenda já está vinculada a outro gestor." };
    }
    return { error: msg };
  }

  revalidatePath("/equipe");
  return { success: true };
}

export async function listGoogleCalendarsAction(): Promise<{ id: string; summary: string }[]> {
  await requireRole(["admin"]);
  const list = await listAllCalendarSummaries();
  return list ?? [];
}

export async function toggleUserActiveAction(targetUserId: string) {
  const user = await requireRole(["admin"]);

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, companyId: user.companyId },
    select: { isActive: true },
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

  // Reassign records with Restrict FK before hard delete
  await prisma.$transaction([
    prisma.task.updateMany({
      where: { createdById: targetUserId },
      data: { createdById: user.userId },
    }),
    prisma.project.updateMany({
      where: { createdById: targetUserId },
      data: { createdById: user.userId },
    }),
    prisma.template.updateMany({
      where: { createdById: targetUserId },
      data: { createdById: user.userId },
    }),
    prisma.sectorMember.deleteMany({ where: { userId: targetUserId } }),
  ]);

  // Hard delete — remove completely from DB
  await prisma.user.delete({ where: { id: targetUserId } });

  revalidatePath("/equipe");
  return {};
}
