import { listAllCalendarSummaries } from "@/lib/google-calendar";

/**
 * Mapeia plano (vindo do banco externo, campo `plano`) → nome do Google Calendar.
 *
 * O mapeamento NÃO é normalizável por string ("Low-Ticket" ≠ "LT", "3 FASES" → F1),
 * então é uma tabela explícita. Regra do negócio:
 * - "tudo abaixo do funil entra no F1" → fases (1/3) vão pro calendar F1
 * - "16 FASES" é grupo de teste → sem mapeamento (cai no primary "Clientes")
 *
 * Chave = plano normalizado (sem acento, lowercase, espaços colapsados).
 */
const PLAN_TO_CALENDAR_SUMMARY: Record<string, string> = {
  "low-ticket": "Clientes - LT",
  "funil": "Clientes - FUNIL",
  "1 fase": "Clientes - F1",
  "3 fases": "Clientes - F1",
  "premium": "Clientes - Premium",
};

/**
 * Planos cujo calendar é compartilhado por um especialista (além do gestor).
 * Pra esses, ao marcar reunião o sistema bloqueia horários já ocupados na
 * agenda DO PLANO — mesmo se for cliente de outro gestor — pra não estourar
 * o especialista (não pode atender 2 ao mesmo tempo).
 */
const SHARED_SPECIALIST_PLANS = new Set<string>(["low-ticket", "premium"]);

function normPlan(plan: string): string {
  return plan
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function planUsesSharedCalendar(plan: string | null | undefined): boolean {
  if (!plan) return false;
  return SHARED_SPECIALIST_PLANS.has(normPlan(plan));
}

// Cache module-level das agendas (raramente mudam). Evita chamar calendarList
// a cada booking/slot numa lambda quente. Cold start re-popula.
let _summariesCache: { id: string; summary: string }[] | null = null;

async function getSummaries(): Promise<{ id: string; summary: string }[]> {
  if (_summariesCache) return _summariesCache;
  const s = await listAllCalendarSummaries();
  if (s) _summariesCache = s;
  return s ?? [];
}

/**
 * Resolve o Google Calendar ID pro plano. Retorna undefined quando não há
 * agenda específica (cai no calendar primary "Clientes").
 *
 * Ordem:
 * 1. Tabela de alias (Low-Ticket → "Clientes - LT", etc)
 * 2. Match exato "Clientes - <PLANO>" contra agendas live
 */
export async function resolvePlanCalendarId(
  plan: string | null | undefined,
): Promise<string | undefined> {
  if (!plan) return undefined;
  const np = normPlan(plan);
  const summaries = await getSummaries();

  const targetSummary = PLAN_TO_CALENDAR_SUMMARY[np];
  if (targetSummary) {
    const target = normPlan(targetSummary);
    const match = summaries.find((s) => normPlan(s.summary) === target);
    return match?.id;
  }

  // Fallback: agenda nomeada exatamente "Clientes - <PLANO>"
  const want = `clientes - ${np}`;
  const match = summaries.find((s) => normPlan(s.summary) === want);
  return match?.id;
}
