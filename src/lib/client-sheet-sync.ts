import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pickColor } from "@/lib/color";
import { listWhatsAppGroups } from "@/lib/whatsapp";

const COMPANY_SLUG = "agencia-f3f";
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTK9DhrWACjloFOoAUsC26xHmJLgnpDXnjvN4IzROtUC4WTx-64d4wM661AtlgPJkbt_jOXQsxrCfDk/pub?output=csv";
const GROUP_ID_PATTERN = /^\d+@g\.us$/;
const MANAGER_ALIASES: Record<string, string> = {
  rafhael: "rafinha",
  raphael: "rafinha",
};
const CLIENT_NAME_ALIASES: Record<string, string> = {
  "sinergia (rubens e rogerio)": "Sinergia",
};

export type SheetClient = {
  groupName: string;
  clientName: string;
  managerName: string;
  status: "active" | "inactive";
  sourceGroupId: string;
  whatsappGroupId: string;
  plan: string;
  /** Coluna "ID Cliente" da planilha. Vazio em algumas linhas, então é opcional. */
  externalId: string;
  rowNumber: number;
};

export async function fetchPublishedClientSheet(): Promise<{
  rows: SheetClient[];
  issues: string[];
  sourceRows: number;
}> {
  const response = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Planilha respondeu HTTP ${response.status}.`);

  const csv = await response.text();
  if (csv.length > 5_000_000) throw new Error("Planilha excede o limite de 5 MB.");
  return parseClientSheet(csv);
}

export type ClientSheetSyncResult = {
  rows: number;
  created: number;
  updated: number;
  archived: number;
  deduplicated: number;
  unchanged: number;
  skipped: number;
  issues: string[];
};

export type BookingDestinationAudit = {
  sourceRows: number;
  activeValidRows: number;
  activeSystemClients: number;
  ready: number;
  blocked: number;
  issues: string[];
};

export type ClientDuplicateAudit = {
  candidates: Array<{
    canonicalName: string;
    duplicateNames: string[];
    projects: number;
    tasks: number;
    bookingLinks: number;
  }>;
  ambiguous: Array<{ clientName: string; possibleTargets: string[] }>;
};

export type ClientDuplicateMergeResult = {
  merged: number;
  canonicalClients: number;
  transferredProjects: number;
  transferredTasks: number;
  transferredBookingLinks: number;
  ambiguous: ClientDuplicateAudit["ambiguous"];
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function clean(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function canonicalizeClientName(value: string): string {
  const cleaned = clean(value);
  return CLIENT_NAME_ALIASES[normalize(cleaned)] ?? cleaned;
}

const NAME_STOP_WORDS = new Set(["a", "o", "e", "da", "das", "de", "do", "dos"]);

function meaningfulNameTokens(value: string): string[] {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token && !NAME_STOP_WORDS.has(token));
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
        ? diagonal
        : 1 + Math.min(diagonal, previous[rightIndex - 1], above);
      diagonal = above;
    }
  }
  return previous[right.length];
}

export function isSafeClientNameVariant(left: string, right: string): boolean {
  if (normalize(canonicalizeClientName(left)) === normalize(canonicalizeClientName(right))) return true;
  const leftTokens = meaningfulNameTokens(left);
  const rightTokens = meaningfulNameTokens(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) return false;

  const shorter = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longer = leftTokens.length <= rightTokens.length ? rightTokens : leftTokens;
  const longerSet = new Set(longer);
  if (
    shorter.length >= 2
    && shorter.every((token) => longerSet.has(token))
    && shorter.length / longer.length >= 0.5
  ) return true;

  const leftCompact = leftTokens.join("");
  const rightCompact = rightTokens.join("");
  return Math.min(leftCompact.length, rightCompact.length) >= 12
    && editDistance(leftCompact, rightCompact) <= 2;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractClientName(groupName: string, plan: string): string {
  let name = clean(groupName)
    .replace(/\(\s*fechado\s*\)/gi, "")
    .replace(/^\s*f3f\s*-\s*/i, "")
    .trim();

  const cleanedPlan = clean(plan);
  if (cleanedPlan) {
    name = name.replace(
      new RegExp(`\\s*-\\s*${escapeRegExp(cleanedPlan)}\\s*$`, "i"),
      "",
    );
  } else {
    // Algumas linhas existentes recebem o ID UAZAPI antes do preenchimento do plano.
    // O nome do grupo continua no padrão "F3F - Cliente - PLANO"; remove somente
    // o último segmento para encontrar o cadastro atual e preservar seu plano.
    name = name.replace(/\s+-\s+[^-]+$/, "");
  }

  return canonicalizeClientName(clean(name) || clean(groupName));
}

export function inferPlanFromGroupName(groupName: string): string {
  const cleanedGroup = clean(groupName).replace(/\(\s*fechado\s*\)/gi, "");
  const match = cleanedGroup.match(/\s+-\s+([^-]+)\s*$/);
  if (!match) return "";

  const candidate = clean(match[1]);
  return /^(?:\d+\s+FASES?|FUNIL|LOW[- ]?TICKET|PREMIUM)$/i.test(candidate)
    ? candidate
    : "";
}

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

export function parseClientSheet(csv: string): {
  rows: SheetClient[];
  issues: string[];
  sourceRows: number;
} {
  const parsed = parseCsv(csv);
  const header = parsed[0] ?? [];
  const indexes = new Map(header.map((value, index) => [normalize(value), index]));
  const required = ["grupo", "gestor responsavel", "status", "id do grupo", "id grupo (uazapi)", "plano"];
  const missing = required.filter((key) => !indexes.has(key));
  if (missing.length > 0) {
    throw new Error(`Colunas ausentes na planilha: ${missing.join(", ")}`);
  }

  const valueAt = (row: string[], key: string) => clean(row[indexes.get(key)!] ?? "");
  const rows: SheetClient[] = [];
  const issues: string[] = [];

  parsed.slice(1).forEach((sourceRow, index) => {
    const rowNumber = index + 2;
    const groupName = valueAt(sourceRow, "grupo");
    const rawStatus = normalize(valueAt(sourceRow, "status"));
    if (!groupName || (rawStatus !== "ativo" && rawStatus !== "inativo")) return;

    const plan = valueAt(sourceRow, "plano") || inferPlanFromGroupName(groupName);
    const sourceGroupId = valueAt(sourceRow, "id do grupo");
    const whatsappGroupId = valueAt(sourceRow, "id grupo (uazapi)");
    const managerName = valueAt(sourceRow, "gestor responsavel");
    // Fora de `required` de propósito: se o cabeçalho sumir, a sync inteira não
    // pode parar por causa de um campo que nem todas as linhas preenchem.
    const externalId = indexes.has("id cliente") ? valueAt(sourceRow, "id cliente") : "";
    const status = rawStatus === "ativo" ? "active" : "inactive";
    const clientName = extractClientName(groupName, plan);

    if (!plan) {
      issues.push(`Linha ${rowNumber}: plano ausente.`);
      return;
    }
    if (whatsappGroupId && !GROUP_ID_PATTERN.test(whatsappGroupId)) {
      issues.push(`Linha ${rowNumber}: ID UAZAPI inválido; cliente cadastrado sem habilitar reuniões.`);
    }
    if (groupName.length > 255 || clientName.length > 255 || plan.length > 100) {
      issues.push(`Linha ${rowNumber}: nome ou plano excede o limite permitido.`);
      return;
    }

    rows.push({
      groupName,
      clientName,
      managerName,
      status,
      sourceGroupId,
      whatsappGroupId,
      plan,
      externalId: externalId.slice(0, 50),
      rowNumber,
    });
  });

  return { rows, issues, sourceRows: Math.max(0, parsed.length - 1) };
}

type Manager = Pick<User, "id" | "name">;

function uniqueManagerMap(users: Manager[], keyFor: (user: Manager) => string) {
  const grouped = new Map<string, Manager[]>();
  for (const user of users) {
    const key = keyFor(user);
    grouped.set(key, [...(grouped.get(key) ?? []), user]);
  }
  return new Map(
    [...grouped.entries()]
      .filter(([, matches]) => matches.length === 1)
      .map(([key, matches]) => [key, matches[0]]),
  );
}

export function resolveManager(
  users: Manager[],
  sheetName: string,
  clientName?: string,
): Manager | null {
  const byName = uniqueManagerMap(users, (user) => normalize(user.name));
  const byFirstName = uniqueManagerMap(users, (user) => normalize(user.name).split(" ")[0]);
  const normalizedName = normalize(sheetName);
  const firstName = normalizedName.split(" ")[0];
  if (["rafinha", "rafhael", "raphael"].includes(firstName)) {
    const correctedManager = normalize(clientName ?? "") === "arthur" ? "denzel" : "amorim";
    return byName.get(correctedManager) ?? byFirstName.get(correctedManager) ?? null;
  }
  const alias = MANAGER_ALIASES[normalizedName];
  return byName.get(normalizedName)
    ?? byFirstName.get(normalizedName)
    ?? (alias ? byName.get(alias) ?? byFirstName.get(alias) : null)
    ?? null;
}

export async function auditBookingDestinations(): Promise<BookingDestinationAudit> {
  const [sheet, company, whatsappGroups] = await Promise.all([
    fetchPublishedClientSheet(),
    prisma.company.findFirst({
      where: { slug: COMPANY_SLUG, deletedAt: null },
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
            externalId: true,
          },
        },
      },
    }),
    listWhatsAppGroups(),
  ]);
  if (!company) throw new Error(`Empresa ${COMPANY_SLUG} não encontrada.`);

  const issues = [...sheet.issues];
  const activeRows = sheet.rows.filter((row) => row.status === "active");
  const sheetGroupCounts = new Map<string, number>();
  const clientsByGroup = new Map<string, typeof company.clients>();
  const whatsappGroupsById = new Map(whatsappGroups.map((group) => [group.id, group]));

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
    const rowIssues: string[] = [];
    if ((sheetGroupCounts.get(row.whatsappGroupId) ?? 0) !== 1) {
      rowIssues.push("ID UAZAPI duplicado na planilha");
    }
    const whatsappGroup = whatsappGroupsById.get(row.whatsappGroupId);
    if (!whatsappGroup) {
      rowIssues.push("ID não encontrado na instância UAZAPI");
    } else if (normalize(whatsappGroup.name) !== normalize(row.groupName)) {
      rowIssues.push("nome do grupo diverge da UAZAPI");
    }
    const matches = clientsByGroup.get(row.whatsappGroupId) ?? [];
    if (matches.length !== 1) {
      rowIssues.push(`esperado 1 cliente ativo no sistema; encontrado ${matches.length}`);
    } else {
      const client = matches[0];
      const manager = resolveManager(company.users, row.managerName, row.clientName);
      if (client.name !== row.clientName) rowIssues.push("nome diverge do sistema");
      if (row.plan && client.meetingPlan !== row.plan) rowIssues.push("plano diverge do sistema");
      if (client.whatsappGroupName !== row.groupName) rowIssues.push("nome do grupo diverge do sistema");
      if (!manager || client.managerId !== manager.id) rowIssues.push("gestor diverge do sistema");
      const managerAvailability = manager
        ? company.users.find((user) => user.id === manager.id)?._count.calendarAvailability
        : null;
      if (managerAvailability === 0) rowIssues.push("gestor sem disponibilidade");
    }

    if (rowIssues.length === 0) ready += 1;
    else issues.push(`${label}: ${rowIssues.join("; ")}.`);
  }

  const activeSheetGroups = new Set(activeRows.map((row) => row.whatsappGroupId));
  for (const client of company.clients) {
    if (!client.whatsappGroupId || !activeSheetGroups.has(client.whatsappGroupId)) {
      issues.push(`Cliente ativo no sistema sem linha ativa válida na planilha: ${client.name}.`);
    }
  }

  return {
    sourceRows: sheet.sourceRows,
    activeValidRows: activeRows.length,
    activeSystemClients: company.clients.length,
    ready,
    blocked: activeRows.length - ready,
    issues: issues.slice(0, 100),
  };
}

export async function auditClientNameDuplicates(): Promise<ClientDuplicateAudit> {
  const [sheet, company] = await Promise.all([
    fetchPublishedClientSheet(),
    prisma.company.findFirst({
      where: { slug: COMPANY_SLUG, deletedAt: null },
      select: {
        clients: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            whatsappGroupId: true,
            _count: { select: { projects: true, tasks: true, bookingMagicLinks: true } },
          },
        },
      },
    }),
  ]);
  if (!company) throw new Error(`Empresa ${COMPANY_SLUG} não encontrada.`);

  const activeRows = sheet.rows.filter((row) => row.status === "active");
  const activeGroups = new Set(activeRows.map((row) => row.whatsappGroupId));
  const groupedCandidates = new Map<string, {
    canonicalName: string;
    duplicateNames: string[];
    projects: number;
    tasks: number;
    bookingLinks: number;
  }>();
  const ambiguous: ClientDuplicateAudit["ambiguous"] = [];

  for (const client of company.clients) {
    if (client.whatsappGroupId && activeGroups.has(client.whatsappGroupId)) continue;
    const targets = activeRows.filter((row) => isSafeClientNameVariant(client.name, row.clientName));
    if (targets.length !== 1) {
      if (targets.length > 1) {
        ambiguous.push({ clientName: client.name, possibleTargets: targets.map((row) => row.clientName) });
      }
      continue;
    }

    const target = targets[0];
    const current = groupedCandidates.get(target.whatsappGroupId) ?? {
      canonicalName: target.clientName,
      duplicateNames: [],
      projects: 0,
      tasks: 0,
      bookingLinks: 0,
    };
    current.duplicateNames.push(client.name);
    current.projects += client._count.projects;
    current.tasks += client._count.tasks;
    current.bookingLinks += client._count.bookingMagicLinks;
    groupedCandidates.set(target.whatsappGroupId, current);
  }

  return { candidates: [...groupedCandidates.values()], ambiguous };
}

export async function mergeClientNameDuplicates(): Promise<ClientDuplicateMergeResult> {
  const [sheet, company] = await Promise.all([
    fetchPublishedClientSheet(),
    prisma.company.findFirst({
      where: { slug: COMPANY_SLUG, deletedAt: null },
      select: {
        clients: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            color: true,
            avatarUrl: true,
            description: true,
            whatsappGroupId: true,
            _count: { select: { projects: true, tasks: true, bookingMagicLinks: true } },
          },
        },
      },
    }),
  ]);
  if (!company) throw new Error(`Empresa ${COMPANY_SLUG} não encontrada.`);

  const activeRows = sheet.rows.filter((row) => row.status === "active");
  const canonicalByGroup = new Map(
    company.clients
      .filter((client) => client.whatsappGroupId)
      .map((client) => [client.whatsappGroupId!, client]),
  );
  const activeGroups = new Set(activeRows.map((row) => row.whatsappGroupId));
  const mergeGroups = new Map<string, { canonical: typeof company.clients[number]; duplicates: typeof company.clients }>();
  const ambiguous: ClientDuplicateAudit["ambiguous"] = [];

  for (const client of company.clients) {
    if (client.whatsappGroupId && activeGroups.has(client.whatsappGroupId)) continue;
    const targets = activeRows.filter((row) => isSafeClientNameVariant(client.name, row.clientName));
    if (targets.length !== 1) {
      if (targets.length > 1) {
        ambiguous.push({ clientName: client.name, possibleTargets: targets.map((row) => row.clientName) });
      }
      continue;
    }
    const canonical = canonicalByGroup.get(targets[0].whatsappGroupId);
    if (!canonical || canonical.id === client.id) continue;
    const group = mergeGroups.get(canonical.id) ?? { canonical, duplicates: [] };
    group.duplicates.push(client);
    mergeGroups.set(canonical.id, group);
  }

  const totals: ClientDuplicateMergeResult = {
    merged: 0,
    canonicalClients: mergeGroups.size,
    transferredProjects: 0,
    transferredTasks: 0,
    transferredBookingLinks: 0,
    ambiguous,
  };

  await prisma.$transaction(async (tx) => {
    for (const { canonical, duplicates } of mergeGroups.values()) {
      const duplicateIds = duplicates.map((client) => client.id);
      const all = [canonical, ...duplicates];
      const firstValue = <K extends "email" | "phone" | "color" | "avatarUrl" | "description">(key: K) =>
        all.find((client) => client[key])?.[key] ?? null;

      totals.merged += duplicates.length;
      totals.transferredProjects += duplicates.reduce((sum, client) => sum + client._count.projects, 0);
      totals.transferredTasks += duplicates.reduce((sum, client) => sum + client._count.tasks, 0);
      totals.transferredBookingLinks += duplicates.reduce((sum, client) => sum + client._count.bookingMagicLinks, 0);

      await tx.project.updateMany({ where: { clientId: { in: duplicateIds } }, data: { clientId: canonical.id } });
      await tx.task.updateMany({ where: { clientId: { in: duplicateIds } }, data: { clientId: canonical.id } });
      await tx.bookingMagicLink.updateMany({ where: { clientId: { in: duplicateIds } }, data: { clientId: canonical.id } });
      await tx.client.update({
        where: { id: canonical.id },
        data: {
          email: firstValue("email"),
          phone: firstValue("phone"),
          color: firstValue("color"),
          avatarUrl: firstValue("avatarUrl"),
          description: firstValue("description"),
        },
      });
      await tx.client.deleteMany({ where: { id: { in: duplicateIds } } });
    }
  }, { timeout: 60_000 });

  return totals;
}

export async function syncClientsFromPublishedSheet({
  dryRun = false,
}: { dryRun?: boolean } = {}): Promise<ClientSheetSyncResult> {
  const parsed = await fetchPublishedClientSheet();
  const company = await prisma.company.findFirst({
    where: { slug: COMPANY_SLUG, deletedAt: null },
    select: {
      id: true,
      users: {
        where: { isActive: true, deletedAt: null },
        select: { id: true, name: true },
      },
      clients: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          color: true,
          avatarUrl: true,
          description: true,
          managerId: true,
          meetingPlan: true,
          sourceGroupId: true,
          whatsappGroupId: true,
          whatsappGroupName: true,
          externalId: true,
          createdAt: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!company) throw new Error(`Empresa ${COMPANY_SLUG} não encontrada.`);

  const clientsByGroup = new Map<string, typeof company.clients>();
  const clientsBySourceGroup = new Map<string, typeof company.clients>();
  const clientsByName = new Map<string, typeof company.clients>();
  for (const client of company.clients) {
    if (client.whatsappGroupId) {
      clientsByGroup.set(client.whatsappGroupId, [
        ...(clientsByGroup.get(client.whatsappGroupId) ?? []),
        client,
      ]);
    }
    if (client.sourceGroupId) {
      clientsBySourceGroup.set(client.sourceGroupId, [
        ...(clientsBySourceGroup.get(client.sourceGroupId) ?? []),
        client,
      ]);
    }
    const nameKey = normalize(client.name);
    clientsByName.set(nameKey, [...(clientsByName.get(nameKey) ?? []), client]);
  }

  const sourceNameCounts = new Map<string, number>();
  const sourceGroupCounts = new Map<string, number>();
  for (const row of parsed.rows) {
    const nameKey = normalize(row.clientName);
    sourceNameCounts.set(nameKey, (sourceNameCounts.get(nameKey) ?? 0) + 1);
    if (row.whatsappGroupId) {
      sourceGroupCounts.set(row.whatsappGroupId, (sourceGroupCounts.get(row.whatsappGroupId) ?? 0) + 1);
    }
  }

  const result: ClientSheetSyncResult = {
    rows: parsed.sourceRows,
    created: 0,
    updated: 0,
    archived: 0,
    deduplicated: 0,
    unchanged: 0,
    skipped: parsed.issues.length,
    issues: parsed.issues.slice(0, 50),
  };

  const reportedDuplicateSourceGroups = new Set<string>();

  for (const row of parsed.rows) {
    if (row.whatsappGroupId && (sourceGroupCounts.get(row.whatsappGroupId) ?? 0) > 1) {
      result.skipped += 1;
      if (!reportedDuplicateSourceGroups.has(row.whatsappGroupId)) {
        reportedDuplicateSourceGroups.add(row.whatsappGroupId);
        result.issues.push(`ID UAZAPI ${row.whatsappGroupId} duplicado na planilha; linhas ignoradas.`);
      }
      continue;
    }

    const nameKey = normalize(row.clientName);
    const groupMatches = row.whatsappGroupId ? clientsByGroup.get(row.whatsappGroupId) ?? [] : [];
    const sourceGroupMatches = row.sourceGroupId ? clientsBySourceGroup.get(row.sourceGroupId) ?? [] : [];
    const nameMatches = sourceNameCounts.get(nameKey) === 1
      ? clientsByName.get(nameKey) ?? []
      : [];
    const candidates = [...new Map(
      [...groupMatches, ...sourceGroupMatches, ...nameMatches].map((client) => [client.id, client]),
    ).values()].sort((a, b) => {
      const score = (client: typeof a) =>
        (client.deletedAt ? 0 : 16)
        + (row.whatsappGroupId && client.whatsappGroupId === row.whatsappGroupId ? 8 : 0)
        + (row.sourceGroupId && client.sourceGroupId === row.sourceGroupId ? 8 : 0)
        + (client.managerId ? 4 : 0)
        + (client.meetingPlan ? 2 : 0)
        + (client.whatsappGroupName ? 1 : 0);
      return score(b) - score(a) || a.createdAt.getTime() - b.createdAt.getTime();
    });

    const existing = candidates[0];
    const duplicates = candidates.slice(1);
    if (existing && duplicates.length > 0) {
      const duplicateIds = duplicates.map((client) => client.id);
      const firstValue = <K extends "email" | "phone" | "color" | "avatarUrl" | "description">(key: K) =>
        candidates.find((client) => client[key])?.[key] ?? null;

      if (!dryRun) {
        await prisma.$transaction([
          prisma.project.updateMany({
            where: { clientId: { in: duplicateIds } },
            data: { clientId: existing.id },
          }),
          prisma.task.updateMany({
            where: { clientId: { in: duplicateIds } },
            data: { clientId: existing.id },
          }),
          prisma.bookingMagicLink.updateMany({
            where: { clientId: { in: duplicateIds } },
            data: { clientId: existing.id },
          }),
          prisma.client.update({
            where: { id: existing.id },
            data: {
              email: firstValue("email"),
              phone: firstValue("phone"),
              color: firstValue("color"),
              avatarUrl: firstValue("avatarUrl"),
              description: firstValue("description"),
            },
          }),
          prisma.client.deleteMany({ where: { id: { in: duplicateIds } } }),
        ]);
      }

      result.deduplicated += duplicates.length;
      if (row.whatsappGroupId) clientsByGroup.set(row.whatsappGroupId, [existing]);
      if (row.sourceGroupId) clientsBySourceGroup.set(row.sourceGroupId, [existing]);
      clientsByName.set(nameKey, [existing]);
    }

    if (row.status === "inactive") {
      if (!existing || existing.deletedAt) {
        result.unchanged += 1;
        continue;
      }
      if (!dryRun) {
        await prisma.client.update({
          where: { id: existing.id },
          data: { deletedAt: new Date() },
        });
      }
      result.archived += 1;
      continue;
    }

    const manager = resolveManager(company.users, row.managerName, row.clientName);
    if (!manager && row.managerName) {
      result.issues.push(`Linha ${row.rowNumber}: gestor "${row.managerName}" não encontrado; cliente cadastrado sem gestor.`);
    }

    if (!row.plan && !existing) {
      result.skipped += 1;
      result.issues.push(`Linha ${row.rowNumber}: plano ausente para novo cliente.`);
      continue;
    }

    const data = {
      name: row.clientName,
      managerId: manager?.id ?? existing?.managerId ?? null,
      meetingPlan: row.plan || existing?.meetingPlan || null,
      sourceGroupId: row.sourceGroupId || null,
      whatsappGroupId: GROUP_ID_PATTERN.test(row.whatsappGroupId) ? row.whatsappGroupId : null,
      whatsappGroupName: row.groupName,
      // Célula vazia não apaga o que já existe: duas linhas ativas da planilha
      // estão em branco, e perder o id cadastrado seria pior que mantê-lo.
      externalId: row.externalId || existing?.externalId || null,
      deletedAt: null,
    };

    if (!existing) {
      if (!dryRun) {
        const created = await prisma.client.create({
          data: {
            companyId: company.id,
            color: pickColor(row.clientName),
            ...data,
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            color: true,
            avatarUrl: true,
            description: true,
            managerId: true,
            meetingPlan: true,
            sourceGroupId: true,
            whatsappGroupId: true,
            whatsappGroupName: true,
            externalId: true,
            createdAt: true,
            deletedAt: true,
          },
        });
        if (row.whatsappGroupId) clientsByGroup.set(row.whatsappGroupId, [created]);
        if (row.sourceGroupId) clientsBySourceGroup.set(row.sourceGroupId, [created]);
      }
      result.created += 1;
      continue;
    }

    const changed = existing.name !== data.name
      || existing.managerId !== data.managerId
      || existing.meetingPlan !== data.meetingPlan
      || existing.sourceGroupId !== data.sourceGroupId
      || existing.whatsappGroupId !== data.whatsappGroupId
      || existing.whatsappGroupName !== data.whatsappGroupName
      || existing.externalId !== data.externalId
      || existing.deletedAt !== null;
    if (!changed) {
      result.unchanged += 1;
      continue;
    }

    if (!dryRun) {
      await prisma.client.update({ where: { id: existing.id }, data });
      if (row.whatsappGroupId) clientsByGroup.set(row.whatsappGroupId, [{ ...existing, ...data }]);
      if (row.sourceGroupId) clientsBySourceGroup.set(row.sourceGroupId, [{ ...existing, ...data }]);
    }
    result.updated += 1;
  }

  result.issues = result.issues.slice(0, 50);
  return result;
}
