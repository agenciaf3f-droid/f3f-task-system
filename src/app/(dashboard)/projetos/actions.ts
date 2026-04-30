"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { pickColor } from "@/lib/color";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ProjectStatus } from "@prisma/client";

// ─── Client ───────────────────────────────────────────────────

const clientSchema = z.object({
  name: z.string().min(1, "Nome do cliente obrigatório").max(255),
  description: z.string().optional().or(z.literal("")),
});

export async function createClientAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await prisma.client.create({
    data: {
      companyId: user.companyId,
      name: parsed.data.name,
      color: pickColor(parsed.data.name),
      description: parsed.data.description || null,
    },
  });

  revalidatePath("/projetos");
  revalidatePath("/clientes");
  return { success: true };
}

export async function updateClientAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  const clientId = formData.get("clientId") as string;

  const idParsed = z.string().uuid().safeParse(clientId);
  if (!idParsed.success) return { error: "Cliente inválido." };

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  await prisma.client.updateMany({
    where: { id: clientId, companyId: user.companyId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
    },
  });

  revalidatePath("/clientes");
  revalidatePath("/projetos");
  return { success: true };
}

export async function updateClientAvatarAction(
  clientId: string,
  formData: FormData,
): Promise<{ error?: string; avatarUrl?: string }> {
  const user = await requireAuth();

  const idParsed = z.string().uuid().safeParse(clientId);
  if (!idParsed.success) return { error: "Cliente inválido." };

  const owned = await prisma.client.findFirst({
    where: { id: clientId, companyId: user.companyId },
    select: { id: true },
  });
  if (!owned) return { error: "Cliente não encontrado." };

  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) return { error: "Selecione uma imagem." };
  if (file.size > 3 * 1024 * 1024) return { error: "Imagem deve ter no máximo 3MB." };
  if (!file.type.startsWith("image/")) return { error: "Arquivo deve ser uma imagem." };

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `clients/${clientId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await supabaseAdmin.storage.createBucket("avatars", { public: true }).catch(() => {});
  const { error: uploadError } = await supabaseAdmin.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadError) return { error: "Erro ao fazer upload." };

  const { data } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

  await prisma.client.update({
    where: { id: clientId },
    data: { avatarUrl: data.publicUrl },
  });

  revalidatePath("/clientes");
  revalidatePath("/projetos");
  return { avatarUrl };
}

export async function removeClientAvatarAction(clientId: string): Promise<{ error?: string }> {
  const user = await requireAuth();
  await prisma.client.updateMany({
    where: { id: clientId, companyId: user.companyId },
    data: { avatarUrl: null },
  });
  revalidatePath("/clientes");
  revalidatePath("/projetos");
  return {};
}

export async function deleteClientAction(clientId: string) {
  const user = await requireAuth();
  const now = new Date();

  const projects = await prisma.project.findMany({
    where: { clientId, companyId: user.companyId, deletedAt: null },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  await prisma.$transaction([
    prisma.task.updateMany({
      where: { projectId: { in: projectIds }, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.project.updateMany({
      where: { id: { in: projectIds } },
      data: { deletedAt: now },
    }),
    prisma.client.updateMany({
      where: { id: clientId, companyId: user.companyId },
      data: { deletedAt: now },
    }),
  ]);

  revalidatePath("/clientes");
  revalidatePath("/projetos");
}

// ─── Project ──────────────────────────────────────────────────

export async function createProjectAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  let clientId = formData.get("clientId") as string;
  const newClientName = (formData.get("newClientName") as string)?.trim();
  const templateId = (formData.get("templateId") as string)?.trim();

  if (!name) return { error: "Nome do projeto obrigatório." };

  if (clientId === "__new__") {
    if (!newClientName) return { error: "Nome do cliente obrigatório." };
    const client = await prisma.client.create({
      data: { companyId: user.companyId, name: newClientName, color: pickColor(newClientName) },
    });
    clientId = client.id;
  }

  const uuidParsed = z.string().uuid().safeParse(clientId);
  if (!uuidParsed.success) return { error: "Selecione um cliente." };

  const project = await prisma.project.create({
    data: {
      companyId: user.companyId,
      clientId,
      createdById: user.userId,
      name,
      description: description || null,
    },
  });

  if (templateId && templateId !== "__none__") {
    const template = await prisma.template.findFirst({
      where: { id: templateId, companyId: user.companyId, isActive: true },
      include: {
        templateTasks: {
          orderBy: { position: "asc" },
          include: { checklistItems: { orderBy: { position: "asc" } } },
        },
      },
    });
    if (template) {
      const start = new Date();
      for (let tIdx = 0; tIdx < template.templateTasks.length; tIdx++) {
        const tt = template.templateTasks[tIdx];
        const dueDate = tt.daysToComplete
          ? new Date(start.getTime() + tt.daysToComplete * 86400000)
          : null;
        const parentTask = await prisma.task.create({
          data: {
            companyId: user.companyId,
            projectId: project.id,
            templateId: template.id,
            sectorId: template.sectorId,
            title: tt.title,
            description: tt.description,
            priority: tt.priority,
            createdById: user.userId,
            dueDate,
            metadata: { templatePosition: tIdx },
          },
        });
        for (let cIdx = 0; cIdx < tt.checklistItems.length; cIdx++) {
          const ci = tt.checklistItems[cIdx];
          if (!ci.title?.trim()) continue;
          await prisma.task.create({
            data: {
              companyId: user.companyId,
              projectId: project.id,
              parentTaskId: parentTask.id,
              title: ci.title.trim(),
              priority: tt.priority,
              createdById: user.userId,
              metadata: { templatePosition: cIdx },
            },
          });
        }
      }
      await prisma.template.update({
        where: { id: templateId },
        data: { useCount: { increment: 1 } },
      });
    }
  }

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "project.created",
    resourceType: "project",
    resourceId: project.id,
    newValue: { name },
  });

  revalidatePath("/projetos");
  redirect(`/projetos/${project.id}`);
}

export async function updateProjectAction(
  projectId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const parsed = z.object({
    name: z.string().min(1, "Nome obrigatório").max(255),
    description: z.string().optional().or(z.literal("")),
    status: z.enum(["active", "completed", "paused", "cancelled"]),
  }).safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
    select: { clientId: true },
  });

  await prisma.project.updateMany({
    where: { id: projectId, companyId: user.companyId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      status: parsed.data.status as ProjectStatus,
    },
  });

  revalidatePath(`/projetos/${projectId}`);
  revalidatePath("/projetos");
  redirect(project?.clientId ? `/projetos?clientId=${project.clientId}` : "/projetos");
}

export async function updateProjectStatusAction(
  projectId: string,
  status: ProjectStatus,
) {
  const user = await requireAuth();
  await prisma.project.updateMany({
    where: { id: projectId, companyId: user.companyId },
    data: { status },
  });
  revalidatePath(`/projetos/${projectId}`);
  revalidatePath("/projetos");
}

export async function deleteProjectAction(projectId: string) {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "manager" && user.role !== "supervisor") {
    throw new Error("Sem permissão para excluir projetos.");
  }
  await prisma.project.updateMany({
    where: { id: projectId, companyId: user.companyId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/projetos");
  redirect("/projetos");
}

export async function applyTemplateToProjectAction(
  projectId: string,
  templateId: string,
  assigneeId: string,
  startDate: string,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const [project, template] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, companyId: user.companyId, deletedAt: null },
    }),
    prisma.template.findFirst({
      where: { id: templateId, companyId: user.companyId, isActive: true },
      include: {
        templateTasks: {
          orderBy: { position: "asc" },
          include: { checklistItems: { orderBy: { position: "asc" } } },
        },
      },
    }),
  ]);

  if (!project) return { error: "Projeto não encontrado." };
  if (!template) return { error: "Template não encontrado." };

  if (!project.description?.trim() && template.description?.trim()) {
    await prisma.project.update({
      where: { id: projectId },
      data: { description: template.description.trim() },
    });
  }

  const start = startDate ? new Date(startDate) : new Date();
  const resolvedAssignee = assigneeId || null;

  for (let tIdx = 0; tIdx < template.templateTasks.length; tIdx++) {
    const tt = template.templateTasks[tIdx];
    const dueDate = tt.daysToComplete
      ? new Date(start.getTime() + tt.daysToComplete * 86400000)
      : null;

    const parentTask = await prisma.task.create({
      data: {
        companyId: user.companyId,
        projectId,
        templateId: template.id,
        sectorId: template.sectorId,
        title: tt.title,
        description: tt.description,
        priority: tt.priority,
        assigneeId: resolvedAssignee,
        createdById: user.userId,
        dueDate,
        metadata: { templatePosition: tIdx },
      },
    });

    for (let cIdx = 0; cIdx < tt.checklistItems.length; cIdx++) {
      const ci = tt.checklistItems[cIdx];
      if (!ci.title?.trim()) continue;
      await prisma.task.create({
        data: {
          companyId: user.companyId,
          projectId,
          parentTaskId: parentTask.id,
          title: ci.title.trim(),
          priority: tt.priority,
          assigneeId: resolvedAssignee,
          createdById: user.userId,
          metadata: { templatePosition: cIdx },
        },
      });
    }
  }

  await prisma.template.update({
    where: { id: templateId },
    data: { useCount: { increment: 1 } },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "project.template_applied",
    resourceType: "project",
    resourceId: projectId,
    newValue: { templateName: template.name, tasksCreated: template.templateTasks.length },
  });

  revalidatePath(`/projetos/${projectId}`);
  return {};
}
