import { prisma } from "@/lib/prisma";
import { listCalendarEvents, type RawCalendarEvent } from "@/lib/google-calendar";
import { todayInBrazil } from "@/lib/meeting-recurrence";

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
};

const DEFAULT_USER_SLUG = process.env.SYNC_DEFAULT_USER_SLUG ?? "admin";

// Janela de sync: 7 dias atrás até 12 meses à frente.
const SYNC_WINDOW_PAST_DAYS = 7;
const SYNC_WINDOW_FUTURE_MONTHS = 12;

export async function syncCalendarToSystem(): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, cancelled: 0, skipped: 0, errors: [] };

  // 1. Achar user default
  const user = await prisma.user.findFirst({
    where: { calendarSlug: DEFAULT_USER_SLUG, isActive: true },
    select: { id: true },
  });
  if (!user) {
    result.errors.push(`User default não encontrado (calendarSlug="${DEFAULT_USER_SLUG}")`);
    return result;
  }

  // 2. Fetch eventos do Google
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - SYNC_WINDOW_PAST_DAYS);
  const timeMax = new Date(now);
  timeMax.setMonth(timeMax.getMonth() + SYNC_WINDOW_FUTURE_MONTHS);

  const events = await listCalendarEvents({ timeMin, timeMax });
  if (events === null) {
    result.errors.push("Falha ao buscar eventos do Google Calendar");
    return result;
  }

  const today = todayInBrazil();

  for (const ev of events) {
    try {
      // Ignorar all-day e eventos passados
      if (ev.isAllDay) {
        result.skipped++;
        continue;
      }
      if (ev.date < today) {
        result.skipped++;
        continue;
      }

      const existing = await prisma.meeting.findFirst({
        where: { googleEventId: ev.id },
        select: { id: true, status: true, date: true, startTime: true, endTime: true, clientName: true, clientGroupId: true },
      });

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

      const parsed = parseEventSummary(ev);

      if (existing) {
        // Detectar mudanças
        const changed =
          existing.date !== ev.date ||
          existing.startTime !== ev.startTime ||
          existing.endTime !== ev.endTime ||
          existing.clientName !== parsed.clientName ||
          existing.clientGroupId !== parsed.clientGroupId ||
          existing.status !== "confirmed";

        if (changed) {
          // Verifica conflito de slot (outra Meeting nesse slot)
          if (
            existing.date !== ev.date ||
            existing.startTime !== ev.startTime
          ) {
            const conflict = await prisma.meeting.findFirst({
              where: {
                userId: user.id,
                date: ev.date,
                startTime: ev.startTime,
                status: "confirmed",
                NOT: { id: existing.id },
              },
              select: { id: true },
            });
            if (conflict) {
              result.errors.push(`Conflito ao mover evento ${ev.id} pra ${ev.date} ${ev.startTime}`);
              result.skipped++;
              continue;
            }
          }
          await prisma.meeting.update({
            where: { id: existing.id },
            data: {
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
            userId: user.id,
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
        // Provavelmente unique constraint [userId, date, startTime] — já tem outra reunião nesse slot
        result.errors.push(`Conflito ao criar Meeting pra evento ${ev.id} (${ev.date} ${ev.startTime})`);
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
