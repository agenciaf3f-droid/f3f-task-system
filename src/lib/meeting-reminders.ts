import { prisma } from "@/lib/prisma";
import { markCalendarMeetingCancelled } from "@/lib/google-calendar";
import { resolvePlanCalendarId } from "@/lib/plan-calendar";
import { cancelWhatsAppSchedule, scheduleWhatsAppMessage } from "@/lib/whatsapp";

export const REMINDER_KINDS = ["day_before", "morning", "hour_before", "minutes_before"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Prefixos dos ids de botão que voltam no webhook da UAZAPI. */
export const CONFIRM_BUTTON_PREFIX = "f3f-sim:";
export const DECLINE_BUTTON_PREFIX = "f3f-nao:";

const TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE || "America/Sao_Paulo";

const WEEKDAYS_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

// ──────────────────────────── horários ────────────────────────────
// A reunião é gravada como date "YYYY-MM-DD" + startTime "HH:MM" no horário de
// Brasília. A UAZAPI precisa de um instante absoluto, então aqui — e só aqui —
// acontece a conversão de horário de parede para timestamp.

/** Quanto a zona está deslocada de UTC no instante dado. */
function zoneOffsetMs(instant: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUtc - instant.getTime();
}

/**
 * Converte horário de parede de Brasília em instante absoluto.
 *
 * Não usa offset fixo de -3: se o Brasil voltar a ter horário de verão, a
 * conta continua certa porque o deslocamento é perguntado ao Intl para
 * aquela data específica.
 */
export function brazilWallClockToInstant(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(guess - zoneOffsetMs(new Date(guess)));
}

function shiftDate(date: string, deltaDays: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + deltaDays)).toISOString().slice(0, 10);
}

function weekdayName(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS_PT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/** Horário do lembrete de véspera, no dia anterior à reunião. */
function dayBeforeClock(): string {
  const raw = process.env.MEETING_REMINDER_DAY_BEFORE_HOUR?.trim();
  return raw && /^\d{2}:\d{2}$/.test(raw) ? raw : "06:00";
}

/** Instante de disparo de cada um dos quatro lembretes. */
export function computeReminderTimes(
  meetingDate: string,
  startTime: string,
): Record<ReminderKind, Date> {
  const start = brazilWallClockToInstant(meetingDate, startTime);
  return {
    day_before: brazilWallClockToInstant(shiftDate(meetingDate, -1), dayBeforeClock()),
    morning: brazilWallClockToInstant(meetingDate, "06:00"),
    hour_before: new Date(start.getTime() - 60 * 60 * 1000),
    minutes_before: new Date(start.getTime() - 5 * 60 * 1000),
  };
}

// ──────────────────────────── mensagens ────────────────────────────

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

// ──────────────────────────── agendamento ────────────────────────────

export type ScheduleSummary = {
  meetingId: string;
  scheduled: number;
  pending: number;
  skipped: number;
  failed: number;
  /** Motivo -> quantidade. Sem isto, uma falha em massa vira adivinhação. */
  reasons: Record<string, number>;
};

/**
 * Antecedência com que um lembrete é entregue à fila da UAZAPI.
 *
 * A linha no banco nasce junto com a reunião, mas a campanha lá fora só é
 * criada quando o disparo se aproxima. Uma série mensal de 12 ocorrências
 * geraria 48 campanhas de uma vez, meses à frente — muita coisa exposta a
 * qualquer mudança de horário, e uma marcação lentíssima para o cliente.
 *
 * 7 dias dá folga: o reconciliador roda todo dia e o lembrete mais cedo é o de
 * véspera, então mesmo perdendo alguns dias seguidos nada fica para trás.
 */
const SCHEDULE_HORIZON_DAYS = 7;

/**
 * Interruptor geral, checado em TODO caminho que agenda — não só no cron.
 *
 * Reunião marcada pela tela também agenda, então uma trava só no cron deixaria
 * a primeira marcação depois do deploy disparar mensagem em grupo de cliente
 * real. Opt-in explícito: ausente, vazia ou escrita errada = desligado.
 */
export function meetingRemindersEnabled(): boolean {
  return process.env.MEETING_REMINDERS_ENABLED?.trim() === "true";
}

const MEETING_FIELDS = {
  id: true,
  date: true,
  startTime: true,
  status: true,
  clientName: true,
  clientGroupId: true,
} as const;

type SchedulableMeeting = {
  id: string;
  date: string;
  startTime: string;
  status: string;
  clientName: string | null;
  clientGroupId: string | null;
};

/**
 * Registra os quatro lembretes de uma reunião.
 *
 * A linha entra sempre, com o instante do disparo. A campanha na UAZAPI só é
 * criada quando o horário está dentro do horizonte — o resto fica `pending`
 * até o reconciliador alcançá-lo.
 *
 * Idempotente: lembrete que já tem campanha viva é deixado em paz, então
 * chamar de novo (inclusive pelo reconciliador) não duplica mensagem.
 *
 * Lembrete cujo horário já passou é marcado como `skipped` — reunião marcada
 * em cima da hora não deve receber "confirma amanhã?" retroativo.
 */
export async function scheduleMeetingReminders(
  meetingOrId: string | SchedulableMeeting,
): Promise<ScheduleSummary | null> {
  const meeting = typeof meetingOrId === "string"
    ? await prisma.meeting.findUnique({ where: { id: meetingOrId }, select: MEETING_FIELDS })
    : meetingOrId;

  if (!meetingRemindersEnabled()) return null;
  if (!meeting || meeting.status !== "confirmed") return null;

  const groupId = meeting.clientGroupId?.trim();
  const clientName = groupId ? await resolveClientName(groupId, meeting.clientName) : null;
  const summary: ScheduleSummary = {
    meetingId: meeting.id,
    scheduled: 0,
    pending: 0,
    skipped: 0,
    failed: 0,
    reasons: {},
  };
  const conta = (motivo: string) => {
    summary.reasons[motivo] = (summary.reasons[motivo] ?? 0) + 1;
  };

  // Sem grupo ou sem nome não há mensagem possível. Registrar como skipped
  // deixa o rastro visível em vez de falhar silenciosamente.
  if (!groupId || !clientName) {
    await Promise.all(
      REMINDER_KINDS.map((kind) =>
        upsertReminder(meeting.id, kind, new Date(), {
          status: "skipped",
          detail: !groupId ? "sem_grupo_whatsapp" : "sem_nome_do_cliente",
        }),
      ),
    );
    summary.skipped = REMINDER_KINDS.length;
    conta(!groupId ? "sem_grupo_whatsapp" : "sem_nome_do_cliente");
    return summary;
  }

  const times = computeReminderTimes(meeting.date, meeting.startTime);
  const existing = await prisma.meetingReminder.findMany({
    where: { meetingId: meeting.id },
    select: { kind: true, status: true, folderId: true },
  });
  const byKind = new Map(existing.map((row) => [row.kind, row]));

  for (const kind of REMINDER_KINDS) {
    const already = byKind.get(kind);
    if (already?.status === "scheduled" && already.folderId) continue;

    const sendAt = times[kind];
    if (sendAt.getTime() <= Date.now()) {
      await upsertReminder(meeting.id, kind, sendAt, { status: "skipped", detail: "horario_passado" });
      summary.skipped += 1;
      conta("horario_passado");
      continue;
    }

    // Longe demais: registra a intenção e deixa para o reconciliador. Evita
    // encher a fila da UAZAPI com meses de antecedência.
    if (sendAt.getTime() - Date.now() > SCHEDULE_HORIZON_DAYS * 24 * 60 * 60 * 1000) {
      await upsertReminder(meeting.id, kind, sendAt, { status: "pending", detail: "fora_do_horizonte" });
      summary.pending += 1;
      conta("fora_do_horizonte");
      continue;
    }

    const message = buildReminderMessage(kind, {
      clientName,
      meetingDate: meeting.date,
      startTime: meeting.startTime,
    });

    const result = await scheduleWhatsAppMessage({
      groupId,
      message,
      sendAt,
      info: `f3f-lembrete:${kind}:${meeting.id}`,
      buttons: kind === "day_before"
        ? [
            { label: "Sim, tudo certo!", id: `${CONFIRM_BUTTON_PREFIX}${meeting.id}` },
            { label: "Não vou conseguir!", id: `${DECLINE_BUTTON_PREFIX}${meeting.id}` },
          ]
        : undefined,
    });

    if (result.scheduled) {
      await upsertReminder(meeting.id, kind, sendAt, {
        status: "scheduled",
        folderId: result.folderId,
        destination: result.destination,
        detail: result.mode,
      });
      summary.scheduled += 1;
    } else {
      // Fica como failed para o reconciliador tentar de novo amanhã.
      const motivo = result.status ? `${result.reason}_${result.status}` : result.reason;
      await upsertReminder(meeting.id, kind, sendAt, { status: "failed", detail: motivo });
      summary.failed += 1;
      conta(motivo);
    }
  }

  return summary;
}

/**
 * Nome do cliente para a saudação da mensagem.
 *
 * `Meeting.clientName` NÃO serve: quando a reunião é criada pelo /calendario
 * ele guarda um rótulo de exibição — `"${título} · ${cliente}"` — e a saudação
 * sairia como "🤖 Reunião de alinhamento · Padaria do João, tudo bem?".
 *
 * O grupo de WhatsApp é a identidade confiável do cliente, então o nome vem do
 * cadastro. Só cai no campo da reunião quando não há cadastro correspondente
 * (reunião vinda do Google Calendar, por exemplo), onde ele é o nome puro.
 */
async function resolveClientName(
  groupId: string,
  fallback: string | null,
): Promise<string | null> {
  const client = await prisma.client.findFirst({
    where: { whatsappGroupId: groupId, deletedAt: null },
    select: { name: true },
  });
  return client?.name.trim() || fallback?.trim() || null;
}

async function upsertReminder(
  meetingId: string,
  kind: ReminderKind,
  scheduledFor: Date,
  data: { status: string; folderId?: string; destination?: string; detail?: string },
) {
  await prisma.meetingReminder.upsert({
    where: { meetingId_kind: { meetingId, kind } },
    create: { meetingId, kind, scheduledFor, ...data },
    update: { scheduledFor, folderId: data.folderId ?? null, ...data },
  });
}

/**
 * Desmarca os lembretes de uma ou mais reuniões.
 *
 * Apaga dos DOIS lados. Remover só a linha do banco deixaria a mensagem viva na
 * fila da UAZAPI, e o cliente receberia lembrete de reunião cancelada.
 *
 * Quando o cancelamento na UAZAPI falha, a linha é mantida como `failed` em vez
 * de apagada — sem o `folder_id` ninguém mais conseguiria desmarcar aquela
 * campanha. O reconciliador tenta de novo.
 */
export async function cancelMeetingReminders(meetingIds: string[]): Promise<{
  cancelled: number;
  failed: number;
}> {
  if (meetingIds.length === 0) return { cancelled: 0, failed: 0 };

  const reminders = await prisma.meetingReminder.findMany({
    where: { meetingId: { in: meetingIds } },
    select: { id: true, folderId: true },
  });
  if (reminders.length === 0) return { cancelled: 0, failed: 0 };

  const removable: string[] = [];
  const stuck: string[] = [];

  for (const reminder of reminders) {
    if (!reminder.folderId) {
      removable.push(reminder.id);
      continue;
    }
    const ok = await cancelWhatsAppSchedule(reminder.folderId);
    (ok ? removable : stuck).push(reminder.id);
  }

  if (removable.length > 0) {
    await prisma.meetingReminder.deleteMany({ where: { id: { in: removable } } });
  }
  if (stuck.length > 0) {
    await prisma.meetingReminder.updateMany({
      where: { id: { in: stuck } },
      data: { status: "failed", detail: "cancelamento_falhou" },
    });
  }

  return { cancelled: removable.length, failed: stuck.length };
}

/**
 * Conserta divergências entre o banco e a fila da UAZAPI.
 *
 * Roda uma vez por dia — não para descobrir se chegou a hora de enviar (disso a
 * UAZAPI cuida), mas para pegar o agendamento que falhou por queda de rede na
 * hora da marcação e o cancelamento que não chegou ao outro lado. É o que torna
 * o sistema auto-corrigível sem ficar acordando de minuto em minuto.
 */
export async function reconcileMeetingReminders(): Promise<{
  scheduledMeetings: number;
  scheduled: number;
  failed: number;
  orphansCancelled: number;
  reasons: Record<string, number>;
}> {
  const today = new Date().toISOString().slice(0, 10);

  // 1. Lembretes presos em reunião que não está mais confirmada.
  const orphanMeetingIds = (
    await prisma.meetingReminder.findMany({
      where: { meeting: { status: { not: "confirmed" } } },
      select: { meetingId: true },
      distinct: ["meetingId"],
    })
  ).map((row) => row.meetingId);
  const orphans = await cancelMeetingReminders(orphanMeetingIds);

  // 2. Reuniões confirmadas de hoje em diante sem agendamento completo.
  const meetings = await prisma.meeting.findMany({
    where: { status: "confirmed", date: { gte: today } },
    select: MEETING_FIELDS,
    orderBy: { date: "asc" },
  });

  let scheduled = 0;
  let failed = 0;
  let touched = 0;
  const reasons: Record<string, number> = {};

  for (const meeting of meetings) {
    const result = await scheduleMeetingReminders(meeting);
    if (!result) continue;
    if (result.scheduled > 0 || result.failed > 0) touched += 1;
    scheduled += result.scheduled;
    failed += result.failed;
    for (const [motivo, n] of Object.entries(result.reasons)) {
      reasons[motivo] = (reasons[motivo] ?? 0) + n;
    }
  }

  return {
    scheduledMeetings: touched,
    scheduled,
    failed,
    orphansCancelled: orphans.cancelled,
    reasons,
  };
}

// ─────────────────────── resposta do cliente (botão) ───────────────────────

export type ClientResponseOutcome =
  | { ok: true; response: "confirmed" | "declined"; alreadyHandled: boolean }
  | { ok: false; reason: "not_found" | "already_cancelled" };

/**
 * Aplica o toque do cliente no botão do lembrete de véspera.
 *
 * "Não vou conseguir" cancela a reunião de verdade: marca como `cancelled`,
 * libera o horário e desmarca os lembretes seguintes — que já estão na fila da
 * UAZAPI e sairiam mesmo assim.
 *
 * No Google o evento não é apagado: ganha "(Cancelado)" no título e passa a
 * Disponível, para ficar o registro de que a reunião existiu e foi desmarcada.
 */
export async function applyClientResponse(
  meetingId: string,
  response: "confirmed" | "declined",
): Promise<ClientResponseOutcome> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, status: true, googleEventId: true, clientPlan: true, clientResponse: true },
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
    data: { clientResponse: "declined", clientRespondedAt: new Date(), status: "cancelled" },
  });

  await cancelMeetingReminders([meeting.id]);

  if (meeting.googleEventId) {
    // O evento pode estar na agenda do plano, não na primária — sem resolver o
    // calendarId a alteração cai em 404 e o horário fica ocupado no Google.
    const calendarId = await resolvePlanCalendarId(meeting.clientPlan);
    await markCalendarMeetingCancelled(meeting.googleEventId, calendarId);
  }

  return { ok: true, response, alreadyHandled: false };
}

// ─────────────────────── leitura do webhook ───────────────────────

const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Chaves que carregam o id do botão, em dois níveis de confiança.
 *
 * As do primeiro grupo afirmam a opção que o cliente tocou — quando alguma
 * aparece, ela decide sozinha. As genéricas também são usadas pela mensagem
 * original citada (que lista as duas opções), então só valem se nenhuma do
 * primeiro grupo existir no payload.
 *
 * `buttonOrListid` é o campo que a instância realmente usa: não consta da spec
 * da UAZAPI, foi observado no retorno de `/message/find`.
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
 * O cuidado central: a resposta de botão vem com a mensagem original citada
 * junto, e essa citação carrega os DOIS ids ("sim" e "não") — confirmado no
 * payload real. Uma varredura pelo texto inteiro leria o id errado e
 * cancelaria uma reunião que o cliente acabou de confirmar. Por isso só valem
 * chaves que denotam a opção escolhida, e ambiguidade devolve null.
 *
 * Custo importa aqui: este webhook é chamado a cada mensagem de QUALQUER grupo
 * que a instância enxerga. A varredura é por chave, com profundidade limitada,
 * e nunca serializa o payload — mensagens com mídia trazem base64, e serializar
 * isso milhares de vezes por dia sairia caro à toa.
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

  return null;
}

/**
 * Indica que o evento parece uma resposta de botão que não conseguimos ler.
 *
 * Serve só para decidir se vale logar o formato — por isso olha campos rasos e
 * conhecidos em vez de vasculhar o payload.
 */
export function looksLikeUnreadButtonReply(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const root = payload as Record<string, unknown>;
  const message = (root.message ?? root) as Record<string, unknown>;
  if (!message || typeof message !== "object") return false;

  const type = message.messageType;
  if (typeof type === "string" && type.toLowerCase().includes("response")) return true;

  const tapped = message.buttonOrListid;
  return typeof tapped === "string" && tapped.trim().length > 0;
}
