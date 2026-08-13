import { prisma } from "@/lib/prisma";
import { listAllCalendarIds, listCalendarEvents, type RawCalendarEvent } from "@/lib/google-calendar";
import { todayInBrazil } from "@/lib/meeting-recurrence";
import { buildClientManagerIndex, findManagerByClientName } from "@/lib/client-manager-match";
import { Prisma } from "@prisma/client";

/**
 * Sincroniza eventos do Google Calendar → Meeting (Prisma interno).
 *
 * Regras:
 * - Eventos all-day são ignorados (não viram reuniões).
 * - Eventos no passado são ignorados.
 * - Match por `googleEventId`.
 * - Status "cancelled" do Google → Meeting.status = "cancelled".
 * - Eventos novos são atribuídos ao user default (env SYNC_DEFAULT_USER_SLUG, fallback "admin").
 *
 * Retorna estatísticas: { created, updated, cancelled, skipped }.
 */
export type SyncResult = {
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  errors: string[];
  calendarsRead: string[];
};

const DEFAULT_USER_SLUG = process.env.SYNC_DEFAULT_USER_SLUG ?? "admin";

// Janela de sync: 1º dia do mês corrente (Brazil TZ) até 12 meses à frente.
// Eventos recorrentes que se estendem pro futuro já são expandidos pelo Google
// (singleEvents: true) e cabem na janela.
const SYNC_WINDOW_FUTURE_MONTHS = 12;

/**
 * Coleta todos os calendar IDs configurados via env.
 * F3F usa uma agenda por plano (GOOGLE_CALENDAR_ID_INICIANTES, etc) —
 * sync precisa ler todas, não só a default.
 */
function collectCalendarIds(): string[] {
  const ids = new Set<string>();
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (key === "GOOGLE_CALENDAR_ID" || key.startsWith("GOOGLE_CALENDAR_ID_")) {
      ids.add(value);
    }
  }
  return Array.from(ids);
}

export async function syncCalendarToSystem(): Promise<SyncResult> {
  // Prioridade: envs configuradas (override) > auto-discovery de todas as agendas da conta
  let calendarsRead = collectCalendarIds();
  if (calendarsRead.length === 0) {
    const discovered = await listAllCalendarIds();
    calendarsRead = discovered ?? [];
  }
  const result: SyncResult = { created: 0, updated: 0, cancelled: 0, skipped: 0, errors: [], calendarsRead };

  // 1. User default (bucket "admin" — recebe eventos de agendas não-mapeadas;
  //    funcionam como "shared" — bloqueiam slots de todos os gestores)
  const adminUser = await prisma.user.findFirst({
    where: { calendarSlug: DEFAULT_USER_SLUG, isActive: true },
    select: { id: true },
  });
  if (!adminUser) {
    result.errors.push(`User default não encontrado (calendarSlug="${DEFAULT_USER_SLUG}")`);
    return result;
  }

  // Mapa calendarId → userId pros gestores que configuraram a agenda própria
  const mappedUsers = await prisma.user.findMany({
    where: { googleCalendarId: { not: null }, isActive: true },
    select: { id: true, googleCalendarId: true },
  });
  const calendarToUserId = new Map<string, string>();
  for (const u of mappedUsers) {
    if (u.googleCalendarId) calendarToUserId.set(u.googleCalendarId, u.id);
  }

  // Pré-tokeniza lista de clientes pra match por scoring (apelido vs nome completo)
  const clientsWithManager = await prisma.client.findMany({
    where: { deletedAt: null, managerId: { not: null } },
    select: { name: true, managerId: true },
  });
  const clientList = buildClientManagerIndex(clientsWithManager);

  // 2. Fetch eventos do Google — desde o 1º dia do mês corrente (Brazil)
  const monthStr = todayInBrazil().slice(0, 7); // "YYYY-MM"
  const timeMin = new Date(`${monthStr}-01T00:00:00-03:00`);
  const timeMax = new Date(timeMin);
  timeMax.setMonth(timeMax.getMonth() + SYNC_WINDOW_FUTURE_MONTHS);

  const events = await listCalendarEvents({ timeMin, timeMax, calendarIds: calendarsRead });
  if (events === null) {
    result.errors.push("Falha ao buscar eventos do Google Calendar");
    return result;
  }

  // Pre-fetch existing meetings em batch: evita N findFirst (1 por evento)
  const eventIds = events.map((e) => e.id).filter(Boolean);
  const existingMeetings = eventIds.length > 0
    ? await prisma.meeting.findMany({
        where: { googleEventId: { in: eventIds } },
        select: { id: true, status: true, date: true, startTime: true, endTime: true, clientName: true, clientGroupId: true, userId: true, googleEventId: true },
      })
    : [];
  const existingByEventId = new Map<string, typeof existingMeetings[number]>();
  for (const m of existingMeetings) {
    if (m.googleEventId) existingByEventId.set(m.googleEventId, m);
  }

  for (const ev of events) {
    try {
      // Ignorar all-day (recorrentes do Google já vêm expandidos via singleEvents: true)
      if (ev.isAllDay) {
        result.skipped++;
        continue;
      }

      // Atribuição em cascata:
      // 1) Match por Client.name → Client.managerId (automático, prioridade)
      // 2) Mapeamento manual gestor→agenda no /equipe (override)
      // 3) Admin bucket (Daily Agência, Reunião de Gestores, etc) — bloqueia TODOS
      const parsed = parseEventSummary(ev);
      const targetUserId: string =
        findManagerByClientName(parsed.clientName, clientList) ??
        calendarToUserId.get(ev.sourceCalendarId) ??
        adminUser.id;

      const existing = existingByEventId.get(ev.id) ?? null;

      // Cancelado no Google
      if (ev.status === "cancelled") {
        if (existing && existing.status !== "cancelled") {
          await prisma.meeting.update({
            where: { id: existing.id },
            data: { status: "cancelled" },
          });
          result.cancelled++;
        } else {
          result.skipped++;
        }
        continue;
      }


      if (existing) {
        // Detectar mudanças (inclui reatribuição se mapeamento mudou)
        const changed =
          existing.date !== ev.date ||
          existing.startTime !== ev.startTime ||
          existing.endTime !== ev.endTime ||
          existing.clientName !== parsed.clientName ||
          existing.clientGroupId !== parsed.clientGroupId ||
          existing.userId !== targetUserId ||
          existing.status !== "confirmed";

        if (changed) {
          await prisma.meeting.update({
            where: { id: existing.id },
            data: {
              userId: targetUserId,
              date: ev.date,
              startTime: ev.startTime,
              endTime: ev.endTime,
              clientName: parsed.clientName,
              clientGroupId: parsed.clientGroupId,
              status: "confirmed",
            },
          });
          result.updated++;
        } else {
          result.skipped++;
        }
        continue;
      }

      // Criar novo Meeting
      try {
        await prisma.meeting.create({
          data: {
            userId: targetUserId,
            date: ev.date,
            startTime: ev.startTime,
            endTime: ev.endTime,
            status: "confirmed",
            googleEventId: ev.id,
            clientName: parsed.clientName,
            clientGroupId: parsed.clientGroupId,
          },
        });
        result.created++;
      } catch (err) {
        // Outra execução (ou o mesmo evento vindo de uma agenda compartilhada)
        // pode ter ocupado o horário entre a leitura e a criação.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          result.skipped++;
          continue;
        }
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Erro ao criar Meeting pra evento ${ev.id} (${ev.date} ${ev.startTime}): ${msg}`);
        result.skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Evento ${ev.id}: ${msg}`);
    }
  }

  return result;
}

/**
 * Extrai clientName e clientGroupId de um evento do Google.
 * - Summary criado pelo sistema: "Nome do Cliente — HH:MM"
 * - Summary manual: usado integralmente como clientName
 * - Description: usada como clientGroupId (formato atual: só o id puro)
 */
function parseEventSummary(ev: RawCalendarEvent): { clientName: string | null; clientGroupId: string | null } {
  let clientName: string | null = null;
  const summary = ev.summary.trim();
  if (summary) {
    // Tenta separar no padrão " — HH:MM"
    const m = summary.match(/^(.+?)\s+—\s+\d{2}:\d{2}\s*$/);
    clientName = m ? m[1].trim() : summary;
  }
  const clientGroupId = ev.description?.trim() || null;
  return { clientName, clientGroupId };
}
