import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewTemplateForm } from "./form";

export default async function NovoTemplatePage() {
  const user = await requireRole(["admin", "manager"]);

  const [sectors, users] = await Promise.all([
    prisma.sector.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { companyId: user.companyId, isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarUrl: true },
    }),
  ]);

  return <NewTemplateForm sectors={sectors} users={users} />;
}
