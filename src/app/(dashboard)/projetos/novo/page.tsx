import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewProjectForm } from "./form";
import { templateVisibilityFilter } from "@/lib/template-access";

export default async function NovoProjetoPage({
  searchParams,
}: {
  searchParams?: Promise<{ clientId?: string }>;
}) {
  const user = await requireAuth();
  const sp = await searchParams;
  const defaultClientId = sp?.clientId;

  const [clients, templates] = await Promise.all([
    prisma.client.findMany({
      where: { companyId: user.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.template.findMany({
      where: { companyId: user.companyId, isActive: true, deletedAt: null, AND: [templateVisibilityFilter(user)] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, description: true, _count: { select: { templateTasks: true } } },
    }),
  ]);

  return <NewProjectForm clients={clients} templates={templates} defaultClientId={defaultClientId} />;
}
