import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
type Priority = "low" | "medium" | "high" | "urgent";

async function upsertTemplate(
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
    // Atualiza: apaga tarefas antigas e recria
    await prisma.templateTask.deleteMany({ where: { templateId: existing.id } });
    console.log(`♻️  Atualizando "${name}"...`);
    var templateId = existing.id;
  } else {
    const created = await prisma.template.create({
      data: { companyId, createdById, name, description, category, isActive: true },
    });
    var templateId = created.id;
  }

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const tt = await prisma.templateTask.create({
      data: {
        templateId,
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

  console.log(`✅ "${name}" pronto com ${tasks.length} tarefas`);
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

  // ─── GRATUITINHO ─────────────────────────────────────────────────────────
  await upsertTemplate(cid, uid,
    "Gratuitinho",
    "Processo de subida de campanha Gratuitinho",
    "vendas",
    [
      {
        title: "Definir Duração e Budget com o Cliente",
        priority: "high",
        daysToComplete: 1,
      },
      {
        title: "Criativos na Planilha do Cliente",
        priority: "high",
        daysToComplete: 2,
      },
      {
        title: "Configurar Pixel com o Cliente",
        priority: "high",
        daysToComplete: 2,
      },
      {
        title: "Subir campanha do Gratuitinho",
        priority: "high",
        daysToComplete: 3,
      },
    ]
  );

  // ─── METEÓRICO ────────────────────────────────────────────────────────────
  // Cada seção vira uma tarefa principal; itens viram checklist items
  await upsertTemplate(cid, uid,
    "Meteórico",
    "Processo completo do produto Meteórico — do onboarding ao encerramento",
    "meteórico",
    [
      {
        title: "Confirmação e Captação de Insumos",
        priority: "urgent",
        daysToComplete: 2,
        subtasks: [
          // 11 itens estavam colapsados na print — adicione aqui quando tiver a lista completa
          "Ver itens detalhados desta etapa (11 subtarefas — expandir no sistema de origem)",
        ],
      },
      {
        title: "Estrutura do Funil — Reunir os Materiais Recebidos",
        priority: "high",
        daysToComplete: 3,
      },
      {
        title: "Estrutura do Funil — Agendar Reunião para Resolver Domínio e Wordpress",
        priority: "high",
        daysToComplete: 3,
      },
      {
        title: "Estrutura do Funil — Fazer a Página de Aplicação",
        priority: "high",
        daysToComplete: 7,
      },
      {
        title: "Campanhas e Otimização",
        priority: "high",
        daysToComplete: 14,
        subtasks: [
          "Etapa 1: Teste de Criativos",
          "Etapa 2: Teste de Públicos",
          "Etapa 3: Otimização diária",
          "Realocar orçamento dos pausados",
          "Escalar anúncios vencedores",
        ],
      },
      {
        title: "Relatórios e Monitoramento",
        priority: "medium",
        daysToComplete: 30,
        subtasks: [
          "Acompanhar métricas principais",
          "Enviar resumo diário (vídeo/print)",
          "Criar relatório final",
          "Inserir no repositório Meteórico",
        ],
      },
      {
        title: "Encerramento",
        priority: "medium",
        daysToComplete: 1,
        subtasks: [
          "Pausar campanhas",
          "Consolidar resultados",
          "Enviar mensagem solicitando os dados para fazer o Relatório",
          "Registrar aprendizados",
          "Agradecimento + fechamento",
        ],
      },
    ]
  );

  console.log("\n🎉 Gratuitinho e Meteórico criados/atualizados!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
