import { readFileSync } from "node:fs";

function loadEnvironment(path: string) {
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    process.env[match[1]] = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
  }
}

loadEnvironment(process.env.AUDIT_ENV_FILE || "env-vercel.env");

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { fetchPublishedClientSheet, resolveManager } = await import("../src/lib/client-sheet-sync");

  const [sheet, company] = await Promise.all([
    fetchPublishedClientSheet(),
    prisma.company.findFirst({
      where: { slug: "agencia-f3f", deletedAt: null },
      select: {
        users: {
          where: { isActive: true, deletedAt: null },
          select: {
            id: true,
            name: true,
            _count: { select: { calendarAvailability: true } },
          },
        },
        clients: {
          where: { deletedAt: null },
          select: {
            name: true,
            managerId: true,
            meetingPlan: true,
            whatsappGroupId: true,
            whatsappGroupName: true,
          },
        },
      },
    }),
  ]);
  if (!company) throw new Error("Empresa agencia-f3f não encontrada.");

  const issues = [...sheet.issues];
  const activeRows = sheet.rows.filter((row) => row.status === "active");
  const sheetGroupCounts = new Map<string, number>();
  const clientsByGroup = new Map<string, typeof company.clients>();

  for (const row of activeRows) {
    sheetGroupCounts.set(row.whatsappGroupId, (sheetGroupCounts.get(row.whatsappGroupId) ?? 0) + 1);
  }
  for (const client of company.clients) {
    if (!client.whatsappGroupId) continue;
    clientsByGroup.set(client.whatsappGroupId, [
      ...(clientsByGroup.get(client.whatsappGroupId) ?? []),
      client,
    ]);
  }

  let ready = 0;
  for (const row of activeRows) {
    const label = `Linha ${row.rowNumber} (${row.clientName})`;
    if ((sheetGroupCounts.get(row.whatsappGroupId) ?? 0) !== 1) {
      issues.push(`${label}: ID UAZAPI duplicado na planilha.`);
      continue;
    }
    const matches = clientsByGroup.get(row.whatsappGroupId) ?? [];
    if (matches.length !== 1) {
      issues.push(`${label}: esperado 1 cliente ativo no sistema; encontrado ${matches.length}.`);
      continue;
    }
    const client = matches[0];
    const manager = resolveManager(company.users, row.managerName, row.clientName);
    if (client.name !== row.clientName) issues.push(`${label}: nome diverge do sistema.`);
    if (client.meetingPlan !== row.plan) issues.push(`${label}: plano diverge do sistema.`);
    if (client.whatsappGroupName !== row.groupName) issues.push(`${label}: nome do grupo diverge do sistema.`);
    if (!manager || client.managerId !== manager.id) issues.push(`${label}: gestor diverge do sistema.`);
    const managerWithAvailability = manager
      ? company.users.find((user) => user.id === manager.id)
      : null;
    if (managerWithAvailability?._count.calendarAvailability === 0) {
      issues.push(`${label}: gestor sem disponibilidade.`);
    }

    const rowIssuePrefix = `${label}:`;
    if (!issues.some((issue) => issue.startsWith(rowIssuePrefix))) ready += 1;
  }

  const activeSheetGroups = new Set(activeRows.map((row) => row.whatsappGroupId));
  for (const client of company.clients) {
    if (!client.whatsappGroupId || !activeSheetGroups.has(client.whatsappGroupId)) {
      issues.push(`Cliente ativo no sistema sem linha ativa válida na planilha: ${client.name}.`);
    }
  }

  console.log(JSON.stringify({
    sourceRows: sheet.sourceRows,
    activeValidRows: activeRows.length,
    activeSystemClients: company.clients.length,
    ready,
    blocked: activeRows.length - ready,
    issues,
  }, null, 2));

  await prisma.$disconnect();
  if (issues.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
