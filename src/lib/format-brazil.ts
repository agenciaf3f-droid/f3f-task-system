const BR_TZ = "America/Sao_Paulo";

/**
 * Formata um instante no horário de Brasília.
 *
 * `toLocaleString("pt-BR")` sozinho usa o fuso de quem está executando — e no
 * servidor da Vercel isso é UTC. O resultado ficava três horas adiantado em
 * toda data renderizada no servidor.
 */
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BR_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatBrazilDateTime(value: Date | null | undefined): string {
  if (!value) return "—";
  return dateTimeFormatter.format(value);
}

/** "YYYY-MM-DDTHH:MM" de agora em Brasília, para o mínimo do datetime-local. */
export function brazilLocalInputNow(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BR_TZ,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${String(Number(parts.hour) % 24).padStart(2, "0")}:${parts.minute}`;
}
