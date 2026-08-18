import { google } from "googleapis";

const TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE ?? "America/Sao_Paulo";

/**
 * Normaliza o group id pra descrição do evento no formato `<digits>-group`.
 * Aceita `...@g.us`, `...-group` e lixo `Group ID: ...` — extrai os dígitos
 * e devolve sempre `<digits>-group`. Sem dígitos → devolve o valor cru.
 */
function toGroupIdDescription(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.match(/\d+/)?.[0];
  return digits ? `${digits}-group` : raw;
}

type CalendarClient = {
  calendar: ReturnType<typeof google.calendar>;
  calendarId: string;
};

function getClient(): CalendarClient | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

  if (!clientId || !clientSecret || !refreshToken) return null;

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  return { calendar: google.calendar({ version: "v3", auth }), calendarId };
}

export async function createCalendarMeeting({
  date,
  endDate = date,
  startTime,
  endTime,
  isAllDay = false,
  ownerName,
  clientName,
  clientGroupId,
  attendeeEmails = [],
  calendarId: customCalendarId,
}: {
  date: string;       // "YYYY-MM-DD"
  endDate?: string;   // "YYYY-MM-DD" (inclusiva)
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
  isAllDay?: boolean;
  ownerName: string;
  clientName?: string;
  clientGroupId?: string;
  attendeeEmails?: string[];
  calendarId?: string;
}): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const summary = clientName
      ? `${clientName}${isAllDay ? "" : ` — ${startTime}`}`
      : `Reunião — ${ownerName}`;
    const description = toGroupIdDescription(clientGroupId);
    const targetCalendarId = customCalendarId || client.calendarId;
    const normalizedAttendees = [...new Set(attendeeEmails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    const start = isAllDay
      ? { date }
      : { dateTime: `${date}T${startTime}:00`, timeZone: TIMEZONE };
    // Em eventos de dia inteiro, o Google usa data final exclusiva.
    const end = isAllDay
      ? { date: addDays(endDate, 1) }
      : { dateTime: `${endDate}T${endTime}:00`, timeZone: TIMEZONE };

    const res = await client.calendar.events.insert({
      calendarId: targetCalendarId,
      sendUpdates: normalizedAttendees.length > 0 ? "all" : "none",
      requestBody: {
        summary,
        description,
        start,
        end,
        attendees: normalizedAttendees.map((email) => ({ email })),
        colorId: "7", // Peacock (azul)
      },
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error("[GCal] Erro ao criar evento:", err);
    return null;
  }
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

/**
 * Lista todos os calendar IDs da conta OAuth conectada.
 * Filtra a agenda de feriados (não tem reuniões reais).
 */
export async function listAllCalendarIds(): Promise<string[] | null> {
  const summaries = await listAllCalendarSummaries();
  return summaries ? summaries.map((c) => c.id) : null;
}

/**
 * Mesma coisa que listAllCalendarIds() mas com summary — pra UI mostrar nome
 * legível ("Reuniões Arthur") em vez do id criptíco.
 */
export async function listAllCalendarSummaries(): Promise<{ id: string; summary: string }[] | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const res = await client.calendar.calendarList.list({ maxResults: 250 });
    const out: { id: string; summary: string }[] = [];
    for (const c of res.data.items ?? []) {
      if (!c.id) continue;
      if (c.id.endsWith("#holiday@group.v.calendar.google.com")) continue;
      if (c.accessRole === "freeBusyReader") continue;
      out.push({ id: c.id, summary: c.summary ?? c.id });
    }
    out.sort((a, b) => a.summary.localeCompare(b.summary));
    return out;
  } catch (err) {
    console.error("[GCal] Erro ao listar calendars:", err);
    return null;
  }
}

/** Prefixo que marca no título que a reunião foi desmarcada. */
export const CANCELLED_SUMMARY_PREFIX = "(Cancelado)";

/**
 * Marca o evento como cancelado no Google em vez de apagá-lo: prefixa o título
 * e o deixa como "Disponível".
 *
 * O `transparency: "transparent"` é o que impede o efeito colateral — sem ele o
 * evento continuaria ocupando o horário, e ninguém mais conseguiria agendar
 * naquele intervalo. Com ele, o registro fica visível na agenda mas o horário
 * volta a ficar livre.
 */
export async function markCalendarMeetingCancelled(
  googleEventId: string,
  customCalendarId?: string,
): Promise<boolean> {
  const client = getClient();
  if (!client) return true;

  const calendarId = customCalendarId || client.calendarId;

  try {
    const current = await client.calendar.events.get({ calendarId, eventId: googleEventId });
    const summary = current.data.summary ?? "";

    await client.calendar.events.patch({
      calendarId,
      eventId: googleEventId,
      requestBody: {
        // Cancelar duas vezes não deve empilhar prefixo.
        summary: summary.startsWith(CANCELLED_SUMMARY_PREFIX)
          ? summary
          : `${CANCELLED_SUMMARY_PREFIX} ${summary}`.trim(),
        transparency: "transparent",
        colorId: "8", // Grafite — visualmente apagado perto dos ativos.
      },
    });
    return true;
  } catch (err) {
    const status = (err as { code?: number; response?: { status?: number } }).code
      ?? (err as { response?: { status?: number } }).response?.status;
    if (status === 404 || status === 410) return true;
    console.error("[GCal] Erro ao marcar evento como cancelado:", err);
    return false;
  }
}

export async function deleteCalendarMeeting(
  googleEventId: string,
  customCalendarId?: string,
): Promise<boolean> {
  const client = getClient();
  if (!client) return true;

  try {
    await client.calendar.events.delete({
      calendarId: customCalendarId || client.calendarId,
      eventId: googleEventId,
    });
    return true;
  } catch (err) {
    const status = (err as { code?: number; response?: { status?: number } }).code
      ?? (err as { response?: { status?: number } }).response?.status;
    if (status === 404 || status === 410) return true;
    console.error("[GCal] Erro ao deletar evento:", err);
    return false;
  }
}

export type RawCalendarEvent = {
  id: string;
  status: string;                  // "confirmed" | "cancelled" | "tentative"
  /** "transparent" = marcado como Disponível no Google → não ocupa o horário. */
  transparency: string;
  summary: string;
  description?: string;
  date: string;                    // "YYYY-MM-DD"
  endDate: string;                 // "YYYY-MM-DD" (inclusiva)
  startTime: string;               // "HH:MM"
  endTime: string;                 // "HH:MM"
  isAllDay: boolean;
  attendeeEmails: string[];
  updatedAt: string;               // ISO
  sourceCalendarId: string;        // debug: qual agenda o evento veio
};

/**
 * Lê eventos do Google Calendar entre `timeMin` e `timeMax`.
 * Expande recorrentes (`singleEvents: true`) e inclui cancelados pra sync.
 * Se `calendarIds` for passado, lê de cada agenda e concatena;
 * erro em uma agenda individual não derruba as outras.
 */
export async function listCalendarEvents({
  timeMin,
  timeMax,
  calendarIds,
}: {
  timeMin: Date;
  timeMax: Date;
  calendarIds?: string[];
}): Promise<RawCalendarEvent[] | null> {
  const client = getClient();
  if (!client) return null;

  const targets = calendarIds && calendarIds.length > 0 ? calendarIds : [client.calendarId];
  const out: RawCalendarEvent[] = [];
  let anySucceeded = false;

  for (const calendarId of targets) {
    let pageToken: string | undefined;
    try {
      do {
        const res = await client.calendar.events.list({
          calendarId,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          showDeleted: true,
          maxResults: 250,
          pageToken,
        });

        for (const ev of res.data.items ?? []) {
          if (!ev.id) continue;
          const startDateTime = ev.start?.dateTime ?? ev.start?.date;
          const endDateTime = ev.end?.dateTime ?? ev.end?.date;
          if (!startDateTime || !endDateTime) continue;

          const isAllDay = !ev.start?.dateTime;
          const startParts = parseEventInstant(startDateTime, isAllDay);
          const endParts = parseEventInstant(endDateTime, isAllDay);
          const inclusiveEndDate = isAllDay ? addDays(endParts.date, -1) : endParts.date;

          out.push({
            id: ev.id,
            status: ev.status ?? "confirmed",
            transparency: ev.transparency ?? "opaque",
            summary: ev.summary ?? "",
            description: ev.description ?? undefined,
            date: startParts.date,
            endDate: inclusiveEndDate,
            startTime: startParts.time,
            endTime: isAllDay ? "23:59" : endParts.time,
            isAllDay,
            attendeeEmails: (ev.attendees ?? [])
              .map((attendee) => attendee.email?.trim().toLowerCase())
              .filter((email): email is string => Boolean(email)),
            updatedAt: ev.updated ?? new Date().toISOString(),
            sourceCalendarId: calendarId,
          });
        }

        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
      anySucceeded = true;
    } catch (err) {
      console.error(`[GCal] Erro ao listar de ${calendarId}:`, err);
    }
  }

  // Falha total (nenhum calendar respondeu) → null preserva sinal antigo pro caller
  if (!anySucceeded) return null;
  return out;
}

function parseEventInstant(value: string, isAllDay: boolean): { date: string; time: string } {
  if (isAllDay) {
    // "YYYY-MM-DD"
    return { date: value, time: "00:00" };
  }
  // RFC3339 dateTime, ex: "2026-05-14T15:30:00-03:00"
  // Convert to America/Sao_Paulo via Intl pra evitar drift de timezone.
  const dt = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(dt);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
