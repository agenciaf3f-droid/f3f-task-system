const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

const brazilDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BRAZIL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dateKeyInBrazil(date: Date): string {
  return brazilDateFormatter.format(date);
}

export function completedLate(dueDate: Date, completedAt: Date): boolean {
  return dateKeyInBrazil(completedAt) > dateKeyInBrazil(dueDate);
}

export function calendarDaysLate(dueDate: Date, completedAt: Date): number {
  const due = Date.parse(`${dateKeyInBrazil(dueDate)}T00:00:00Z`);
  const completed = Date.parse(`${dateKeyInBrazil(completedAt)}T00:00:00Z`);
  return Math.max(0, Math.round((completed - due) / 86_400_000));
}

export function formatDateInBrazil(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
