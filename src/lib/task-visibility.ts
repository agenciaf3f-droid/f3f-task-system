import type { Prisma, UserRole } from "@prisma/client";

type VisibilityUser = {
  userId: string;
  companyId: string;
  role: UserRole;
};

const ELEVATED_ROLES: UserRole[] = ["admin", "manager", "supervisor"];

export function isElevated(role: UserRole): boolean {
  return ELEVATED_ROLES.includes(role);
}

/**
 * Cláusula Prisma para escopo de leitura de tasks.
 * - admin/manager/supervisor → tudo da company
 * - member → tasks onde tem relação direta (assignee, multi-assignee, criador, watcher)
 *           OU tasks em projetos onde tem qualquer dessas relações em alguma task.
 */
export function taskVisibilityFilter(user: VisibilityUser): Prisma.TaskWhereInput {
  if (isElevated(user.role)) {
    return { companyId: user.companyId };
  }
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
      // Visibilidade por projeto: se o user tem qualquer relação direta com
      // ALGUMA task do mesmo projeto, vê todas as tasks daquele projeto.
      { project: { tasks: { some: { OR: directOR } } } },
    ],
  };
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
