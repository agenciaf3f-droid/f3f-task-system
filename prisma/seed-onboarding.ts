import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: "agencia-f3f" } });
  if (!company) { console.error("Empresa não encontrada"); process.exit(1); }

  const admin = await prisma.user.findFirst({
    where: { companyId: company.id, isActive: true, role: "admin" },
  });
  if (!admin) { console.error("Admin não encontrado"); process.exit(1); }

  // Verifica se já existe
  const existing = await prisma.template.findFirst({
    where: { companyId: company.id, name: "Onboarding", deletedAt: null },
  });
  if (existing) { console.log("Template Onboarding já existe, pulando."); return; }

  const template = await prisma.template.create({
    data: {
      companyId: company.id,
      createdById: admin.id,
      name: "Onboarding",
      description: "Processo de onboarding de novo cliente",
      category: "onboarding",
      isActive: true,
    },
  });

  const tasks = [
    {
      title: "Criar e etiquetar o cliente com etiqueta 'clientes'",
      priority: "high" as const,
      daysToComplete: 1,
      subtasks: [],
    },
    {
      title: "Mensagem 1 - Boas vindas",
      priority: "high" as const,
      daysToComplete: 1,
      subtasks: [],
    },
    {
      title: "Mensagem 2 - Confirma estratégia + definição do orçamento",
      priority: "high" as const,
      daysToComplete: 1,
      subtasks: [],
    },
    {
      title: "Mensagem 3 - Enviar vídeo para receber o convite da conta",
      priority: "high" as const,
      daysToComplete: 1,
      subtasks: [],
    },
    {
      title: "Passo 1 - Aceitar convite + entrar na conta de anúncios",
      priority: "high" as const,
      daysToComplete: 2,
      subtasks: [],
    },
    {
      title: "Passo 2 - Confirmar se o cliente entrou na conta de anúncios",
      priority: "medium" as const,
      daysToComplete: 2,
      subtasks: [
        "Nome: SEU_NOME - F3F | (GESTOR)",
        "Ex: Primeiro nome: Raphael Leça - F3F | Segundo nome: (GESTOR - FUNCAO)",
      ],
    },
    {
      title: "Mensagem 4 - Após entrar na conta, enviar mensagem pedindo criativos",
      priority: "high" as const,
      daysToComplete: 2,
      subtasks: [],
    },
    {
      title: "Criar públicos de envolvimento",
      priority: "medium" as const,
      daysToComplete: 3,
      subtasks: [],
    },
    {
      title: "Assistir vídeo AULA para criar a pasta de organização",
      priority: "medium" as const,
      daysToComplete: 3,
      subtasks: [],
    },
    {
      title: "Adicionar links úteis no sistema",
      priority: "medium" as const,
      daysToComplete: 3,
      subtasks: [],
    },
    {
      title: "Subir o primeiro anúncio",
      priority: "high" as const,
      daysToComplete: 7,
      subtasks: [],
    },
  ];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const tt = await prisma.templateTask.create({
      data: {
        templateId: template.id,
        title: t.title,
        priority: t.priority,
        position: i,
        daysToComplete: t.daysToComplete,
      },
    });
    for (let j = 0; j < t.subtasks.length; j++) {
      await prisma.templateChecklistItem.create({
        data: { templateTaskId: tt.id, title: t.subtasks[j], position: j },
      });
    }
  }

  console.log(`✅ Template "Onboarding" criado com ${tasks.length} tarefas`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
