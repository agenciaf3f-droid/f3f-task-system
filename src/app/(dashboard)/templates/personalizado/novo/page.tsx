import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewTemplateForm } from "../../novo/form";

export default async function NovoTemplatePersonalizadoPage() {
  const user = await requireAuth();
  const users = await prisma.user.findMany({
    where: { companyId: user.companyId, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, avatarUrl: true },
  });

  return <NewTemplateForm sectors={[]} users={users} personal />;
}
