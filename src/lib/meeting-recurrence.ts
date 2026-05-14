/**
 * Recorrência de reuniões: "toda Nª <weekday> do mês".
 *
 * Ex: "toda 2ª terça do mês" → weekOfMonth=2, dayOfWeek=2.
 * Se um mês não tiver essa Nª ocorrência (ex: 5ª terça em fevereiro), pula.
 */

export type MonthlyNthWeekdayRule = {
  type: "monthly_nth_weekday";
  weekOfMonth: number; // 1..5
  dayOfWeek: number;   // 0=Dom..6=Sáb
};

export type WeeklyRule = {
  type: "weekly";
  dayOfWeek: number; // 0=Dom..6=Sáb
};

export type RecurrenceRule = MonthlyNthWeekdayRule | WeeklyRule;

export function getWeekOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

/**
 * Retorna a data (YYYY-MM-DD) da N-ésima ocorrência do dayOfWeek no mês,
 * ou null se não existir.
 */
export function getNthWeekdayOfMonth(
  year: number,
  month: number, // 0-indexed
  weekOfMonth: number,
  dayOfWeek: number,
): string | null {
  const firstOfMonth = new Date(year, month, 1);
  const firstDow = firstOfMonth.getDay();
  const offset = (dayOfWeek - firstDow + 7) % 7;
  const day = 1 + offset + (weekOfMonth - 1) * 7;

  const lastDay = new Date(year, month + 1, 0).getDate();
  if (day > lastDay) return null;

  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Gera próximas `count` ocorrências mensais a partir de `fromDate` (inclusive).
 */
export function generateMonthlyOccurrences(
  fromDate: string, // "YYYY-MM-DD"
  rule: MonthlyNthWeekdayRule,
  count: number,
): string[] {
  const [y, m] = fromDate.split("-").map(Number);
  const dates: string[] = [];
  let year = y;
  let month = m - 1;

  while (dates.length < count) {
    const occurrence = getNthWeekdayOfMonth(year, month, rule.weekOfMonth, rule.dayOfWeek);
    if (occurrence && occurrence >= fromDate) {
      dates.push(occurrence);
    }
    month += 1;
    if (month > 11) { month = 0; year += 1; }
    // Safety: cap at 60 iterations to prevent runaway loops on bad input.
    if (year > y + 5) break;
  }

  return dates;
}

const WEEK_LABELS = ["1ª", "2ª", "3ª", "4ª", "5ª"];
const DAY_LABELS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function describeRule(rule: RecurrenceRule): string {
  if (rule.type === "weekly") {
    return `Toda ${DAY_LABELS[rule.dayOfWeek]}`;
  }
  return `Toda ${WEEK_LABELS[rule.weekOfMonth - 1]} ${DAY_LABELS[rule.dayOfWeek]} do mês`;
}

/**
 * Gera próximas `count` ocorrências semanais a partir de `fromDate` (inclusive),
 * respeitando o `dayOfWeek` da rule. Se `fromDate` cai em outro dia da semana,
 * primeira ocorrência será a próxima data válida.
 */
export function generateWeeklyOccurrences(
  fromDate: string,
  rule: WeeklyRule,
  count: number,
): string[] {
  const [y, m, d] = fromDate.split("-").map(Number);
  let cursor = new Date(Date.UTC(y, m - 1, d));
  // Avança até o dayOfWeek correto (UTC para evitar TZ shenanigans).
  while (cursor.getUTCDay() !== rule.dayOfWeek) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const yy = cursor.getUTCFullYear();
    const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(cursor.getUTCDate()).padStart(2, "0");
    dates.push(`${yy}-${mm}-${dd}`);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return dates;
}

// ─── TZ helpers (hardcoded America/Sao_Paulo) ──────────────────────────────

const BR_TZ = "America/Sao_Paulo";

/** Retorna data atual em SP no formato YYYY-MM-DD. */
export function todayInBrazil(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Retorna ano e mês (0-indexed) atuais em SP. */
export function currentYearMonthInBrazil(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value) - 1;
  return { year, month };
}

/** Retorna { date: YYYY-MM-DD, time: HH:MM } da hora atual em SP. */
export function nowInBrazil(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** True se dateStr (YYYY-MM-DD) é antes de hoje em SP. */
export function isPastDate(dateStr: string): boolean {
  return dateStr < todayInBrazil();
}
