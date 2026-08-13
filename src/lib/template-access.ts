import type { Prisma, UserRole } from "@prisma/client";

type TemplateAccessUser = { userId: string; role: UserRole };

/** Templates pessoais criados por admins podem ser liberados a setores específicos. */
export function templateVisibilityFilter(user: TemplateAccessUser): Prisma.TemplateWhereInput {
  if (user.role === "admin") return {};

  return {
    OR: [
      { isPersonal: false },
      { isPersonal: true, createdById: user.userId },
      {
        isPersonal: true,
        targetSectors: { some: { sector: { members: { some: { userId: user.userId } } } } },
      },
    ],
  };
}
