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

export async function renameSectorAction(
  sectorId: string,
  name: string,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireRole(["admin", "manager", "supervisor"]);
  const trimmed = name.trim();
  if (!trimmed) return { error: "Nome obrigatório." };
  if (trimmed.length > 255) return { error: "Nome muito longo." };

  const sector = await prisma.sector.findFirst({
    where: { id: sectorId, companyId: user.companyId, deletedAt: null },
    select: { id: true },
  });
  if (!sector) return { error: "Setor não encontrado." };

  await prisma.sector.update({
    where: { id: sectorId, companyId: user.companyId },
    data: { name: trimmed },
  });

  revalidatePath("/setores");
  return { success: true };
}

export async function updateSectorColorAction(
  sectorId: string,
  color: string,
): Promise<{ error?: string; success?: boolean }> {
  // Mesma permissão de renomear: mexer no rótulo do setor, não na estrutura.
  const user = await requireRole(["admin", "manager", "supervisor"]);
  const parsed = sectorSchema.shape.color.safeParse(color);
  if (!parsed.success || !parsed.data) return { error: "Cor inválida." };

  const sector = await prisma.sector.findFirst({
    where: { id: sectorId, companyId: user.companyId, deletedAt: null },
    select: { id: true },
  });
  if (!sector) return { error: "Setor não encontrado." };

  // Grava em minúsculas: há setor antigo com hex em maiúsculas e a comparação
  // com a paleta na tela é literal.
  await prisma.sector.update({
    where: { id: sectorId, companyId: user.companyId },
    data: { color: parsed.data.toLowerCase() },
  });

  // A cor do setor aparece como etiqueta no card de tarefa, não só aqui.
  revalidatePath("/setores");
  revalidatePath("/dashboard");
  revalidatePath("/projetos");
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

  const [sector, target] = await Promise.all([
    prisma.sector.findFirst({
      where: { id: sectorId, companyId: user.companyId },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { id: userId, companyId: user.companyId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!sector) return { error: "Setor não encontrado." };
  if (!target) return { error: "Usuário não encontrado." };

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
