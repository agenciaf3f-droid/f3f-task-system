/**
 * Regras por plano do cliente.
 *
 * Duração:
 *   - "1 FASE" (e variações como "1 FASE GLOBAL") → 30 min
 *   - Demais planos                                → 60 min
 *
 * Recorrência padrão:
 *   - "Premium" → semanal
 *   - Demais    → mensal (Nª <weekday> do mês)
 */

export type Recurrence = "weekly" | "monthly";

function normalize(plan: string | null | undefined): string {
  return (plan ?? "").trim().toUpperCase();
}

export function getMeetingDurationMinutes(plan: string | null | undefined): number {
  const n = normalize(plan);
  // Match "1 FASE" no início (com palavra completa), aceita variações como "1 FASE GLOBAL".
  // NÃO casa "16 FASES", "1 FASES" extra etc.
  if (/^1\s+FASE\b/.test(n) || /^FASE\s+1\b/.test(n)) return 30;
  return 60;
}

export function getMeetingRecurrence(plan: string | null | undefined): Recurrence {
  return normalize(plan) === "PREMIUM" ? "weekly" : "monthly";
}

/** Antecedência mínima entre "agora" e o início da reunião (em minutos). */
export const MIN_ADVANCE_MINUTES = 60;

/** Quantidade default de ocorrências geradas por série. */
export const RECURRING_INSTANCES_AHEAD = 12;
