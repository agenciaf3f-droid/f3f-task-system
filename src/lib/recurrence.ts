import type { RecurrenceRule } from "@/components/tasks/recurrence-picker";

export function computeNextOccurrence(rule: RecurrenceRule, fromDate: Date): Date {
  const next = new Date(fromDate);
  switch (rule.freq) {
    case "daily":
      next.setDate(next.getDate() + rule.interval);
      break;
    case "weekly":
      next.setDate(next.getDate() + rule.interval * 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + rule.interval);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + rule.interval);
      break;
  }
  return next;
}

export function parseRecurrenceRuleFromDb(raw: unknown): RecurrenceRule | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!["daily", "weekly", "monthly", "yearly"].includes(r.freq as string)) return null;
  if (typeof r.interval !== "number" || r.interval < 1) return null;
  return {
    freq: r.freq as RecurrenceRule["freq"],
    interval: r.interval as number,
    byWeekday: Array.isArray(r.byWeekday) ? (r.byWeekday as number[]) : undefined,
    monthDay: typeof r.monthDay === "number" ? r.monthDay : undefined,
  };
}
