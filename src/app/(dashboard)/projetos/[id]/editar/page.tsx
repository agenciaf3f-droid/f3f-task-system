import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditProjectForm } from "./form";

export default async function EditarProjetoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  if (user.role !== "admin" && user.role !== "manager" && user.role !== "supervisor") notFound();

  const project = await prisma.project.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      client: { select: { name: true, color: true } },
    },
  });

  if (!project) notFound();

  return <EditProjectForm project={project} />;
}
