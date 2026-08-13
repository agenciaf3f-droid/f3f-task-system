import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewTemplateForm } from "../../novo/form";

export default async function NovoTemplatePersonalizadoPage() {
  const user = await requireAuth();
  const [users, sectors] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: user.companyId, isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarUrl: true },
    }),
    prisma.sector.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return <NewTemplateForm sectors={sectors} users={users} personal canAssignSectors={user.role === "admin"} />;
}
