"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { dispatchWebhook } from "@/lib/webhook";
import { createNotification, notifyTaskAssigned } from "@/lib/notifications";
import type { TaskStatus, TaskPriority } from "@prisma/client";
import { computeNextOccurrence, parseRecurrenceRuleFromDb } from "@/lib/recurrence";
import { taskVisibilityFilter } from "@/lib/task-visibility";
import { templateVisibilityFilter } from "@/lib/template-access";

// datetime-local já vem com hora; date-only ("yyyy-MM-dd") seria parseado como UTC midnight
// e mostraria o dia anterior em fusos negativos. Forçamos meio-dia local nesse caso.
function parseDateInput(s: string | null | undefined): Date | null {
  if (!s) return null;
  return new Date(s.includes("T") ? s : s + "T12:00:00");
}

const recurrenceRuleSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(999),
  byWeekday: z.array(z.number().int().min(0).max(6)).optional(),
  monthDay: z.number().int().min(1).max(31).optional(),
});

function parseRecurrenceRuleFromForm(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = recurrenceRuleSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Campos removidos da UI (sectorId, priority) podem vir como null no FormData.
// Pré-processa null → "" pra casar com .or(z.literal("")).
const optStr = z.preprocess(
  (v) => (v == null ? "" : v),
  z.string(),
);
const optUuid = z.preprocess(
  (v) => (v == null ? "" : v),
  z.string().uuid().or(z.literal("")),
);

const requiredDueDate = z.string().min(1, "Prazo obrigatório").refine(
  (value) => Boolean(parseDateInput(value)),
  "Prazo inválido",
);

const taskSchema = z.object({
  title: z.string().min(1, "Título obrigatório").max(500),
  description: optStr,
  assigneeId: optUuid,
  sectorId: optUuid,
  clientId: optUuid,
  projectId: optUuid,
  priority: optStr,
  dueDate: requiredDueDate,
  templateId: optUuid,
});

const createTaskSchema = taskSchema.extend({
  assigneeId: z.string().uuid("Responsável obrigatório"),
  dueDate: requiredDueDate,
});

// Garante que o responsável pertence à empresa do ator — evita assign/notificação
// cross-tenant (assigneeId vem do cliente e User é FK global, sem constraint de company).
async function resolveCompanyAssignee(
  assigneeId: string | null | undefined,
  companyId: string,
): Promise<string | null> {
  if (!assigneeId) return null;
  const u = await prisma.user.findFirst({
    where: { id: assigneeId, companyId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  return u?.id ?? null;
}

async function resolveCompanyClient(
  clientId: string | null | undefined,
  companyId: string,
): Promise<string | null> {
  if (!clientId) return null;
  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId, deletedAt: null },
    select: { id: true },
  });
  return client?.id ?? null;
}

async function resolveCompanySector(
  sectorId: string | null | undefined,
  companyId: string,
): Promise<string | null> {
  if (!sectorId) return null;
  const sector = await prisma.sector.findFirst({
    where: { id: sectorId, companyId, deletedAt: null },
    select: { id: true },
  });
  return sector?.id ?? null;
}

export async function createTaskAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData,
): Promise<{ error?: string; success?: boolean; createdTaskId?: string; redirectTo?: string }> {
  const user = await requireAuth();

  // Quando keepOpen=1 (modal "criar várias"), retornamos { success } em vez de redirect
  const keepOpen = formData.get("keepOpen") === "1";

  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    assigneeId: formData.get("assigneeId"),
    sectorId: formData.get("sectorId"),
    clientId: formData.get("clientId"),
    projectId: formData.get("projectId"),
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate"),
    templateId: formData.get("templateId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { title, description, priority, assigneeId, sectorId, clientId, projectId, dueDate, templateId } = parsed.data;
  const safePriority: TaskPriority = (priority || "medium") as TaskPriority;
  const validAssigneeId = await resolveCompanyAssignee(assigneeId, user.companyId);
  if (!validAssigneeId) return { error: "Responsável inválido." };
  const assigneeMembership = await prisma.sectorMember.findFirst({
    where: {
      userId: validAssigneeId,
      sector: { companyId: user.companyId, deletedAt: null },
    },
    orderBy: { sector: { name: "asc" } },
    select: { sectorId: true },
  });
  const requestedSectorId = user.role === "admin"
    ? sectorId
    : (assigneeMembership?.sectorId ?? "");
  const validSectorId = await resolveCompanySector(requestedSectorId, user.companyId);
  if (requestedSectorId && !validSectorId) return { error: "Setor inválido." };
  const parsedDueDate = parseDateInput(dueDate);
  if (!parsedDueDate) return { error: "Prazo inválido." };
  const project = projectId
    ? await prisma.project.findFirst({
        where: { id: projectId, companyId: user.companyId, deletedAt: null },
        select: { id: true, clientId: true },
      })
    : null;
  if (projectId && !project) return { error: "Projeto não encontrado." };
  const validClientId = project
    ? project.clientId
    : await resolveCompanyClient(clientId, user.companyId);

  const recurrenceRule = parseRecurrenceRuleFromForm(formData.get("recurrenceRule"));

  const template = templateId
    ? await prisma.template.findFirst({
        where: {
          id: templateId,
          companyId: user.companyId,
          isActive: true,
          deletedAt: null,
          AND: [templateVisibilityFilter(user)],
        },
        include: {
          templateTasks: {
            orderBy: { position: "asc" },
            include: { checklistItems: { orderBy: { position: "asc" } } },
          },
        },
      })
    : null;
  if (templateId && !template) return { error: "Template inválido ou sem permissão de uso." };

  const templateChecklistItems = template?.templateTasks.flatMap((templateTask) =>
    templateTask.checklistItems.length > 0
      ? templateTask.checklistItems.map((item) => item.title)
      : [templateTask.title],
  ) ?? [];

  const task = await prisma.$transaction(async (transaction) => {
    const createdTask = await transaction.task.create({
      data: {
        companyId: user.companyId,
        title,
        description: description || null,
        priority: safePriority,
        assigneeId: validAssigneeId,
        sectorId: validSectorId,
        projectId: project?.id ?? null,
        clientId: validClientId,
        templateId: template?.id ?? null,
        createdById: user.userId,
        dueDate: parsedDueDate,
        recurrenceRule: recurrenceRule ?? undefined,
        assignees: {
          create: {
            userId: validAssigneeId,
            assignedById: user.userId,
          },
        },
        checklistItems: templateChecklistItems.length
          ? {
              create: templateChecklistItems.map((itemTitle, position) => ({
                title: itemTitle,
                position,
              })),
            }
          : undefined,
      },
    });

    if (template) {
      await transaction.template.update({
        where: { id: template.id },
        data: { useCount: { increment: 1 } },
      });
    }

    return createdTask;
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.created",
    resourceType: "task",
    resourceId: task.id,
    newValue: { title, priority, assigneeId: validAssigneeId },
  });

  if (validAssigneeId && validAssigneeId !== user.userId) {
    const [assignee, project] = await Promise.all([
      prisma.user.findUnique({ where: { id: validAssigneeId }, select: { name: true, email: true } }),
      projectId ? prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }) : null,
    ]);
    const webhookPayload = {
      taskId: task.id,
      taskTitle: title,
      priority,
      assigneeName: assignee?.name,
      assigneeEmail: assignee?.email,
      projectName: project?.name ?? null,
      dueDate: dueDate || null,
      createdBy: user.name,
    };
    dispatchWebhook(user.companyId, "task.assigned", webhookPayload);
    await notifyTaskAssigned({
      companyId: user.companyId,
      assigneeId: validAssigneeId,
      actorName: user.name,
      taskId: task.id,
      taskTitle: title,
    });
  }

  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projetos/${projectId}`);

  return {
    success: true,
    createdTaskId: task.id,
    redirectTo: keepOpen ? undefined : projectId ? `/projetos/${projectId}` : "/dashboard",
  };
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus) {
  const user = await requireAuth();

  if (status === "cancelled") {
    return { error: "Informe o motivo do cancelamento." };
  }

  const old = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: {
      status: true, assigneeId: true, title: true, projectId: true, clientId: true,
      sectorId: true, dueDate: true, recurrenceRule: true, description: true,
      priority: true, createdById: true,
      checklistItems: { select: { title: true, position: true } },
      assignees: { select: { userId: true, assignedById: true } },
    },
  });
  if (!old) return;

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: {
      status,
      completedAt: status === "done" ? new Date() : null,
      // Sincroniza progress com status: done=100%, todo=0%, demais (in_progress/cancelled): mantém.
      ...(status === "done" ? { progress: 100 } : {}),
      ...(status === "todo" ? { progress: 0 } : {}),
    },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.status_changed",
    resourceType: "task",
    resourceId: taskId,
    oldValue: { status: old.status },
    newValue: { status },
  });

  if (status === "done") {
    dispatchWebhook(user.companyId, "task.completed", {
      taskId,
      taskTitle: old.title,
      completedBy: user.name,
    });

    // Notifica o criador quando outra pessoa completa a tarefa dele
    if (old.createdById !== user.userId) {
      await createNotification({
        companyId: user.companyId,
        userId: old.createdById,
        type: "system",
        title: `${user.name} concluiu "${old.title}"`,
        resourceType: "task",
        resourceId: taskId,
      });
    }

    // Cria próxima ocorrência se tarefa é recorrente
    const rule = parseRecurrenceRuleFromDb(old.recurrenceRule);
    if (rule) {
      const baseDate = old.dueDate ?? new Date();
      const nextDue = computeNextOccurrence(rule, baseDate);
      await prisma.task.create({
        data: {
          companyId: user.companyId,
          title: old.title,
          description: old.description,
          priority: old.priority,
          assigneeId: old.assigneeId,
          sectorId: old.sectorId,
          clientId: old.clientId,
          projectId: old.projectId,
          createdById: old.createdById,
          recurrenceRule: old.recurrenceRule ?? undefined,
          recurrenceParentId: taskId,
          dueDate: nextDue,
          // Cada ocorrência recebe itens próprios, sempre abertos, para que a
          // conclusão de hoje não marque automaticamente a checklist futura.
          checklistItems: old.checklistItems.length
            ? { create: old.checklistItems.map((item) => ({ title: item.title, position: item.position })) }
            : undefined,
          assignees: old.assignees.length
            ? {
                create: old.assignees.map((assignee) => ({
                  userId: assignee.userId,
                  assignedById: assignee.assignedById,
                })),
              }
            : undefined,
        },
      });
      if (old.projectId) revalidatePath(`/projetos/${old.projectId}`);
    }
  }

  revalidatePath(`/tarefas/${taskId}`);
  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  if (old.projectId) revalidatePath(`/projetos/${old.projectId}`);
}

export async function cancelTaskAction(taskId: string, reason: string) {
  const user = await requireAuth();
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 3) return { error: "Explique por que a tarefa está sendo cancelada." };
  if (trimmedReason.length > 2000) return { error: "O motivo deve ter no máximo 2.000 caracteres." };

  const task = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { id: true, title: true, status: true, projectId: true, assigneeId: true, createdById: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };
  const canEdit = user.role === "admin"
    || user.role === "manager"
    || task.assigneeId === user.userId
    || task.createdById === user.userId;
  if (!canEdit) return { error: "Você não tem permissão para cancelar esta tarefa." };
  if (task.status === "cancelled") return { error: "Esta tarefa já está cancelada." };

  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId, companyId: user.companyId },
      data: { status: "cancelled", completedAt: null },
    }),
    prisma.taskComment.create({
      data: {
        taskId,
        userId: user.userId,
        content: `Motivo do cancelamento: ${trimmedReason}`,
      },
    }),
  ]);

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.status_changed",
    resourceType: "task",
    resourceId: taskId,
    oldValue: { status: task.status },
    newValue: { status: "cancelled", reason: trimmedReason },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/tarefas/${taskId}`);
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  return {};
}

export async function setTaskBlockedAction(
  taskId: string,
  isBlocked: boolean,
): Promise<{ error?: string }> {
  const user = await requireAuth();
  if (typeof isBlocked !== "boolean") return { error: "Estado de bloqueio inválido." };
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: {
      isBlocked: true,
      projectId: true,
      assigneeId: true,
      createdById: true,
    },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  const canEdit = user.role === "admin"
    || user.role === "manager"
    || task.assigneeId === user.userId
    || task.createdById === user.userId;
  if (!canEdit) return { error: "Sem permissão para alterar esta tarefa." };
  if (task.isBlocked === isBlocked) return {};

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { isBlocked },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: isBlocked ? "task.blocked" : "task.unblocked",
    resourceType: "task",
    resourceId: taskId,
    oldValue: { isBlocked: task.isBlocked },
    newValue: { isBlocked },
  });

  revalidatePath(`/tarefas/${taskId}`);
  revalidatePath("/dashboard");
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  return {};
}

export async function updateTaskProgressAction(taskId: string, progress: number) {
  const user = await requireAuth();
  const allowed = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { id: true },
  });
  if (!allowed) return;
  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { progress: Math.max(0, Math.min(100, progress)) },
  });
  revalidatePath(`/tarefas/${taskId}`);
}

export async function deleteTaskAction(taskId: string): Promise<{ projectId: string | null }> {
  const user = await requireAuth();

  const task = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { title: true, projectId: true },
  });
  if (!task) return { projectId: null };

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.deleted",
    resourceType: "task",
    resourceId: taskId,
    oldValue: { title: task.title },
  });

  revalidatePath("/dashboard");
  revalidatePath("/tarefas");
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);

  return { projectId: task.projectId };
}

export async function updateTaskAction(
  taskId: string,
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await requireAuth();

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    assigneeId: formData.get("assigneeId"),
    sectorId: formData.get("sectorId"),
    clientId: formData.get("clientId"),
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { title, description, priority, assigneeId, sectorId, clientId, dueDate } = parsed.data;
  const safePriority: TaskPriority = (priority || "medium") as TaskPriority;
  const validAssigneeId = await resolveCompanyAssignee(assigneeId, user.companyId);

  const old = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { assigneeId: true, title: true, clientId: true },
  });
  if (!old) return { error: "Tarefa não encontrada." };

  const validClientId = await resolveCompanyClient(clientId, user.companyId);

  const recurrenceRule = parseRecurrenceRuleFromForm(formData.get("recurrenceRule"));

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: {
      title,
      description: description || null,
      priority: safePriority,
      assigneeId: validAssigneeId,
      sectorId: sectorId || null,
      clientId: validClientId,
      dueDate: parseDateInput(dueDate),
      recurrenceRule: recurrenceRule ?? undefined,
    },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.updated",
    resourceType: "task",
    resourceId: taskId,
    newValue: { title, priority, assigneeId: validAssigneeId, clientId: validClientId },
  });

  if (validAssigneeId && validAssigneeId !== old.assigneeId && validAssigneeId !== user.userId) {
    const assignee = await prisma.user.findUnique({
      where: { id: validAssigneeId },
      select: { name: true, email: true },
    });
    dispatchWebhook(user.companyId, "task.assigned", {
      taskId,
      taskTitle: title,
      priority,
      assigneeName: assignee?.name,
      assigneeEmail: assignee?.email,
      dueDate: dueDate || null,
      createdBy: user.name,
    });
    await notifyTaskAssigned({
      companyId: user.companyId,
      assigneeId: validAssigneeId,
      actorName: user.name,
      taskId,
      taskTitle: title,
    });
  }

  revalidatePath(`/tarefas/${taskId}`);

  const returnTo = formData.get("returnTo");
  if (typeof returnTo === "string" && returnTo.startsWith("/")) {
    redirect(returnTo);
  }
  redirect(`/tarefas/${taskId}`);
}

export async function updateTaskAssigneeAction(taskId: string, assigneeId: string | null) {
  const user = await requireAuth();
  const task = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { title: true, projectId: true, dueDate: true, assigneeId: true },
  });
  if (!task) return;
  const validAssigneeId = await resolveCompanyAssignee(assigneeId, user.companyId);
  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { assigneeId: validAssigneeId },
  });

  if (validAssigneeId && validAssigneeId !== task.assigneeId && validAssigneeId !== user.userId) {
    await notifyTaskAssigned({
      companyId: user.companyId,
      assigneeId: validAssigneeId,
      actorName: user.name,
      taskId,
      taskTitle: task.title,
    });
  }

  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
}

export async function updateTaskTitleAction(
  taskId: string,
  title: string,
): Promise<{ error?: string }> {
  const user = await requireAuth();
  const trimmed = title.trim();
  if (!trimmed) return { error: "Título obrigatório." };
  if (trimmed.length > 500) return { error: "Título muito longo." };

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { projectId: true, title: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };
  if (task.title === trimmed) return {};

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { title: trimmed },
  });

  revalidatePath(`/tarefas/${taskId}`);
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  return {};
}

export async function updateTaskDueDateAction(taskId: string, dueDate: string | null) {
  const user = await requireAuth();
  const parsedDueDate = parseDateInput(dueDate);
  if (!parsedDueDate) return { error: "Prazo obrigatório." };
  const task = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { projectId: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };
  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { dueDate: parsedDueDate },
  });

  revalidatePath(`/tarefas/${taskId}`);
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  return {};
}

export async function updateTaskClientAction(
  taskId: string,
  clientId: string | null,
): Promise<{ error?: string }> {
  const user = await requireAuth();
  const parsedClientId = optUuid.safeParse(clientId ?? "");
  if (!parsedClientId.success) return { error: "Cliente inválido." };

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { clientId: true, projectId: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  const validClientId = await resolveCompanyClient(parsedClientId.data, user.companyId);
  if (parsedClientId.data && !validClientId) return { error: "Cliente não encontrado." };
  if (task.clientId === validClientId) return {};

  await prisma.task.update({
    where: { id: taskId, companyId: user.companyId },
    data: { clientId: validClientId },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.updated",
    resourceType: "task",
    resourceId: taskId,
    newValue: { clientId: validClientId },
  });

  revalidatePath("/dashboard");
  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${taskId}`);
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  return {};
}

export async function addSubtaskAction(
  parentTaskId: string,
  title: string,
): Promise<{ error?: string; id?: string }> {
  const user = await requireAuth();
  const trimmed = title.trim();
  if (!trimmed) return { error: "Título obrigatório." };

  const parent = await prisma.task.findFirst({
    where: { id: parentTaskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { id: true, projectId: true, clientId: true, sectorId: true },
  });
  if (!parent) return { error: "Tarefa pai não encontrada." };

  const sub = await prisma.task.create({
    data: {
      companyId: user.companyId,
      title: trimmed,
      priority: "medium",
      parentTaskId: parent.id,
      projectId: parent.projectId,
      clientId: parent.clientId,
      sectorId: parent.sectorId,
      createdById: user.userId,
    },
    select: { id: true },
  });

  if (parent.projectId) revalidatePath(`/projetos/${parent.projectId}`);
  return { id: sub.id };
}

export async function addChecklistItemAction(taskId: string, title: string) {
  const user = await requireAuth();

  const owned = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { id: true },
  });
  if (!owned) return null;

  const count = await prisma.taskChecklistItem.count({ where: { taskId } });
  const item = await prisma.taskChecklistItem.create({
    data: { taskId, title, position: count },
  });
  await recalcProgress(taskId, user.companyId);
  revalidatePath(`/tarefas/${taskId}`);
  return item;
}

export async function toggleChecklistItemAction(
  itemId: string,
  taskId: string,
  isDone: boolean,
) {
  const user = await requireAuth();

  const item = await prisma.taskChecklistItem.findFirst({
    where: { id: itemId, task: taskVisibilityFilter(user) },
    select: { id: true },
  });
  if (!item) return;

  await prisma.taskChecklistItem.update({
    where: { id: itemId },
    data: {
      isDone,
      doneAt: isDone ? new Date() : null,
      doneById: isDone ? user.userId : null,
    },
  });
  await recalcProgress(taskId, user.companyId);
  revalidatePath(`/tarefas/${taskId}`);
}

export async function updateChecklistItemTitleAction(
  itemId: string,
  taskId: string,
  title: string,
): Promise<{ error?: string }> {
  const user = await requireAuth();
  const trimmed = title.trim();
  if (!trimmed) return { error: "Nome do item obrigatório." };
  if (trimmed.length > 500) return { error: "Nome do item muito longo." };

  const item = await prisma.taskChecklistItem.findFirst({
    where: { id: itemId, taskId, task: taskVisibilityFilter(user) },
    select: { id: true, title: true },
  });
  if (!item) return { error: "Item não encontrado." };
  if (item.title === trimmed) return {};

  await prisma.taskChecklistItem.update({
    where: { id: itemId },
    data: { title: trimmed },
  });
  revalidatePath(`/tarefas/${taskId}`);
  return {};
}

async function recalcProgress(taskId: string, companyId: string) {
  const items = await prisma.taskChecklistItem.findMany({
    where: { taskId },
    select: { isDone: true },
  });
  if (items.length === 0) return;
  const done = items.filter((i) => i.isDone).length;
  const progress = Math.round((done / items.length) * 100);
  await prisma.task.update({
    where: { id: taskId, companyId },
    data: { progress },
  });
}

const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export async function addCommentAction(taskId: string, content: string) {
  const user = await requireAuth();
  if (!content.trim()) return;

  const task = await prisma.task.findFirst({
    where: { id: taskId, AND: taskVisibilityFilter(user) },
    select: { assigneeId: true, createdById: true, title: true },
  });
  if (!task) return;

  const comment = await prisma.taskComment.create({
    data: { taskId, userId: user.userId, content: content.trim() },
  });

  // Parse @mentions and create notifications
  const mentionedIds = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, "gi");
  while ((m = re.exec(content)) !== null) {
    const [, , mentionedUserId] = m;
    if (mentionedUserId !== user.userId) {
      mentionedIds.add(mentionedUserId);
    }
  }
  if (mentionedIds.size > 0) {
    const targets = await prisma.user.findMany({
      where: { id: { in: [...mentionedIds] }, companyId: user.companyId, isActive: true },
      select: { id: true },
    });
    if (targets.length > 0) {
      const body = `Em "${task.title}": ${content.replace(MENTION_RE, "@$1").slice(0, 120)}`;
      const title = `${user.name.split(" ")[0]} mencionou você`;
      await prisma.notification.createMany({
        data: targets.map((t) => ({
          companyId: user.companyId,
          userId: t.id,
          type: "mention" as const,
          title,
          body,
          resourceType: "task",
          resourceId: taskId,
        })),
      });
    }
  }

  // Notifica o responsável pela tarefa (se não comentou ele mesmo e não foi @mencionado)
  if (task.assigneeId && task.assigneeId !== user.userId && !mentionedIds.has(task.assigneeId)) {
    await createNotification({
      companyId: user.companyId,
      userId: task.assigneeId,
      type: "comment",
      title: `${user.name.split(" ")[0]} comentou na sua tarefa`,
      body: `Em "${task.title}": ${content.replace(MENTION_RE, "@$1").slice(0, 120)}`,
      resourceType: "task",
      resourceId: taskId,
    });
  }

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.commented",
    resourceType: "task",
    resourceId: taskId,
    newValue: { commentId: comment.id },
  });

  dispatchWebhook(user.companyId, "task.commented", {
    taskId,
    taskTitle: task.title,
    commentBy: user.name,
  });

  revalidatePath(`/tarefas/${taskId}`);
}

export async function editCommentAction(commentId: string, content: string): Promise<{ error?: string }> {
  const user = await requireAuth();
  const trimmed = content.trim();
  if (!trimmed) return { error: "Comentário vazio." };

  const comment = await prisma.taskComment.findFirst({
    where: { id: commentId, deletedAt: null },
    select: { id: true, userId: true, taskId: true, task: { select: { companyId: true } } },
  });
  if (!comment || comment.task.companyId !== user.companyId) return { error: "Comentário não encontrado." };

  // Só o autor (ou admin/manager) edita
  const canEdit = comment.userId === user.userId || user.role === "admin" || user.role === "manager";
  if (!canEdit) return { error: "Sem permissão pra editar." };

  await prisma.taskComment.update({
    where: { id: commentId },
    data: { content: trimmed, isEdited: true },
  });

  revalidatePath(`/tarefas/${comment.taskId}`);
  return {};
}

/**
 * Reordena tarefas/subtarefas via drag. Persiste o índice em
 * metadata.templatePosition — campo que o sort do projeto já respeita.
 * orderedIds = irmãos na nova ordem (todos tasks raiz, ou subtasks de 1 parent).
 */
export async function reorderTasksAction(orderedIds: string[]): Promise<void> {
  const user = await requireAuth();
  if (orderedIds.length === 0) return;

  const tasks = await prisma.task.findMany({
    where: { id: { in: orderedIds }, companyId: user.companyId, deletedAt: null },
    select: { id: true, metadata: true, projectId: true },
  });
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const updates = orderedIds
    .map((id, index) => {
      const t = byId.get(id);
      if (!t) return null;
      const meta = (t.metadata && typeof t.metadata === "object" ? t.metadata : {}) as Record<string, unknown>;
      return prisma.task.update({
        where: { id },
        data: { metadata: { ...meta, templatePosition: index } },
      });
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (updates.length > 0) await prisma.$transaction(updates);

  const pid = tasks.find((t) => t.projectId)?.projectId;
  if (pid) revalidatePath(`/projetos/${pid}`);
}

export async function getTaskDetailsAction(taskId: string): Promise<{
  id: string;
  title: string;
  description: string | null;
  status: string;
  isBlocked: boolean;
  priority: string;
  dueDate: Date | null;
  assignee: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  checklistItems: { id: string; title: string; isDone: boolean }[];
  commentsCount: number;
} | null> {
  const user = await requireAuth();
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      isBlocked: true,
      priority: true,
      dueDate: true,
      assignee: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      checklistItems: { orderBy: { position: "asc" }, select: { id: true, title: true, isDone: true } },
      _count: { select: { comments: true } },
    },
  });
  if (!task) return null;
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    isBlocked: task.isBlocked,
    priority: task.priority,
    dueDate: task.dueDate,
    assignee: task.assignee,
    project: task.project,
    checklistItems: task.checklistItems.map((i) => ({ id: i.id, title: i.title, isDone: i.isDone })),
    commentsCount: task._count.comments,
  };
}

export async function duplicateTaskAction(taskId: string): Promise<{ error?: string; newTaskId?: string }> {
  const user = await requireAuth();

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: {
      title: true, description: true, priority: true, assigneeId: true,
      sectorId: true, clientId: true, projectId: true, dueDate: true,
      checklistItems: { select: { title: true, position: true } },
      subtasks: {
        where: { deletedAt: null },
        select: { title: true, description: true, priority: true, assigneeId: true, dueDate: true, sectorId: true },
      },
    },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  const copy = await prisma.task.create({
    data: {
      companyId: user.companyId,
      title: `${task.title} (cópia)`,
      description: task.description,
      priority: task.priority,
      assigneeId: task.assigneeId,
      sectorId: task.sectorId,
      clientId: task.clientId,
      projectId: task.projectId,
      dueDate: task.dueDate,
      createdById: user.userId,
      checklistItems: {
        create: task.checklistItems.map((ci) => ({ title: ci.title, position: ci.position })),
      },
    },
    select: { id: true },
  });

  await Promise.all(
    task.subtasks.map((sub) =>
      prisma.task.create({
        data: {
          companyId: user.companyId,
          title: sub.title,
          description: sub.description,
          priority: sub.priority,
          assigneeId: sub.assigneeId,
          dueDate: sub.dueDate,
          projectId: task.projectId,
          clientId: task.clientId,
          sectorId: task.sectorId,
          parentTaskId: copy.id,
          createdById: user.userId,
        },
      }),
    ),
  );

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.created",
    resourceType: "task",
    resourceId: copy.id,
    newValue: { title: `${task.title} (cópia)`, duplicatedFrom: taskId },
  });

  revalidatePath("/dashboard");
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  return { newTaskId: copy.id };
}

export async function archiveTaskAction(taskId: string): Promise<{ error?: string }> {
  const user = await requireAuth();

  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { title: true, projectId: true },
  });
  if (!task) return { error: "Tarefa não encontrada." };

  await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: new Date() },
  });

  await logActivity({
    companyId: user.companyId,
    userId: user.userId,
    action: "task.updated",
    resourceType: "task",
    resourceId: taskId,
    newValue: { archived: true },
  });

  revalidatePath("/dashboard");
  if (task.projectId) revalidatePath(`/projetos/${task.projectId}`);
  return {};
}

export async function bulkUpdateTaskStatusAction(
  taskIds: string[],
  status: TaskStatus,
): Promise<{ error?: string }> {
  const user = await requireAuth();
  if (!taskIds.length) return {};

  await prisma.task.updateMany({
    where: { id: { in: taskIds }, deletedAt: null, AND: taskVisibilityFilter(user) },
    data: { status, completedAt: status === "done" ? new Date() : null },
  });

  revalidatePath("/dashboard");
  return {};
}

export async function bulkAssignAction(
  taskIds: string[],
  assigneeId: string,
): Promise<{ error?: string }> {
  const user = await requireAuth();
  if (!taskIds.length) return {};

  const assignee = await prisma.user.findFirst({
    where: { id: assigneeId, companyId: user.companyId },
    select: { id: true },
  });
  if (!assignee) return { error: "Usuário não encontrado." };

  // Só conta as que realmente MUDAM de responsável (evita notificar reassign no-op)
  const affected = await prisma.task.findMany({
    where: { id: { in: taskIds }, deletedAt: null, assigneeId: { not: assigneeId }, AND: taskVisibilityFilter(user) },
    select: { id: true },
  });

  await prisma.task.updateMany({
    where: { id: { in: taskIds }, deletedAt: null, AND: taskVisibilityFilter(user) },
    data: { assigneeId },
  });

  // Uma notificação-resumo (evita spam de N notificações num assign em massa)
  if (assigneeId !== user.userId && affected.length > 0) {
    await createNotification({
      companyId: user.companyId,
      userId: assigneeId,
      type: "task_assigned",
      title: `${user.name.split(" ")[0]} atribuiu ${affected.length} tarefa${affected.length !== 1 ? "s" : ""} a você`,
    });
  }

  revalidatePath("/dashboard");
  return {};
}

export async function bulkDeleteAction(taskIds: string[]): Promise<{ error?: string }> {
  const user = await requireAuth();
  if (!taskIds.length) return {};

  const owned = await prisma.task.findMany({
    where: { id: { in: taskIds }, deletedAt: null, AND: taskVisibilityFilter(user) },
    select: { id: true, projectId: true },
  });
  const safeIds = owned.map((t) => t.id);
  const projectIds = [...new Set(owned.map((t) => t.projectId).filter(Boolean) as string[])];

  await prisma.task.updateMany({
    where: { id: { in: safeIds } },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/dashboard");
  for (const pid of projectIds) revalidatePath(`/projetos/${pid}`);
  return {};
}
