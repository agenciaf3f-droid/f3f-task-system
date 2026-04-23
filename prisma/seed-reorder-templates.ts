import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORDER = [
  "Onboarding",
  "Conferência - Fase 1",
  "Conferência - Fase 2",
  "Conferência - Fase 3 Leads",
  "Conferência - Fase 3 Vendas",
  "Conferência - Fase 3 Exterior",
  "Conferência - Fase 3 Caixa Rápido",
  "Gratuitinho",
  "Meteórico",
  "Low-Ticket",
  "Baratinho",
];

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: "agencia-f3f" } });
  if (!company) { console.error("Empresa não encontrada"); process.exit(1); }

  const templates = await prisma.template.findMany({
    where: { companyId: company.id, deletedAt: null },
    select: { id: true, name: true },
  });

  console.log("Templates encontrados:");
  templates.forEach((t) => console.log(`  - "${t.name}"`));

  for (const template of templates) {
    const pos = ORDER.indexOf(template.name);
    const position = pos === -1 ? 99 : pos; // não listados ficam no final
    await prisma.template.update({
      where: { id: template.id },
      data: { position },
    });
    console.log(`✅ "${template.name}" → posição ${position}`);
  }

  console.log("\n🎉 Ordem atualizada!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
