import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewProjectForm } from "./form";

export default async function NovoProjetoPage() {
  const user = await requireAuth();

  const [clients, templates] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.template.findMany({
      where: { companyId: user.companyId, isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, _count: { select: { templateTasks: true } } },
    }),
  ]);

  return <NewProjectForm clients={clients} templates={templates} />;
}
