import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // --- Company ---
  const company = await prisma.company.upsert({
    where: { slug: "agencia-f3f" },
    update: {},
    create: {
      name: "Agência F3F",
      slug: "agencia-f3f",
      plan: "pro",
    },
  });
  console.log(`✅ Empresa: ${company.name}`);

  // --- Admin user ---
  const passwordHash = await bcrypt.hash("F3f@2025!", 12);

  const admin = await prisma.user.upsert({
    where: { email: "agenciaf3f@gmail.com" },
    update: {},
    create: {
      companyId: company.id,
      name: "Admin F3F",
      email: "agenciaf3f@gmail.com",
      passwordHash,
      role: "admin",
      isActive: true,
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  // --- Sectors ---
  const sectorNames = [
    { name: "Marketing", color: "#6366f1" },
    { name: "Comercial", color: "#f59e0b" },
    { name: "Operações", color: "#10b981" },
    { name: "Design", color: "#ec4899" },
    { name: "TI", color: "#3b82f6" },
  ];

  for (const s of sectorNames) {
    await prisma.sector.upsert({
      where: {
        id: `00000000-0000-0000-0000-${Buffer.from(s.name.padEnd(12)).toString("hex").slice(0, 12)}`,
      },
      update: {},
      create: {
        companyId: company.id,
        name: s.name,
        color: s.color,
        managerId: admin.id,
      },
    });
  }

  // Re-query sectors created
  const sectors = await prisma.sector.findMany({
    where: { companyId: company.id },
  });
  console.log(`✅ Setores criados: ${sectors.length}`);

  // --- Sample tasks ---
  const tasks = [
    {
      title: "Criar conteúdo para redes sociais — semana 17",
      priority: "high" as const,
      status: "todo" as const,
      sectorName: "Marketing",
    },
    {
      title: "Revisar proposta comercial — Cliente XYZ",
      priority: "urgent" as const,
      status: "in_progress" as const,
      sectorName: "Comercial",
    },
    {
      title: "Atualizar manual de operações",
      priority: "medium" as const,
      status: "todo" as const,
      sectorName: "Operações",
    },
    {
      title: "Redesign da landing page",
      priority: "high" as const,
      status: "in_progress" as const,
      sectorName: "Design",
    },
    {
      title: "Configurar servidor de produção",
      priority: "urgent" as const,
      status: "todo" as const,
      sectorName: "TI",
    },
  ];

  for (const t of tasks) {
    const sector = sectors.find((s) => s.name === t.sectorName);
    await prisma.task.create({
      data: {
        companyId: company.id,
        sectorId: sector?.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        assigneeId: admin.id,
        createdById: admin.id,
        dueDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log(`✅ Tarefas de exemplo: ${tasks.length}`);

  console.log("\n🎉 Seed concluído!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  URL:   http://localhost:3000");
  console.log("  Login: agenciaf3f@gmail.com");
  console.log("  Senha: F3f@2025!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
