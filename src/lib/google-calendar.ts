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
}: {
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
  ownerName: string;
}): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const res = await client.calendar.events.insert({
      calendarId: client.calendarId,
      requestBody: {
        summary: `Reunião — ${ownerName}`,
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
