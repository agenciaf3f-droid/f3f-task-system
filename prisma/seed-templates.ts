import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Priority = "low" | "medium" | "high" | "urgent";

interface TemplateTaskSpec {
  title: string;
  subtasks?: string[];
  priority?: Priority;
  daysToComplete?: number;
  assigneeId?: string;
}

async function createTemplate(
  companyId: string,
  templateName: string,
  tasks: TemplateTaskSpec[],
  createdById: string
) {
  console.log(`\n📋 Criando template: ${templateName}`);

  const template = await prisma.template.create({
    data: {
      companyId,
      createdById,
      name: templateName,
      description: `Template padrão: ${templateName}`,
      category: "vendas",
      isActive: true,
    },
  });

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const templateTask = await prisma.templateTask.create({
      data: {
        templateId: template.id,
        title: task.title,
        priority: task.priority || "medium",
        position: i,
        daysToComplete: task.daysToComplete || 3,
        ...(task.assigneeId && { defaultAssigneeId: task.assigneeId }),
      },
    });

    if (task.subtasks && task.subtasks.length > 0) {
      for (let j = 0; j < task.subtasks.length; j++) {
        await prisma.templateChecklistItem.create({
          data: {
            templateTaskId: templateTask.id,
            title: task.subtasks[j],
            position: j,
          },
        });
      }
    }
  }

  console.log(`✅ Template "${templateName}" criado com ${tasks.length} tarefas`);
}

async function main() {
  console.log("🌱 Criando templates...");

  // Buscar empresa
  const company = await prisma.company.findUnique({
    where: { slug: "agencia-f3f" },
  });

  if (!company) {
    console.error("❌ Empresa 'agencia-f3f' não encontrada");
    process.exit(1);
  }

  // Buscar usuários da empresa para mapear assignees
  const users = await prisma.user.findMany({
    where: { companyId: company.id, isActive: true },
  });

  if (users.length === 0) {
    console.error("❌ Nenhum usuário ativo encontrado na empresa");
    process.exit(1);
  }

  const adminUser = users.find((u) => u.role === "admin") || users[0];

  console.log(`\n👥 Usuários encontrados: ${users.length}`);
  users.forEach((u) => console.log(`   - ${u.name} (${u.email})`));

  // Mapear assignees por nome (procura parcial)
  const findUserByNamePart = (namePart: string) => {
    return users.find((u) =>
      u.name.toLowerCase().includes(namePart.toLowerCase())
    );
  };

  const pauloUser = findUserByNamePart("paulo") || adminUser;
  const denzelUser = findUserByNamePart("denzel") || adminUser;
  const raphinUser = findUserByNamePart("raphin") || adminUser;

  console.log("\n🔗 Mapeamento de assignees:");
  console.log(`   Paulo: ${pauloUser?.name}`);
  console.log(`   Denzel: ${denzelUser?.name}`);
  console.log(`   Raphin: ${raphinUser?.name}`);

  // --- TEMPLATE: BARATINHO ---
  const baratinhoTasks: TemplateTaskSpec[] = [
    { title: "Marcar reunião de alinhamento", daysToComplete: 1 },
    { title: "Acessos", daysToComplete: 2 },
    { title: "Organizando a Campanha", daysToComplete: 2 },
    { title: "Datas", daysToComplete: 1 },
    { title: "Nome do produto", daysToComplete: 1 },
    { title: "Promoção", daysToComplete: 2 },
    {
      title: "Produto",
      priority: "high",
      daysToComplete: 7,
      assigneeId: pauloUser?.id,
      subtasks: [
        "Criar Produto na Plataforma",
        "Criar Galeria de Imagens",
        "Configurar Checkout com a Plataforma",
      ],
    },
    {
      title: "Página de Vendas",
      priority: "high",
      daysToComplete: 14,
      assigneeId: denzelUser?.id,
      subtasks: [
        "Copywriting Principal",
        "Assinação Hospedagem",
        "Configurar Cloudflare",
        "Configurar Mensagens e Elementor",
        "Configurar Rastreamento",
        "Copy da Página de Vendas",
        "Criar Anúncio e Tráfego",
        "Revisão Marketing da Página",
        "Fazer print PDF da página do Elementor",
      ],
    },
    {
      title: "Configurar IM",
      priority: "medium",
      daysToComplete: 5,
      assigneeId: raphinUser?.id,
      subtasks: [
        "Criar contas de anúncios",
        "Adicionar cartão",
        "Adicionar número na conta",
      ],
    },
    {
      title: "Automações",
      priority: "medium",
      daysToComplete: 7,
      subtasks: [
        "Criar Automação da Mensagem Inicial ao Comprar o Pro",
        "Criar Furado Diário",
      ],
    },
    {
      title: "Planilha do tráfego para criativos",
      priority: "medium",
      daysToComplete: 3,
      subtasks: [
        "Colomar Planilha de Tráfego para os Criativos",
        "Alimentar planilha de criativos em vídeo",
        "Alimentar planilha de criativos de carrossel e imagem",
      ],
    },
    { title: "Criar UTMIfy", daysToComplete: 2 },
    { title: "Subir Campanha de Anúncios - Leva 01", priority: "high", daysToComplete: 3 },
    { title: "Reunião Marketing Interna", daysToComplete: 1 },
    {
      title: "Otimização Diária de Anúncios",
      priority: "high",
      daysToComplete: 30,
      subtasks: [
        "Otimização Diária de Anúncios",
        "Criar Audiência",
      ],
    },
  ];

  await createTemplate(company.id, "Baratinho", baratinhoTasks, adminUser.id);

  // --- TEMPLATE: GRATUITINHO ---
  const gratuitinhoTasks: TemplateTaskSpec[] = [
    { title: "Marcar reunião de alinhamento", daysToComplete: 1 },
    { title: "Acessos", daysToComplete: 2 },
    { title: "Organizando a Campanha", daysToComplete: 2 },
    { title: "Datas", daysToComplete: 1 },
    { title: "Nome do produto", daysToComplete: 1 },
    { title: "Promoção", daysToComplete: 2 },
    {
      title: "Produto",
      priority: "high",
      daysToComplete: 7,
      assigneeId: pauloUser?.id,
      subtasks: [
        "Criar Produto na Plataforma",
        "Criar Galeria de Imagens",
        "Configurar Checkout com a Plataforma",
      ],
    },
    {
      title: "Página de Vendas",
      priority: "high",
      daysToComplete: 14,
      assigneeId: denzelUser?.id,
      subtasks: [
        "Copywriting Principal",
        "Assinação Hospedagem",
        "Configurar Cloudflare",
        "Configurar Mensagens e Elementor",
        "Configurar Rastreamento",
        "Copy da Página de Vendas",
        "Criar Anúncio e Tráfego",
        "Revisão Marketing da Página",
        "Fazer print PDF da página do Elementor",
      ],
    },
    {
      title: "Configurar IM",
      priority: "medium",
      daysToComplete: 5,
      assigneeId: raphinUser?.id,
      subtasks: [
        "Criar contas de anúncios",
        "Adicionar cartão",
        "Adicionar número na conta",
      ],
    },
    {
      title: "Automações",
      priority: "medium",
      daysToComplete: 7,
      subtasks: [
        "Criar Automação da Mensagem Inicial ao Comprar o Pro",
        "Criar Furado Diário",
      ],
    },
    {
      title: "Planilha do tráfego para criativos",
      priority: "medium",
      daysToComplete: 3,
      subtasks: [
        "Colomar Planilha de Tráfego para os Criativos",
        "Alimentar planilha de criativos em vídeo",
        "Alimentar planilha de criativos de carrossel e imagem",
      ],
    },
    { title: "Criar UTMIfy", daysToComplete: 2 },
    { title: "Subir Campanha de Anúncios - Leva 01", priority: "high", daysToComplete: 3 },
    { title: "Reunião Marketing Interna", daysToComplete: 1 },
    {
      title: "Otimização Diária de Anúncios",
      priority: "high",
      daysToComplete: 30,
      subtasks: [
        "Otimização Diária de Anúncios",
        "Criar Audiência",
      ],
    },
  ];

  await createTemplate(company.id, "Gratuitinho", gratuitinhoTasks, adminUser.id);

  // --- TEMPLATE: ONBOARDING ---
  const onboardingTasks: TemplateTaskSpec[] = [
    {
      title: "Criar e etiquetar o cliente com etiqueta 'clientes'",
      priority: "high",
      daysToComplete: 1,
    },
    {
      title: "Mensagem 1 - Boas vindas",
      priority: "high",
      daysToComplete: 1,
    },
    {
      title: "Mensagem 2 - Confirma estratégia + definição do orçamento",
      priority: "high",
      daysToComplete: 1,
    },
    {
      title: "Mensagem 3 - Enviar vídeo para receber o convite da conta",
      priority: "high",
      daysToComplete: 1,
    },
    {
      title: "Passo 1 - Aceitar convite + entrar na conta de anúncios",
      priority: "high",
      daysToComplete: 2,
    },
    {
      title: "Passo 2 - Confirmar se o cliente entrou na conta de anúncios",
      priority: "medium",
      daysToComplete: 2,
      subtasks: [
        "Nome para colocar na conta: SEU_NOME - F3F | (GESTOR)",
        "Ex: Primeiro nome: Raphael Leça - F3F | Segundo nome: (GESTOR - FUNCAO)",
      ],
    },
    {
      title: "Mensagem 4 - Após entrar na conta de anúncio, enviar mensagem pedindo criativos",
      priority: "high",
      daysToComplete: 2,
    },
    {
      title: "Criar públicos de envolvimento",
      priority: "medium",
      daysToComplete: 3,
    },
    {
      title: "Assistir vídeo AULA para criar a pasta de organização",
      priority: "medium",
      daysToComplete: 3,
    },
    {
      title: "Adicionar links úteis no sistema",
      priority: "medium",
      daysToComplete: 3,
    },
    {
      title: "Subir o primeiro anúncio",
      priority: "high",
      daysToComplete: 7,
    },
  ];

  await createTemplate(company.id, "Onboarding", onboardingTasks, adminUser.id);

  console.log("\n🎉 Templates criados com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
