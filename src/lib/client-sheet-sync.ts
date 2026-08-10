import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pickColor } from "@/lib/color";

const COMPANY_SLUG = "agencia-f3f";
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTK9DhrWACjloFOoAUsC26xHmJLgnpDXnjvN4IzROtUC4WTx-64d4wM661AtlgPJkbt_jOXQsxrCfDk/pub?output=csv";
const GROUP_ID_PATTERN = /^\d+@g\.us$/;
const MANAGER_ALIASES: Record<string, string> = {
  rafhael: "rafinha",
  raphael: "rafinha",
};

type SheetClient = {
  groupName: string;
  clientName: string;
  managerName: string;
  status: "active" | "inactive";
  whatsappGroupId: string;
  plan: string;
  rowNumber: number;
};

export type ClientSheetSyncResult = {
  rows: number;
  created: number;
  updated: number;
  archived: number;
  unchanged: number;
  skipped: number;
  issues: string[];
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractClientName(groupName: string, plan: string): string {
  let name = clean(groupName)
    .replace(/\(fechado\)/gi, "")
    .replace(/^\s*f3f\s*-\s*/i, "")
    .trim();

  const cleanedPlan = clean(plan);
  if (cleanedPlan) {
    name = name.replace(
      new RegExp(`\\s*-\\s*${escapeRegExp(cleanedPlan)}\\s*$`, "i"),
      "",
    );
  }

  return clean(name) || clean(groupName);
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
  const required = ["grupo", "gestor responsavel", "status", "id grupo (uazapi)", "plano"];
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

    const plan = valueAt(sourceRow, "plano");
    const whatsappGroupId = valueAt(sourceRow, "id grupo (uazapi)");
    const managerName = valueAt(sourceRow, "gestor responsavel");
    const status = rawStatus === "ativo" ? "active" : "inactive";
    const clientName = extractClientName(groupName, plan);

    if (!GROUP_ID_PATTERN.test(whatsappGroupId)) {
      issues.push(`Linha ${rowNumber}: ID UAZAPI ausente ou inválido.`);
      return;
    }
    if (status === "active" && !plan) {
      issues.push(`Linha ${rowNumber}: plano ausente.`);
      return;
    }
    if (status === "active" && !managerName) {
      issues.push(`Linha ${rowNumber}: gestor ausente.`);
      return;
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
      whatsappGroupId,
      plan,
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

export function resolveManager(users: Manager[], sheetName: string): Manager | null {
  const byName = uniqueManagerMap(users, (user) => normalize(user.name));
  const byFirstName = uniqueManagerMap(users, (user) => normalize(user.name).split(" ")[0]);
  const normalizedName = normalize(sheetName);
  const alias = MANAGER_ALIASES[normalizedName];
  return byName.get(normalizedName)
    ?? byFirstName.get(normalizedName)
    ?? (alias ? byName.get(alias) ?? byFirstName.get(alias) : null)
    ?? null;
}

export async function syncClientsFromPublishedSheet({
  dryRun = false,
}: { dryRun?: boolean } = {}): Promise<ClientSheetSyncResult> {
  const response = await fetch(`${SHEET_CSV_URL}&_=${Date.now()}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Planilha respondeu HTTP ${response.status}.`);

  const csv = await response.text();
  if (csv.length > 5_000_000) throw new Error("Planilha excede o limite de 5 MB.");
  const parsed = parseClientSheet(csv);
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
          managerId: true,
          meetingPlan: true,
          whatsappGroupId: true,
          whatsappGroupName: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!company) throw new Error(`Empresa ${COMPANY_SLUG} não encontrada.`);

  const clientsByGroup = new Map<string, typeof company.clients>();
  const clientsByName = new Map<string, typeof company.clients>();
  for (const client of company.clients) {
    if (client.whatsappGroupId) {
      clientsByGroup.set(client.whatsappGroupId, [
        ...(clientsByGroup.get(client.whatsappGroupId) ?? []),
        client,
      ]);
    }
    const nameKey = normalize(client.name);
    clientsByName.set(nameKey, [...(clientsByName.get(nameKey) ?? []), client]);
  }

  const sourceNameCounts = new Map<string, number>();
  for (const row of parsed.rows) {
    const nameKey = normalize(row.clientName);
    sourceNameCounts.set(nameKey, (sourceNameCounts.get(nameKey) ?? 0) + 1);
  }

  const result: ClientSheetSyncResult = {
    rows: parsed.sourceRows,
    created: 0,
    updated: 0,
    archived: 0,
    unchanged: 0,
    skipped: parsed.issues.length,
    issues: parsed.issues.slice(0, 50),
  };

  for (const row of parsed.rows) {
    const groupMatches = clientsByGroup.get(row.whatsappGroupId) ?? [];
    if (groupMatches.length > 1) {
      result.skipped += 1;
      result.issues.push(`Linha ${row.rowNumber}: ID UAZAPI duplicado no sistema.`);
      continue;
    }

    let existing = groupMatches[0];
    const nameKey = normalize(row.clientName);
    if (!existing && sourceNameCounts.get(nameKey) === 1) {
      const nameMatches = (clientsByName.get(nameKey) ?? [])
        .filter((client) => !client.whatsappGroupId);
      if (nameMatches.length === 1) existing = nameMatches[0];
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

    const manager = resolveManager(company.users, row.managerName);
    if (!manager) {
      result.skipped += 1;
      result.issues.push(`Linha ${row.rowNumber}: gestor "${row.managerName}" não encontrado.`);
      continue;
    }

    const data = {
      name: row.clientName,
      managerId: manager.id,
      meetingPlan: row.plan,
      whatsappGroupId: row.whatsappGroupId,
      whatsappGroupName: row.groupName,
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
            managerId: true,
            meetingPlan: true,
            whatsappGroupId: true,
            whatsappGroupName: true,
            deletedAt: true,
          },
        });
        clientsByGroup.set(row.whatsappGroupId, [created]);
      }
      result.created += 1;
      continue;
    }

    const changed = existing.name !== data.name
      || existing.managerId !== data.managerId
      || existing.meetingPlan !== data.meetingPlan
      || existing.whatsappGroupId !== data.whatsappGroupId
      || existing.whatsappGroupName !== data.whatsappGroupName
      || existing.deletedAt !== null;
    if (!changed) {
      result.unchanged += 1;
      continue;
    }

    if (!dryRun) {
      await prisma.client.update({ where: { id: existing.id }, data });
      clientsByGroup.set(row.whatsappGroupId, [{ ...existing, ...data }]);
    }
    result.updated += 1;
  }

  result.issues = result.issues.slice(0, 50);
  return result;
}
