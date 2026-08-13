"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import type { TaskPriority } from "@prisma/client";

const templateSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(255),
  description: z.string().optional(),
  category: z.string().optional(),
  sectorId: z.string().uuid().optional().or(z.literal("")),
});

const targetSectorIdsSchema = z.array(z.string().uuid()).max(50);

async function validateTargetSectors(companyId: string, ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];
  const sectors = await prisma.sector.findMany({
    where: { id: { in: uniqueIds }, companyId, deletedAt: null },
    select: { id: true },
  });
  return sectors.length === uniqueIds.length ? uniqueIds : null;
}

export async function createTemplateAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireAuth();
  const isPersonal = formData.get("isPersonal") === "1";
  if (!isPersonal && user.role !== "admin" && user.role !== "manager") {
    return { error: "Você não tem permissão para criar templates compartilhados." };
  }

  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    sectorId: formData.get("sectorId"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const targetSectorIdsParsed = targetSectorIdsSchema.safeParse(formData.getAll("targetSectorIds"));
  if (!targetSectorIdsParsed.success) return { error: "Setores inválidos." };
  const targetSectorIds = isPersonal && user.role === "admin"
    ? await validateTargetSectors(user.companyId, targetSectorIdsParsed.data)
    : [];
  if (targetSectorIds === null) return { error: "Um ou mais setores não pertencem à empresa." };

  // Parse template tasks from formData
  const taskTitles = formData.getAll("taskTitle[]") as string[];
  const taskDescriptions = formData.getAll("taskDescription[]") as string[];
  const taskDays = formData.getAll("taskDays[]") as string[];
  const taskPriorities = formData.getAll("taskPriority[]") as string[];

  if (taskTitles.filter((t) => t.trim()).length === 0) {
    return { error: "Adicione pelo menos uma tarefa ao template." };
  }

  const taskAssigneeIds = formData.getAll("taskAssigneeId[]") as string[];
  const taskSubtastsRaw = formData.getAll("taskSubtasks[]") as string[];

  const template = await prisma.template.create({
    data: {
      companyId: user.companyId,
      createdById: user.userId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: isPersonal ? null : parsed.data.category || null,
      sectorId: isPersonal ? null : parsed.data.sectorId || null,
      isPersonal,
      targetSectors: targetSectorIds.length
        ? { create: targetSectorIds.map((sectorId) => ({ sectorId })) }
        : undefined,
    },
  });

  const tasksToCreate = taskTitles
    .map((title, i) => ({
      title: title.trim(),
      description: (taskDescriptions[i] ?? "").trim(),
      days: taskDays[i],
      priority: taskPriorities[i],
      assigneeId: taskAssigneeIds[i] || null,
      subtasks: taskSubtastsRaw[i] ? (JSON.parse(taskSubtastsRaw[i]) as { title: string }[]) : [],
    }))
    .filter((t) => t.title);

  await Promise.all(
    tasksToCreate.map((t, i) => {
      const checklistItems = t.subtasks
        .map((st, j) => ({ title: st.title?.trim() ?? "", position: j }))
        .filter((st) => st.title);
      return prisma.templateTask.create({
        data: {
          templateId: template.id,
          title: t.title,
          description: t.description || null,
          priority: (t.priority || "medium") as TaskPriority,
          daysToComplete: t.days ? parseInt(t.days) : null,
          defaultAssigneeId: t.assigneeId || null,
          position: i,
          checklistItems: checklistItems.length ? { create: checklistItems } : undefined,
        },
      });
    }),
  );

  revalidatePath("/templates");
  redirect("/templates");
}

export async function updateTemplateAction(
  templateId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    sectorId: formData.get("sectorId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const taskTitles = formData.getAll("taskTitle[]") as string[];
  const taskDescriptions = formData.getAll("taskDescription[]") as string[];
  const taskDays = formData.getAll("taskDays[]") as string[];
  const taskPriorities = formData.getAll("taskPriority[]") as string[];
  const taskAssigneeIds = formData.getAll("taskAssigneeId[]") as string[];
  const taskSubtasksRaw = formData.getAll("taskSubtasks[]") as string[];

  if (taskTitles.filter((t) => t.trim()).length === 0) {
    return { error: "Adicione pelo menos uma tarefa ao template." };
  }

  const existing = await prisma.template.findFirst({
    where: { id: templateId, companyId: user.companyId, deletedAt: null },
  });
  if (!existing) return { error: "Template não encontrado." };
  if (existing.isPersonal && existing.createdById !== user.userId && user.role !== "admin") {
    return { error: "Somente o criador pode editar este template personalizado." };
  }
  if (!existing.isPersonal && user.role !== "admin" && user.role !== "manager") {
    return { error: "Você não tem permissão para editar este template." };
  }

  const targetSectorIdsParsed = targetSectorIdsSchema.safeParse(formData.getAll("targetSectorIds"));
  if (!targetSectorIdsParsed.success) return { error: "Setores inválidos." };
  const targetSectorIds = existing.isPersonal && user.role === "admin"
    ? await validateTargetSectors(user.companyId, targetSectorIdsParsed.data)
    : [];
  if (targetSectorIds === null) return { error: "Um ou mais setores não pertencem à empresa." };

  await prisma.template.update({
    where: { id: templateId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: existing.isPersonal ? null : parsed.data.category || null,
      sectorId: existing.isPersonal ? null : parsed.data.sectorId || null,
      targetSectors: existing.isPersonal && user.role === "admin"
        ? { deleteMany: {}, create: targetSectorIds.map((sectorId) => ({ sectorId })) }
        : undefined,
    },
  });

  // Replace all tasks (checklist items cascade deleted)
  await prisma.templateTask.deleteMany({ where: { templateId } });

  const tasksToCreate = taskTitles
    .map((title, i) => ({
      title: title.trim(),
      description: (taskDescriptions[i] ?? "").trim(),
      days: taskDays[i],
      priority: taskPriorities[i],
      assigneeId: taskAssigneeIds[i] || null,
      subtasks: taskSubtasksRaw[i] ? (JSON.parse(taskSubtasksRaw[i]) as { title: string }[]) : [],
    }))
    .filter((t) => t.title);

  await Promise.all(
    tasksToCreate.map((t, i) => {
      const checklistItems = t.subtasks
        .map((st, j) => ({ title: st.title?.trim() ?? "", position: j }))
        .filter((st) => st.title);
      return prisma.templateTask.create({
        data: {
          templateId,
          title: t.title,
          description: t.description || null,
          priority: (t.priority || "medium") as TaskPriority,
          daysToComplete: t.days ? parseInt(t.days) : null,
          defaultAssigneeId: t.assigneeId || null,
          position: i,
          checklistItems: checklistItems.length ? { create: checklistItems } : undefined,
        },
      });
    }),
  );

  revalidatePath("/templates");
  redirect("/templates");
}

export async function activateTemplateAction(
  templateId: string,
  assigneeId: string,
  startDate: string,
) {
  const user = await requireAuth();

  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      companyId: user.companyId,
      isActive: true,
      deletedAt: null,
      OR: [
        { isPersonal: false },
        { isPersonal: true, createdById: user.userId },
        ...(user.role === "admin" ? [{ isPersonal: true }] : [{
          isPersonal: true,
          targetSectors: { some: { sector: { members: { some: { userId: user.userId } } } } },
        }]),
      ],
    },
    include: {
      templateTasks: {
        orderBy: { position: "asc" },
        include: { checklistItems: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!template) return { error: "Template não encontrado." };

  const start = startDate ? new Date(startDate) : new Date();
  const resolvedAssignee = assigneeId || null;

  await prisma.$transaction(
    template.templateTasks.map((tt) =>
      prisma.task.create({
        data: {
          companyId: user.companyId,
          templateId: template.id,
          sectorId: template.sectorId,
          title: tt.title,
          description: tt.description,
          priority: tt.priority,
          assigneeId: resolvedAssignee,
          createdById: user.userId,
          dueDate: tt.daysToComplete
            ? new Date(start.getTime() - tt.daysToComplete * 86400000)
            : null,
          checklistItems: tt.checklistItems.length
            ? { create: tt.checklistItems.map((item) => ({ title: item.title, position: item.position })) }
            : undefined,
        },
      }),
    ),
  );

  await prisma.template.update({
    where: { id: templateId },
    data: { useCount: { increment: 1 } },
  });

  
  revalidatePath("/dashboard");
  revalidatePath("/templates");
  return { success: true };
}

export async function toggleTemplateActiveAction(templateId: string) {
  const user = await requireAuth();
  const template = await prisma.template.findFirst({
    where: { id: templateId, companyId: user.companyId },
  });
  if (!template) return;
  if (template.isPersonal && template.createdById !== user.userId && user.role !== "admin") return;
  if (!template.isPersonal && user.role !== "admin" && user.role !== "manager") return;
  await prisma.template.update({
    where: { id: templateId },
    data: { isActive: !template.isActive },
  });
  revalidatePath("/templates");
}

export async function deleteTemplateAction(templateId: string) {
  const user = await requireAuth();
  const template = await prisma.template.findFirst({
    where: { id: templateId, companyId: user.companyId, deletedAt: null },
  });
  if (!template) return { error: "Template não encontrado." };
  if (template.isPersonal && template.createdById !== user.userId && user.role !== "admin") {
    return { error: "Somente o criador pode excluir este template personalizado." };
  }
  if (!template.isPersonal && user.role !== "admin" && user.role !== "manager") {
    return { error: "Você não tem permissão para excluir este template." };
  }

  await prisma.template.update({
    where: { id: templateId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/templates");
  return { success: true };
}
