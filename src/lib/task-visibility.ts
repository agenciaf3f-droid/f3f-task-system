import type { Prisma, UserRole, ProjectStatus } from "@prisma/client";

type VisibilityUser = {
  userId: string;
  companyId: string;
  role: UserRole;
};

const ELEVATED_ROLES: UserRole[] = ["admin", "manager", "supervisor"];

/**
 * Status de projeto que efetivamente "cancelam" as tarefas dele —
 * ninguém deve fazê-las e elas somem das listagens de tasks ativas.
 * Inclui pausado, arquivado e cancelado. Concluído ("completed") fica fora
 * pra não esconder tasks done de projetos finalizados.
 */
export const INACTIVE_PROJECT_STATUSES: ProjectStatus[] = ["paused", "archived", "cancelled"];

/**
 * Cláusula que filtra tasks cujo projeto NÃO está pausado/arquivado/cancelado.
 * Tasks sem project_id (standalone) sempre passam.
 */
export const activeProjectScope: Prisma.TaskWhereInput = {
  OR: [
    { projectId: null },
    { project: { status: { notIn: INACTIVE_PROJECT_STATUSES } } },
  ],
};

export function isElevated(role: UserRole): boolean {
  return ELEVATED_ROLES.includes(role);
}

/**
 * Cláusula Prisma para escopo de leitura de tasks.
 * - admin/manager/supervisor → tudo da company
 * - member → tasks onde tem relação direta (assignee, multi-assignee, criador, watcher)
 *           OU tasks em projetos onde tem qualquer dessas relações em alguma task.
 *
 * Sempre exclui tasks de projetos arquivados/cancelados (essas tasks somem das listagens).
 */
export function taskVisibilityFilter(user: VisibilityUser): Prisma.TaskWhereInput {
  const baseScope: Prisma.TaskWhereInput = isElevated(user.role)
    ? { companyId: user.companyId }
    : (() => {
        const userId = user.userId;
        const directOR: Prisma.TaskWhereInput[] = [
          { assigneeId: userId },
          { createdById: userId },
          { assignees: { some: { userId } } },
          { watchers: { some: { userId } } },
        ];
        return {
          companyId: user.companyId,
          OR: [
            ...directOR,
            { project: { tasks: { some: { OR: directOR } } } },
          ],
        };
      })();

  return { AND: [baseScope, activeProjectScope] };
}

/**
 * Cláusula Prisma para escopo de leitura de projects.
 * - admin/manager/supervisor → tudo da company
 * - member → projetos onde tem qualquer relação direta com alguma task,
 *           OU é o criador do projeto.
 */
export function projectVisibilityFilter(user: VisibilityUser): Prisma.ProjectWhereInput {
  if (isElevated(user.role)) {
    return { companyId: user.companyId };
  }
  const userId = user.userId;
  return {
    companyId: user.companyId,
    OR: [
      { createdById: userId },
      {
        tasks: {
          some: {
            OR: [
              { assigneeId: userId },
              { createdById: userId },
              { assignees: { some: { userId } } },
              { watchers: { some: { userId } } },
            ],
          },
        },
      },
    ],
  };
}

/**
 * Verifica se o user pode ver uma task já carregada.
 * Útil pra checagens em mutations que recebem taskId do cliente.
 */
export function canSeeTask(
  user: VisibilityUser,
  task: {
    companyId: string;
    assigneeId: string | null;
    createdById: string;
    projectId: string | null;
    assignees?: { userId: string }[];
    watchers?: { userId: string }[];
  },
  projectMemberUserIds?: Set<string>,
): boolean {
  if (task.companyId !== user.companyId) return false;
  if (isElevated(user.role)) return true;
  const uid = user.userId;
  if (task.assigneeId === uid) return true;
  if (task.createdById === uid) return true;
  if (task.assignees?.some((a) => a.userId === uid)) return true;
  if (task.watchers?.some((w) => w.userId === uid)) return true;
  if (projectMemberUserIds?.has(uid)) return true;
  return false;
}
