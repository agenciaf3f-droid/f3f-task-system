"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const sectorSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(255),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").optional().or(z.literal("")),
  managerId: z.string().uuid().optional().or(z.literal("")),
});

export async function createSectorAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireRole(["admin"]);

  const parsed = sectorSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    color: formData.get("color"),
    managerId: formData.get("managerId"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await prisma.sector.create({
    data: {
      companyId: user.companyId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      color: parsed.data.color || null,
      managerId: parsed.data.managerId || null,
    },
  });

  revalidatePath("/setores");
  return { success: true };
}

export async function deleteSectorAction(sectorId: string) {
  const user = await requireRole(["admin"]);
  await prisma.sector.update({
    where: { id: sectorId, companyId: user.companyId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/setores");
}

export async function addSectorMemberAction(sectorId: string, userId: string) {
  const user = await requireRole(["admin", "manager"]);

  const sector = await prisma.sector.findFirst({
    where: { id: sectorId, companyId: user.companyId },
  });
  if (!sector) return { error: "Setor não encontrado." };

  await prisma.sectorMember.upsert({
    where: { sectorId_userId: { sectorId, userId } },
    create: { sectorId, userId },
    update: {},
  });

  revalidatePath("/setores");
  return { success: true };
}

export async function removeSectorMemberAction(sectorId: string, userId: string) {
  const user = await requireRole(["admin", "manager"]);

  const sector = await prisma.sector.findFirst({
    where: { id: sectorId, companyId: user.companyId },
  });
  if (!sector) return;

  await prisma.sectorMember.delete({
    where: { sectorId_userId: { sectorId, userId } },
  });

  revalidatePath("/setores");
}
