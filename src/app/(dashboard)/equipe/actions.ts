"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/email";

const createUserSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  role: z.enum(["admin", "manager", "supervisor", "member"]),
  sectorId: z.string().uuid().optional().or(z.literal("")),
});

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
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

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (existing) return { error: "E-mail já cadastrado." };

  const [company] = await Promise.all([
    prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true } }),
  ]);

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const newUser = await prisma.user.create({
    data: {
      companyId: user.companyId,
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      role: parsed.data.role,
      mustChangePassword: true,
    },
  });

  if (parsed.data.sectorId) {
    await prisma.sectorMember.create({
      data: { sectorId: parsed.data.sectorId, userId: newUser.id },
    });
  }

  // Send invite email (fire-and-forget — don't block on email errors)
  sendInviteEmail({
    toEmail: parsed.data.email.toLowerCase(),
    toName: parsed.data.name,
    tempPassword,
    invitedByName: user.name,
    companyName: company?.name ?? "F3F",
  }).catch((err) => console.error("[email] Invite error:", err));

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
