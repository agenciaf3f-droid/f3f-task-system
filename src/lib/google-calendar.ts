import { google } from "googleapis";

const TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE ?? "America/Sao_Paulo";

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
  startTime,
  endTime,
  ownerName,
  clientName,
  clientGroupId,
  calendarId: customCalendarId,
}: {
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
  ownerName: string;
  clientName?: string;
  clientGroupId?: string;
  calendarId?: string;
}): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const summary = clientName ? `${clientName} — ${startTime}` : `Reunião — ${ownerName}`;
    const description = clientGroupId || undefined;
    const targetCalendarId = customCalendarId || client.calendarId;

    const res = await client.calendar.events.insert({
      calendarId: targetCalendarId,
      requestBody: {
        summary,
        description,
        start: { dateTime: `${date}T${startTime}:00`, timeZone: TIMEZONE },
        end:   { dateTime: `${date}T${endTime}:00`,   timeZone: TIMEZONE },
        colorId: "7", // Peacock (azul)
      },
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error("[GCal] Erro ao criar evento:", err);
    return null;
  }
}

export async function deleteCalendarMeeting(googleEventId: string): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    await client.calendar.events.delete({
      calendarId: client.calendarId,
      eventId: googleEventId,
    });
  } catch (err) {
    console.error("[GCal] Erro ao deletar evento:", err);
  }
}

export type RawCalendarEvent = {
  id: string;
  status: string;                  // "confirmed" | "cancelled" | "tentative"
  summary: string;
  description?: string;
  date: string;                    // "YYYY-MM-DD"
  startTime: string;               // "HH:MM"
  endTime: string;                 // "HH:MM"
  isAllDay: boolean;
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

          out.push({
            id: ev.id,
            status: ev.status ?? "confirmed",
            summary: ev.summary ?? "",
            description: ev.description ?? undefined,
            date: startParts.date,
            startTime: startParts.time,
            endTime: endParts.time,
            isAllDay,
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
