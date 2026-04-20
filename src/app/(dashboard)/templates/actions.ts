"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth";
import type { TaskPriority } from "@prisma/client";

const templateSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(255),
  description: z.string().optional(),
  category: z.string().optional(),
  sectorId: z.string().uuid().optional().or(z.literal("")),
});

export async function createTemplateAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireRole(["admin", "manager"]);

  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    sectorId: formData.get("sectorId"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // Parse template tasks from formData
  const taskTitles = formData.getAll("taskTitle[]") as string[];
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
      category: parsed.data.category || null,
      sectorId: parsed.data.sectorId || null,
    },
  });

  const tasksToCreate = taskTitles
    .map((title, i) => ({
      title: title.trim(),
      days: taskDays[i],
      priority: taskPriorities[i],
      assigneeId: taskAssigneeIds[i] || null,
      subtasks: taskSubtastsRaw[i] ? (JSON.parse(taskSubtastsRaw[i]) as { title: string }[]) : [],
    }))
    .filter((t) => t.title);

  for (let i = 0; i < tasksToCreate.length; i++) {
    const t = tasksToCreate[i];
    const tt = await prisma.templateTask.create({
      data: {
        templateId: template.id,
        title: t.title,
        priority: (t.priority || "medium") as TaskPriority,
        daysToComplete: t.days ? parseInt(t.days) : null,
        defaultAssigneeId: t.assigneeId || null,
        position: i,
      },
    });
    for (let j = 0; j < t.subtasks.length; j++) {
      const st = t.subtasks[j];
      if (st.title?.trim()) {
        await prisma.templateChecklistItem.create({
          data: { templateTaskId: tt.id, title: st.title.trim(), position: j },
        });
      }
    }
  }

  revalidatePath("/templates");
  redirect("/templates");
}

export async function updateTemplateAction(
  templateId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireRole(["admin", "manager"]);

  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    category: formData.get("category"),
    sectorId: formData.get("sectorId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const taskTitles = formData.getAll("taskTitle[]") as string[];
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

  await prisma.template.update({
    where: { id: templateId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      sectorId: parsed.data.sectorId || null,
    },
  });

  // Replace all tasks (checklist items cascade deleted)
  await prisma.templateTask.deleteMany({ where: { templateId } });

  const tasksToCreate = taskTitles
    .map((title, i) => ({
      title: title.trim(),
      days: taskDays[i],
      priority: taskPriorities[i],
      assigneeId: taskAssigneeIds[i] || null,
      subtasks: taskSubtasksRaw[i] ? (JSON.parse(taskSubtasksRaw[i]) as { title: string }[]) : [],
    }))
    .filter((t) => t.title);

  for (let i = 0; i < tasksToCreate.length; i++) {
    const t = tasksToCreate[i];
    const tt = await prisma.templateTask.create({
      data: {
        templateId,
        title: t.title,
        priority: (t.priority || "medium") as TaskPriority,
        daysToComplete: t.days ? parseInt(t.days) : null,
        defaultAssigneeId: t.assigneeId || null,
        position: i,
      },
    });
    for (let j = 0; j < t.subtasks.length; j++) {
      const st = t.subtasks[j];
      if (st.title?.trim()) {
        await prisma.templateChecklistItem.create({
          data: { templateTaskId: tt.id, title: st.title.trim(), position: j },
        });
      }
    }
  }

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
    where: { id: templateId, companyId: user.companyId, isActive: true },
    include: { templateTasks: { orderBy: { position: "asc" } } },
  });
  if (!template) return { error: "Template não encontrado." };

  const start = startDate ? new Date(startDate) : new Date();
  const resolvedAssignee = assigneeId || null;

  for (const tt of template.templateTasks) {
    const dueDate = tt.daysToComplete
      ? new Date(start.getTime() - tt.daysToComplete * 86400000)
      : null;

    await prisma.task.create({
      data: {
        companyId: user.companyId,
        templateId: template.id,
        sectorId: template.sectorId,
        title: tt.title,
        description: tt.description,
        priority: tt.priority,
        assigneeId: resolvedAssignee,
        createdById: user.userId,
        dueDate,
      },
    });
  }

  await prisma.template.update({
    where: { id: templateId },
    data: { useCount: { increment: 1 } },
  });

  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  revalidatePath("/templates");
  return { success: true };
}

export async function toggleTemplateActiveAction(templateId: string) {
  const user = await requireRole(["admin", "manager"]);
  const template = await prisma.template.findFirst({
    where: { id: templateId, companyId: user.companyId },
  });
  if (!template) return;
  await prisma.template.update({
    where: { id: templateId },
    data: { isActive: !template.isActive },
  });
  revalidatePath("/templates");
}

export async function deleteTemplateAction(templateId: string) {
  const user = await requireRole(["admin", "manager"]);
  const template = await prisma.template.findFirst({
    where: { id: templateId, companyId: user.companyId, deletedAt: null },
  });
  if (!template) return { error: "Template não encontrado." };

  await prisma.template.update({
    where: { id: templateId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/templates");
  return { success: true };
}
