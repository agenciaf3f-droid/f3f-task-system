import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteCalendarMeeting } from "@/lib/google-calendar";
import { resolvePlanCalendarId } from "@/lib/plan-calendar";
import { nowInBrazil } from "@/lib/meeting-recurrence";
import { sendWhatsAppButtons, sendWhatsAppText } from "@/lib/whatsapp";

export const REMINDER_KINDS = ["day_before", "morning", "hour_before", "minutes_before"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Prefixos dos ids de botão que voltam no webhook da UAZAPI. */
export const CONFIRM_BUTTON_PREFIX = "f3f-sim:";
export const DECLINE_BUTTON_PREFIX = "f3f-nao:";

/** Depois de 3 falhas de envio o lembrete é abandonado — não vira spam. */
const MAX_ATTEMPTS = 3;

const WEEKDAYS_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

// ─────────────────────────── tempo (wall-clock BR) ───────────────────────────
// Reunião é gravada como date "YYYY-MM-DD" + startTime "HH:MM" no horário de
// Brasília, e `nowInBrazil()` devolve o agora no mesmo formato. Comparando os
// dois nesse espaço de string não existe conversão de fuso para errar — por
// isso nada aqui usa `new Date()` cru.

function toMinutes(date: string, time: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 60_000) + hour * 60 + minute;
}

function shiftDate(date: string, deltaDays: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return shifted.toISOString().slice(0, 10);
}

function weekdayName(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS_PT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/**
 * Horário do lembrete de véspera. Configurável porque não veio na
 * especificação — 18:00 dá ao gestor a noite e a manhã seguinte para
 * remanejar o horário caso o cliente recuse.
 */
function dayBeforeClock(): string {
  const raw = process.env.MEETING_REMINDER_DAY_BEFORE_HOUR?.trim();
  return raw && /^\d{2}:\d{2}$/.test(raw) ? raw : "18:00";
}

/**
 * Momento-alvo de cada lembrete e a tolerância de atraso aceita.
 *
 * A tolerância existe porque o disparo vem do GitHub Actions, cujo agendamento
 * atrasa com frequência. Passada a janela o lembrete é descartado em vez de
 * chegar fora de hora — um "faltam 5 minutos" entregue depois da reunião é
 * pior que lembrete nenhum.
 */
function targetFor(
  kind: ReminderKind,
  meetingDate: string,
  meetingStart: string,
): { target: number; graceMinutes: number } {
  const start = toMinutes(meetingDate, meetingStart);

  switch (kind) {
    case "day_before":
      return { target: toMinutes(shiftDate(meetingDate, -1), dayBeforeClock()), graceMinutes: 120 };
    case "morning":
      return { target: toMinutes(meetingDate, "06:00"), graceMinutes: 120 };
    case "hour_before":
      return { target: start - 60, graceMinutes: 30 };
    case "minutes_before":
      // Janela de 7 min para um cron de 5 em 5: uma janela de exatos 5 minutos
      // depende de o disparo cair sem atraso nenhum, e o GitHub não garante
      // isso. O limite superior é o início da reunião — nunca depois.
      return { target: start - 7, graceMinutes: 7 };
  }
}

// ──────────────────────────────── mensagens ────────────────────────────────

type MessageContext = { clientName: string; meetingDate: string; startTime: string };

export function buildReminderMessage(kind: ReminderKind, ctx: MessageContext): string {
  switch (kind) {
    case "day_before":
      return [
        `🤖 Opa ${ctx.clientName}!`,
        "",
        `Estou passando para confirmar sua reunião com nossa equipe amanhã ${weekdayName(ctx.meetingDate)} às ${ctx.startTime}`,
        "",
        "Está tudo certo para você participar?👇",
      ].join("\n");

    case "morning":
      return [
        `🤖 Passando para te lembrar o seguinte ${ctx.clientName}👇`,
        "",
        `🗓️ Sua reunião com a F3F é hoje às ${ctx.startTime}`,
      ].join("\n");

    case "hour_before":
      return [
        `🤖 ${ctx.clientName}, tudo bem?`,
        "",
        "*Em menos de 1 hora* iremos te enviar o link da nossa reunião!",
      ].join("\n");

    case "minutes_before":
      return [
        "🤖 Faltam alguns minutos para nossa reunião!",
        "",
        "Iremos te enviar o link aqui mesmo!",
      ].join("\n");
  }
}

// ──────────────────────────────── despacho ────────────────────────────────

type ReminderCandidate = {
  id: string;
  date: string;
  startTime: string;
  clientName: string | null;
  clientGroupId: string | null;
};

export type DispatchSummary = {
  now: { date: string; time: string };
  considered: number;
  sent: number;
  failed: number;
  skipped: Array<{ meetingId: string; kind: ReminderKind; reason: string }>;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Reserva o lembrete antes de enviar. A unique (meetingId, kind) faz duas
 * execuções simultâneas do cron competirem no banco — só uma ganha o direito
 * de mandar a mensagem.
 *
 * Retorna null quando outro processo já mandou (ou já esgotou as tentativas).
 */
async function claim(meetingId: string, kind: ReminderKind): Promise<{ id: string } | null> {
  try {
    return await prisma.meetingReminder.create({
      data: { meetingId, kind, status: "pending", attempts: 1 },
      select: { id: true },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }

  // Já existe linha: só reaproveita se a tentativa anterior falhou de verdade.
  const existing = await prisma.meetingReminder.findUnique({
    where: { meetingId_kind: { meetingId, kind } },
    select: { id: true, status: true, attempts: true },
  });
  if (!existing || existing.status !== "failed" || existing.attempts >= MAX_ATTEMPTS) return null;

  const retried = await prisma.meetingReminder.updateMany({
    where: { id: existing.id, status: "failed" },
    data: { status: "pending", attempts: { increment: 1 } },
  });
  return retried.count === 1 ? { id: existing.id } : null;
}

async function deliver(
  kind: ReminderKind,
  meeting: ReminderCandidate,
  clientName: string,
  groupId: string,
) {
  const message = buildReminderMessage(kind, {
    clientName,
    meetingDate: meeting.date,
    startTime: meeting.startTime,
  });
  const trackId = `meeting-reminder:${kind}:${meeting.id}`;

  if (kind !== "day_before") {
    return sendWhatsAppText({ groupId, message, trackId });
  }

  return sendWhatsAppButtons({
    groupId,
    message,
    trackId,
    buttons: [
      { label: "Sim, tudo certo!", id: `${CONFIRM_BUTTON_PREFIX}${meeting.id}` },
      { label: "Não vou conseguir!", id: `${DECLINE_BUTTON_PREFIX}${meeting.id}` },
    ],
  });
}

/**
 * Varre as reuniões de hoje e amanhã e dispara os lembretes vencidos.
 *
 * Idempotente: pode ser chamada quantas vezes quiser na mesma janela que o
 * cliente recebe cada mensagem uma única vez.
 */
export async function dispatchMeetingReminders(): Promise<DispatchSummary> {
  const now = nowInBrazil();
  const nowMinutes = toMinutes(now.date, now.time);

  // Véspera + dia da reunião: basta olhar de ontem a amanhã.
  const meetings = await prisma.meeting.findMany({
    where: {
      status: "confirmed",
      date: { gte: shiftDate(now.date, -1), lte: shiftDate(now.date, 1) },
    },
    select: { id: true, date: true, startTime: true, clientName: true, clientGroupId: true },
  });

  const summary: DispatchSummary = {
    now,
    considered: meetings.length,
    sent: 0,
    failed: 0,
    skipped: [],
  };

  for (const meeting of meetings) {
    for (const kind of REMINDER_KINDS) {
      const { target, graceMinutes } = targetFor(kind, meeting.date, meeting.startTime);

      // Ainda não venceu, ou venceu há tempo demais (cron atrasado / reunião
      // marcada em cima da hora, quando o alvo já nasceu no passado).
      if (nowMinutes < target || nowMinutes > target + graceMinutes) continue;

      // Nunca mandar depois que a reunião começou.
      if (nowMinutes > toMinutes(meeting.date, meeting.startTime)) continue;

      const groupId = meeting.clientGroupId?.trim();
      const clientName = meeting.clientName?.trim();
      if (!groupId || !clientName) {
        summary.skipped.push({
          meetingId: meeting.id,
          kind,
          reason: !groupId ? "sem_grupo_whatsapp" : "sem_nome_do_cliente",
        });
        continue;
      }

      const claimed = await claim(meeting.id, kind);
      if (!claimed) continue;

      try {
        const result = await deliver(kind, meeting, clientName, groupId);
        if (result.delivered) {
          summary.sent += 1;
          await prisma.meetingReminder.update({
            where: { id: claimed.id },
            data: { status: "sent", destination: result.destination, detail: result.mode },
          });
        } else {
          summary.failed += 1;
          await prisma.meetingReminder.update({
            where: { id: claimed.id },
            data: {
              status: "failed",
              detail: result.status ? `${result.reason}:${result.status}` : result.reason,
            },
          });
        }
      } catch (error) {
        summary.failed += 1;
        console.error("[meeting-reminders] envio falhou", { meetingId: meeting.id, kind, error });
        await prisma.meetingReminder.update({
          where: { id: claimed.id },
          data: { status: "failed", detail: "exception" },
        });
      }
    }
  }

  return summary;
}

// ─────────────────────── resposta do cliente (botão) ───────────────────────

export type ClientResponseOutcome =
  | { ok: true; response: "confirmed" | "declined"; alreadyHandled: boolean }
  | { ok: false; reason: "not_found" | "already_cancelled" };

/**
 * Aplica o toque do cliente no botão do lembrete de véspera.
 *
 * "Não vou conseguir" cancela a reunião de verdade: marca como `cancelled`,
 * apaga o evento do Google Calendar e com isso libera o horário para outro
 * agendamento. Os lembretes seguintes param sozinhos, porque a varredura só
 * enxerga reunião com status `confirmed`.
 */
export async function applyClientResponse(
  meetingId: string,
  response: "confirmed" | "declined",
): Promise<ClientResponseOutcome> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      status: true,
      googleEventId: true,
      clientPlan: true,
      clientResponse: true,
    },
  });
  if (!meeting) return { ok: false, reason: "not_found" };

  // Clique repetido no mesmo botão: nada a fazer, mas não é erro.
  if (meeting.clientResponse === response) {
    return { ok: true, response, alreadyHandled: true };
  }
  if (meeting.status === "cancelled") return { ok: false, reason: "already_cancelled" };

  if (response === "confirmed") {
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { clientResponse: "confirmed", clientRespondedAt: new Date() },
    });
    return { ok: true, response, alreadyHandled: false };
  }

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      clientResponse: "declined",
      clientRespondedAt: new Date(),
      status: "cancelled",
    },
  });

  if (meeting.googleEventId) {
    // O evento pode estar na agenda do plano, não na primária — sem resolver
    // o calendarId o delete cai em 404 e o horário fica ocupado no Google.
    const calendarId = await resolvePlanCalendarId(meeting.clientPlan);
    await deleteCalendarMeeting(meeting.googleEventId, calendarId);
  }

  return { ok: true, response, alreadyHandled: false };
}

const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Chaves que carregam o id do botão nas variações de payload conhecidas, em
 * dois níveis de confiança.
 *
 * As do primeiro grupo afirmam a opção que o cliente tocou — quando alguma
 * aparece, ela decide sozinha. As genéricas também são usadas pela mensagem
 * original citada (que lista as duas opções), então só valem se nenhuma do
 * primeiro grupo existir no payload.
 *
 * `buttonOrListid` é o campo que a instância realmente usa: não consta da spec
 * da UAZAPI, foi observado no retorno de `/message/find`. Vem vazio na mensagem
 * enviada e preenchido na resposta do cliente.
 */
const SELECTED_ID_KEYS =
  /^(buttonOrListid|selectedButtonId|selectedId|selectedRowId|selectedOptionId)$/i;
const FALLBACK_ID_KEYS = /^(buttonId|rowId|optionId|id)$/i;

function parseButtonId(
  value: string,
): { meetingId: string; response: "confirmed" | "declined" } | null {
  const declined = new RegExp(`^${DECLINE_BUTTON_PREFIX}(${UUID_PATTERN})$`, "i").exec(value);
  if (declined) return { meetingId: declined[1], response: "declined" };

  const confirmed = new RegExp(`^${CONFIRM_BUTTON_PREFIX}(${UUID_PATTERN})$`, "i").exec(value);
  if (confirmed) return { meetingId: confirmed[1], response: "confirmed" };

  return null;
}

/**
 * Percorre o payload atrás de chaves que representam um id de botão nosso,
 * separando as afirmativas ("selected*") das genéricas.
 */
function collectButtonIds(
  node: unknown,
  found: { selected: string[]; fallback: string[] },
  depth = 0,
): void {
  if (depth > 12 || node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) collectButtonIds(item, found, depth + 1);
    return;
  }

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (typeof value === "string" && parseButtonId(value)) {
      if (SELECTED_ID_KEYS.test(key)) found.selected.push(value);
      else if (FALLBACK_ID_KEYS.test(key)) found.fallback.push(value);
      continue;
    }
    collectButtonIds(value, found, depth + 1);
  }
}

/**
 * Extrai a reunião e a resposta de um payload de webhook da UAZAPI.
 *
 * O formato do evento de clique não está documentado na especificação OpenAPI
 * da UAZAPI, daí a leitura defensiva. O cuidado central: a resposta de botão
 * costuma vir com a mensagem original citada junto, e essa citação carrega os
 * DOIS ids ("sim" e "não"). Uma varredura ingênua pelo texto inteiro leria o
 * id errado e cancelaria uma reunião que o cliente acabou de confirmar.
 *
 * Por isso só valem chaves que denotam a opção escolhida; e se mesmo assim
 * sobrar ambiguidade, a função devolve null para o webhook registrar o payload
 * cru em vez de agir por adivinhação.
 */
export function extractButtonResponse(
  payload: unknown,
): { meetingId: string; response: "confirmed" | "declined" } | null {
  const found = { selected: [] as string[], fallback: [] as string[] };
  collectButtonIds(payload, found);

  for (const bucket of [found.selected, found.fallback]) {
    const unique = [...new Set(bucket)];
    if (unique.length === 1) return parseButtonId(unique[0]);
    if (unique.length > 1) {
      console.error("[uazapi-webhook] payload com mais de um botão — ignorado por ambiguidade");
      return null;
    }
  }

  // Nenhuma chave conhecida: aceita varredura ampla só quando o payload
  // menciona exatamente uma das duas opções, o que descarta a citação.
  const serialized = JSON.stringify(payload ?? null);
  const declined = new RegExp(`${DECLINE_BUTTON_PREFIX}(${UUID_PATTERN})`, "gi").exec(serialized);
  const confirmed = new RegExp(`${CONFIRM_BUTTON_PREFIX}(${UUID_PATTERN})`, "gi").exec(serialized);

  if (declined && !confirmed) return { meetingId: declined[1], response: "declined" };
  if (confirmed && !declined) return { meetingId: confirmed[1], response: "confirmed" };

  return null;
}
