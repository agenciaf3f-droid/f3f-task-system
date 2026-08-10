import { endOfDay, startOfDay, startOfMonth, subDays } from "date-fns";

export const REPORT_PERIODS = ["today", "yesterday", "last7", "month"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export function parseReportPeriod(value: string | undefined): ReportPeriod {
  return REPORT_PERIODS.includes(value as ReportPeriod) ? value as ReportPeriod : "month";
}

export function getReportPeriodRange(period: ReportPeriod, now: Date) {
  const end = endOfDay(now);
  switch (period) {
    case "today":
      return { start: startOfDay(now), end, label: "Hoje" };
    case "yesterday": {
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday), label: "Ontem" };
    }
    case "last7":
      return { start: startOfDay(subDays(now, 6)), end, label: "Últimos 7 dias" };
    default:
      return { start: startOfMonth(now), end, label: "Este mês" };
  }
}
