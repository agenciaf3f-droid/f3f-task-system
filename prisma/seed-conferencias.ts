import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
type Priority = "low" | "medium" | "high" | "urgent";

async function createTemplate(
  companyId: string,
  createdById: string,
  name: string,
  description: string,
  category: string,
  tasks: { title: string; priority?: Priority; daysToComplete?: number; subtasks?: string[] }[]
) {
  const existing = await prisma.template.findFirst({
    where: { companyId, name, deletedAt: null },
  });
  if (existing) {
    console.log(`⚠️  Template "${name}" já existe, pulando.`);
    return;
  }

  const template = await prisma.template.create({
    data: { companyId, createdById, name, description, category, isActive: true },
  });

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const tt = await prisma.templateTask.create({
      data: {
        templateId: template.id,
        title: t.title,
        priority: t.priority ?? "medium",
        position: i,
        daysToComplete: t.daysToComplete ?? 1,
      },
    });
    for (let j = 0; j < (t.subtasks ?? []).length; j++) {
      await prisma.templateChecklistItem.create({
        data: { templateTaskId: tt.id, title: t.subtasks![j], position: j },
      });
    }
  }

  console.log(`✅ "${name}" criado com ${tasks.length} tarefas`);
}

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: "agencia-f3f" } });
  if (!company) { console.error("Empresa não encontrada"); process.exit(1); }

  const admin = await prisma.user.findFirst({
    where: { companyId: company.id, isActive: true, role: "admin" },
  });
  if (!admin) { console.error("Admin não encontrado"); process.exit(1); }

  const cid = company.id;
  const uid = admin.id;

  // ─── CONFERÊNCIA FASE 1 ───────────────────────────────────────────────────
  await createTemplate(cid, uid,
    "Conferência - Fase 1",
    "Checklist de conferência para campanha em Fase 1 (Investimento)",
    "conferência",
    [
      {
        title: "Confirmar configuração da campanha | EX: objetivo certo",
        priority: "high",
      },
      {
        title: "Confirmar configuração do conjunto | EX: se a meta de desempenho ta certa",
        priority: "high",
      },
      {
        title: "Confirmar se o público esta certo",
        priority: "high",
      },
      {
        title: "Confirmar se o orçamento esta certo",
        priority: "high",
      },
      {
        title: "Confirmar configuração dos anúncios | EX: Anúncio correto + Desativar advantage+",
        priority: "high",
        subtasks: ["Assistir AULA de referência antes de conferir"],
      },
    ]
  );

  // ─── CONFERÊNCIA FASE 2 ───────────────────────────────────────────────────
  await createTemplate(cid, uid,
    "Conferência - Fase 2",
    "Checklist de conferência para campanha em Fase 2 (Investimento)",
    "conferência",
    [
      {
        title: "Confirmar públicos que o cliente quer usar | EX: Balde + Env 30D ou Env 7D etc...",
        priority: "high",
      },
      {
        title: "Confirmar configuração da campanha | EX: objetivo certo",
        priority: "high",
      },
      {
        title: "Confirmar configuração do conjunto | EX: se a meta de desempenho ta certa",
        priority: "high",
      },
      {
        title: "Confirmar se o orçamento esta certo em cada conjunto",
        priority: "high",
      },
      {
        title: "Confirmar configuração dos anúncios | EX: Verificar se é o anúncio certo em todos os conjuntos",
        priority: "high",
      },
      {
        title: "Criar público de exclusão",
        priority: "medium",
      },
      {
        title: "Criar público do balde",
        priority: "medium",
      },
      {
        title: "Confirmar se o público de exclusão ta certo",
        priority: "high",
      },
      {
        title: "Confirmar se o público esta certo",
        priority: "high",
        subtasks: ["Assistir AULA de referência antes de conferir"],
      },
    ]
  );

  // ─── CONFERÊNCIA FASE 3 - LEADS ───────────────────────────────────────────
  await createTemplate(cid, uid,
    "Conferência - Fase 3 Leads",
    "Checklist de conferência para campanha de Leads em Fase 3",
    "conferência",
    [
      {
        title: "Confirmar configuração da campanha | EX: objetivo certo",
        priority: "high",
      },
      {
        title: "Confirmar configuração do conjunto | EX: se a meta de desempenho ta certa",
        priority: "high",
      },
      {
        title: "Confirmar número do WhatsApp",
        priority: "high",
      },
      {
        title: "Confirmar se o público esta certo",
        priority: "high",
      },
      {
        title: "Confirmar se o orçamento esta certo",
        priority: "high",
      },
      {
        title: "Confirmar configuração dos anúncios | EX: Anúncio correto + Desativar advantage+",
        priority: "high",
      },
      {
        title: "Confirmar mensagem do lead | Precisa pedir para o cliente e deve ter até 80 caracteres",
        priority: "high",
        subtasks: ["Assistir AULA de referência antes de conferir"],
      },
    ]
  );

  // ─── CONFERÊNCIA FASE 3 - VENDAS ─────────────────────────────────────────
  await createTemplate(cid, uid,
    "Conferência - Fase 3 Vendas",
    "Checklist de conferência para campanha de Vendas em Fase 3",
    "conferência",
    [
      {
        title: "Confirmar configuração da campanha | EX: objetivo certo",
        priority: "high",
      },
      {
        title: "Confirmar configuração do conjunto | EX: se a meta de desempenho ta certa",
        priority: "high",
      },
      {
        title: "Confirmar pixel para Fase 3 | Se não tiver, precisa criar",
        priority: "high",
        subtasks: ["Ver AULA de como criar o pixel se necessário"],
      },
      {
        title: "Colocar pixel no checkout dos produtos que ele pretende vender",
        priority: "high",
      },
      {
        title: "Confirmar se o público esta certo",
        priority: "high",
      },
      {
        title: "Confirmar se o orçamento esta certo",
        priority: "high",
      },
      {
        title: "Confirmar configuração dos anúncios | EX: Anúncio correto + Desativar advantage+",
        priority: "high",
      },
      {
        title: "Confirmar mensagem do lead | Pedir ao cliente, deve ter até 80 caracteres",
        priority: "high",
      },
      {
        title: "Adicionar UTMs",
        priority: "medium",
        subtasks: ["Assistir AULA de referência antes de conferir"],
      },
    ]
  );

  // ─── CONFERÊNCIA FASE 3 - EXTERIOR ───────────────────────────────────────
  await createTemplate(cid, uid,
    "Conferência - Fase 3 Exterior",
    "Checklist de conferência para campanha Exterior em Fase 3",
    "conferência",
    [
      {
        title: "Confirmar configuração da campanha | EX: objetivo certo",
        priority: "high",
      },
      {
        title: "Confirmar configuração do conjunto | EX: se a meta de desempenho ta certa",
        priority: "high",
      },
      {
        title: "Confirmar número do WhatsApp",
        priority: "high",
      },
      {
        title: "Confirmar se o público esta certo",
        priority: "high",
      },
      {
        title: "Confirmar se o orçamento esta certo",
        priority: "high",
      },
      {
        title: "Confirmar configuração dos anúncios | EX: Anúncio correto + Desativar advantage+",
        priority: "high",
      },
      {
        title: "Confirmar mensagem do lead | Precisa pedir para o cliente e deve ter até 80 caracteres",
        priority: "high",
        subtasks: ["Assistir AULA de referência antes de conferir"],
      },
    ]
  );

  // ─── CONFERÊNCIA FASE 3 - CAIXA RÁPIDO ───────────────────────────────────
  await createTemplate(cid, uid,
    "Conferência - Fase 3 Caixa Rápido",
    "Checklist de conferência para campanha com Caixa Rápido em Fase 3",
    "conferência",
    [
      {
        title: "Confirmar qual caixa rápido o cliente vai aplicar",
        priority: "high",
      },
      {
        title: "Confirmar configuração da campanha | EX: objetivo certo",
        priority: "high",
      },
      {
        title: "Confirmar configuração do conjunto | EX: se a meta de desempenho ta certa",
        priority: "high",
      },
      {
        title: "Confirmar número do WhatsApp",
        priority: "high",
      },
      {
        title: "Confirmar se o público esta certo",
        priority: "high",
      },
      {
        title: "Confirmar se o orçamento esta certo",
        priority: "high",
      },
      {
        title: "Confirmar configuração dos anúncios | EX: Anúncio correto + Desativar advantage+",
        priority: "high",
      },
      {
        title: "Confirmar mensagem do lead | Precisa pedir para o cliente e deve ter até 80 caracteres",
        priority: "high",
        subtasks: ["Assistir AULA de referência antes de conferir"],
      },
    ]
  );

  console.log("\n🎉 Todos os templates de conferência criados!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
