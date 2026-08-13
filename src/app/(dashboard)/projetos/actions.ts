"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { pickColor } from "@/lib/color";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Prisma, type ProjectStatus } from "@prisma/client";

// ─── Client ───────────────────────────────────────────────────

const clientSchema = z.object({
  name: z.string().min(1, "Nome do cliente obrigatório").max(255),
  email: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : ""),
    z.string().email("E-mail inválido").or(z.literal("")),
  ),
  meetingPlan: z.string().trim().min(1, "Plano obrigatório").max(100),
  sourceGroupId: z.string().trim().max(255).optional().or(z.literal("")),
  whatsappGroupId: z.string().trim()
    .regex(/^\d+@g\.us$/, "ID UAZAPI inválido. Use o formato 120363...@g.us")
    .optional().or(z.literal("")),
  whatsappGroupName: z.string().trim().min(1, "Nome do grupo obrigatório").max(255),
  description: z.string().optional().or(z.literal("")),
  managerId: z.string().uuid("Selecione um gestor responsável"),
});

async function isValidClientManager(companyId: string, managerId: string) {
  const manager = await prisma.user.findFirst({
    where: { id: managerId, companyId, deletedAt: null, isActive: true },
    select: { id: true },
  });
  return Boolean(manager);
}

async function findClientUsingGroup(companyId: string, whatsappGroupId: string, excludeId?: string) {
  return prisma.client.findFirst({
    where: {
      companyId,
      whatsappGroupId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true, deletedAt: true },
  });
}

function isDuplicateClientGroupError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createClientAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (user.role === "member") return { error: "Sem permissão para cadastrar clientes." };

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    meetingPlan: formData.get("meetingPlan"),
    sourceGroupId: formData.get("sourceGroupId"),
    whatsappGroupId: formData.get("whatsappGroupId"),
    whatsappGroupName: formData.get("whatsappGroupName"),
    description: formData.get("description"),
    managerId: formData.get("managerId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!await isValidClientManager(user.companyId, parsed.data.managerId)) {
    return { error: "Gestor responsável inválido." };
  }
  const duplicate = parsed.data.whatsappGroupId
    ? await findClientUsingGroup(user.companyId, parsed.data.whatsappGroupId)
    : null;
  if (duplicate) {
    return {
      error: `Este grupo já está vinculado ao cliente "${duplicate.name}"${duplicate.deletedAt ? " (arquivado)" : ""}.`,
    };
  }

  try {
    await prisma.client.create({
      data: {
        companyId: user.companyId,
        name: parsed.data.name,
        email: parsed.data.email || null,
        meetingPlan: parsed.data.meetingPlan,
        sourceGroupId: parsed.data.sourceGroupId || null,
        whatsappGroupId: parsed.data.whatsappGroupId || null,
        whatsappGroupName: parsed.data.whatsappGroupName,
        color: pickColor(parsed.data.name),
        description: parsed.data.description || null,
        managerId: parsed.data.managerId,
      },
    });
  } catch (error) {
    if (isDuplicateClientGroupError(error)) {
      return { error: "Este grupo já foi vinculado a outro cliente." };
    }
    throw error;
  }

  revalidatePath("/projetos");
  revalidatePath("/clientes");
  return { success: true };
}

export async function updateClientAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireAuth();
  if (user.role === "member") return { error: "Sem permissão para alterar clientes." };
  const clientId = formData.get("clientId") as string;

  const idParsed = z.string().uuid().safeParse(clientId);
  if (!idParsed.success) return { error: "Cliente inválido." };

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    meetingPlan: formData.get("meetingPlan"),
    sourceGroupId: formData.get("sourceGroupId"),
    whatsappGroupId: formData.get("whatsappGroupId"),
    whatsappGroupName: formData.get("whatsappGroupName"),
    description: formData.get("description"),
    managerId: formData.get("managerId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!await isValidClientManager(user.companyId, parsed.data.managerId)) {
    return { error: "Gestor responsável inválido." };
  }
  const duplicate = parsed.data.whatsappGroupId
    ? await findClientUsingGroup(user.companyId, parsed.data.whatsappGroupId, clientId)
    : null;
  if (duplicate) {
    return {
      error: `Este grupo já está vinculado ao cliente "${duplicate.name}"${duplicate.deletedAt ? " (arquivado)" : ""}.`,
    };
  }

  try {
    await prisma.client.updateMany({
      where: { id: clientId, companyId: user.companyId },
      data: {
        name: parsed.data.name,
        email: parsed.data.email || null,
        meetingPlan: parsed.data.meetingPlan,
        sourceGroupId: parsed.data.sourceGroupId || null,
        whatsappGroupId: parsed.data.whatsappGroupId || null,
        whatsappGroupName: parsed.data.whatsappGroupName,
        description: parsed.data.description || null,
        managerId: parsed.data.managerId,
      },
    });
  } catch (error) {
    if (isDuplicateClientGroupError(error)) {
      return { error: "Este grupo já foi vinculado a outro cliente." };
    }
    throw error;
  }

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
  if (user.role === "member") return { error: "Sem permissão." };
  await prisma.client.updateMany({
    where: { id: clientId, companyId: user.companyId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/clientes");
  revalidatePath("/projetos");
}

export async function archiveClientAction(clientId: string): Promise<{ error?: string }> {
  const user = await requireAuth();
  if (user.role === "member") return { error: "Sem permissão." };

  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId: user.companyId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!client) return { error: "Cliente não encontrado." };

  await prisma.client.update({
    where: { id: client.id },
    data: { deletedAt: new Date() },
  });
  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "client.archived",
    resourceType: "client",
    resourceId: client.id,
    oldValue: { name: client.name },
  });

  revalidatePath("/clientes");
  return {};
}

export async function restoreClientAction(clientId: string): Promise<{ error?: string }> {
  const user = await requireAuth();
  if (user.role === "member") return { error: "Sem permissão." };

  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId: user.companyId, deletedAt: { not: null } },
    select: { id: true, name: true },
  });
  if (!client) return { error: "Cliente não encontrado." };

  await prisma.client.update({ where: { id: client.id }, data: { deletedAt: null } });
  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "client.restored",
    resourceType: "client",
    resourceId: client.id,
    newValue: { name: client.name },
  });

  revalidatePath("/clientes");
  return {};
}

// ─── Project ──────────────────────────────────────────────────

export async function createProjectAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const clientId = formData.get("clientId") as string;
  const templateId = (formData.get("templateId") as string)?.trim();

  if (!name) return { error: "Nome do projeto obrigatório." };

  if (clientId === "__new__") {
    return { error: "Cadastre o cliente na tela Clientes antes de criar o projeto." };
  }

  const uuidParsed = z.string().uuid().safeParse(clientId);
  if (!uuidParsed.success) return { error: "Selecione um cliente." };

  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId: user.companyId, deletedAt: null },
    select: { id: true },
  });
  if (!client) return { error: "Cliente não encontrado." };

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
            clientId,
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
        await Promise.all(
          tt.checklistItems
            .map((ci, cIdx) => ({ ci, cIdx }))
            .filter(({ ci }) => ci.title?.trim())
            .map(({ ci, cIdx }) =>
              prisma.task.create({
                data: {
                  companyId: user.companyId,
                  projectId: project.id,
                  clientId,
                  parentTaskId: parentTask.id,
                  title: ci.title.trim(),
                  priority: tt.priority,
                  createdById: user.userId,
                  metadata: { templatePosition: cIdx },
                },
              }),
            ),
        );
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
  await prisma.project.updateMany({
    where: { id: projectId, companyId: user.companyId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/projetos");
  redirect("/projetos");
}

export async function applyTemplatesToProjectAction(
  projectId: string,
  templateIds: string[],
  assigneeId: string,
  startDate: string,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  if (!templateIds.length) return { error: "Selecione ao menos um template." };

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId, deletedAt: null },
  });
  if (!project) return { error: "Projeto não encontrado." };

  const templates = await prisma.template.findMany({
    where: { id: { in: templateIds }, companyId: user.companyId, isActive: true },
    include: {
      templateTasks: {
        orderBy: { position: "asc" },
        include: { checklistItems: { orderBy: { position: "asc" } } },
      },
    },
  });

  if (!templates.length) return { error: "Nenhum template válido encontrado." };

  const start = startDate ? new Date(startDate) : new Date();
  const resolvedAssignee = assigneeId || null;

  for (const template of templates) {
    if (!project.description?.trim() && template.description?.trim()) {
      await prisma.project.update({
        where: { id: projectId },
        data: { description: template.description.trim() },
      });
      project.description = template.description.trim();
    }
  }

  await Promise.all(
    templates.map(async (template) => {
      await Promise.all(
        template.templateTasks.map(async (tt, tIdx) => {
          const dueDate = tt.daysToComplete
            ? new Date(start.getTime() + tt.daysToComplete * 86400000)
            : null;

          const parentTask = await prisma.task.create({
            data: {
              companyId: user.companyId,
              projectId,
              clientId: project.clientId,
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

          await Promise.all(
            tt.checklistItems
              .map((ci, cIdx) => ({ ci, cIdx }))
              .filter(({ ci }) => ci.title?.trim())
              .map(({ ci, cIdx }) =>
                prisma.task.create({
                  data: {
                    companyId: user.companyId,
                    projectId,
                    clientId: project.clientId,
                    parentTaskId: parentTask.id,
                    title: ci.title.trim(),
                    priority: tt.priority,
                    assigneeId: resolvedAssignee,
                    createdById: user.userId,
                    metadata: { templatePosition: cIdx },
                  },
                }),
              ),
          );
        }),
      );

      await logActivity({
        companyId: user.companyId,
        userId: user.userId,
        action: "project.template_applied",
        resourceType: "project",
        resourceId: projectId,
        newValue: { templateName: template.name, tasksCreated: template.templateTasks.length },
      });
    }),
  );

  await prisma.template.updateMany({
    where: { id: { in: templateIds } },
    data: { useCount: { increment: 1 } },
  });

  revalidatePath(`/projetos/${projectId}`);
  return {};
}

/** @deprecated use applyTemplatesToProjectAction */
export async function applyTemplateToProjectAction(
  projectId: string,
  templateId: string,
  assigneeId: string,
  startDate: string,
): Promise<{ error?: string }> {
  return applyTemplatesToProjectAction(projectId, [templateId], assigneeId, startDate);
}
