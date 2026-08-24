const AUTHORIZED_TEST_GROUP_ID = "120363290811576538@g.us";
const GROUP_ID_PATTERN = /^\d+@g\.us$/;

export type UazapiMode = "test" | "production";

export type WhatsAppDeliveryResult =
  | { delivered: true; destination: string; mode: UazapiMode }
  | {
      delivered: false;
      reason: "not_configured" | "rejected" | "request_failed";
      status?: number;
    };

function getMode(): UazapiMode | null {
  const mode = process.env.UAZAPI_MODE?.trim().toLowerCase();
  return mode === "test" || mode === "production" ? mode : null;
}

function getConfiguration() {
  const mode = getMode();
  const serverUrl = process.env.UAZAPI_SERVER_URL?.trim().replace(/\/$/, "");
  const token = process.env.UAZAPI_INSTANCE_TOKEN?.trim();

  if (!mode || !serverUrl || !token) return null;

  try {
    const url = new URL(serverUrl);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return { mode, serverUrl: url.origin, token };
  } catch {
    return null;
  }
}

export function isUazapiTestMode(): boolean {
  return getMode() === "test";
}

export function isUazapiConfigured(): boolean {
  return getConfiguration() !== null;
}

type WhatsAppGroup = { id: string; name: string };

function readString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export async function listWhatsAppGroups(): Promise<WhatsAppGroup[]> {
  const config = getConfiguration();
  if (!config) throw new Error("UAZAPI não configurada.");

  const response = await fetch(`${config.serverUrl}/group/list?force=false`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token: config.token,
    },
    body: JSON.stringify({
      limit: 1000,
      offset: 0,
      force: false,
      noParticipants: true,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`UAZAPI respondeu HTTP ${response.status}.`);

  const payload: unknown = await response.json();
  const container = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
  const entries = Array.isArray(payload)
    ? payload
    : [container?.groups, container?.data, container?.result].find(Array.isArray) ?? [];

  return entries.flatMap((entry): WhatsAppGroup[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const id = readString(record, ["JID", "jid", "id", "ID", "groupId", "group_id", "remoteJid"]);
    const name = readString(record, ["Name", "name", "subject", "Subject", "groupName"]);
    return GROUP_ID_PATTERN.test(id) && name ? [{ id, name }] : [];
  });
}

export async function verifyWhatsAppGroupDestination(groupId: string): Promise<boolean> {
  const groups = await listWhatsAppGroups();
  return groups.some((candidate) => candidate.id === groupId);
}

/**
 * Aplica as travas de destino antes de qualquer envio.
 *
 * Em `UAZAPI_MODE=test` o destino do chamador é ignorado e substituído pelo
 * grupo autorizado de homologação — é o que impede um teste de vazar para o
 * grupo de um cliente real.
 */
/**
 * Devolve o JID de grupo a partir das formas que circulam pelo sistema.
 *
 * O evento do Google guarda o grupo na descrição como `<dígitos>-group`
 * (ver toGroupIdDescription em google-calendar.ts, que troca o `@g.us` para não
 * pôr um e-mail aparente na descrição). A sincronização lê essa descrição de
 * volta e grava em `Meeting.clientGroupId` — então reunião vinda do Google
 * chega aqui com o formato trocado, e sem esta conversão o envio é recusado.
 */
export function normalizeGroupId(raw: string): string {
  const value = raw.trim();
  if (GROUP_ID_PATTERN.test(value)) return value;

  const digits = /^(\d+)(?:-group)?$/.exec(value)?.[1];
  return digits ? `${digits}@g.us` : value;
}

function resolveDestination(
  groupId: string,
  mode: UazapiMode,
): { ok: true; destination: string } | { ok: false; reason: "not_configured" | "rejected" } {
  let destination = normalizeGroupId(groupId);

  if (mode === "test") {
    const configuredTestGroup = process.env.UAZAPI_TEST_GROUP_ID?.trim();
    if (configuredTestGroup !== AUTHORIZED_TEST_GROUP_ID) {
      return { ok: false, reason: "not_configured" };
    }
    destination = AUTHORIZED_TEST_GROUP_ID;
  }

  if (!GROUP_ID_PATTERN.test(destination)) {
    return { ok: false, reason: "rejected" };
  }

  return { ok: true, destination };
}

async function postToUazapi(
  path: "/send/text",
  payload: Record<string, unknown>,
  config: { serverUrl: string; token: string; mode: UazapiMode },
  destination: string,
): Promise<WhatsAppDeliveryResult> {
  try {
    const response = await fetch(`${config.serverUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: config.token,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`[uazapi] ${path} failed with status ${response.status}`);
      return { delivered: false, reason: "rejected", status: response.status };
    }

    return { delivered: true, destination, mode: config.mode };
  } catch (error) {
    console.error(`[uazapi] ${path} request failed:`, error);
    return { delivered: false, reason: "request_failed" };
  }
}

export async function sendWhatsAppText({
  groupId,
  message,
  trackId,
}: {
  groupId: string;
  message: string;
  trackId: string;
}): Promise<WhatsAppDeliveryResult> {
  const config = getConfiguration();
  if (!config) return { delivered: false, reason: "not_configured" };

  const resolved = resolveDestination(groupId, config.mode);
  if (!resolved.ok) return { delivered: false, reason: resolved.reason };

  return postToUazapi(
    "/send/text",
    {
      number: resolved.destination,
      text: message,
      linkPreview: false,
      track_id: trackId,
      async: false,
    },
    config,
    resolved.destination,
  );
}

export type WhatsAppScheduleResult =
  | { scheduled: true; folderId: string; destination: string; mode: UazapiMode }
  | {
      scheduled: false;
      reason: "not_configured" | "rejected" | "request_failed" | "in_the_past";
      status?: number;
    };

/**
 * Entrega uma mensagem à fila da própria UAZAPI, para disparo em `sendAt`.
 *
 * É o que tira a Vercel do caminho: ninguém precisa acordar na hora marcada,
 * porque o gatilho fica com quem vai entregar a mensagem. O `folder_id`
 * devolvido é o que permite cancelar depois.
 */
export async function scheduleWhatsAppMessage({
  groupId,
  message,
  sendAt,
  buttons,
  footerText,
  info,
}: {
  groupId: string;
  message: string;
  sendAt: Date;
  buttons?: Array<{ label: string; id: string }>;
  footerText?: string;
  info: string;
}): Promise<WhatsAppScheduleResult> {
  const config = getConfiguration();
  if (!config) return { scheduled: false, reason: "not_configured" };

  // Agendar para trás faria a UAZAPI disparar na hora — pior que não enviar,
  // porque chega fora de contexto ("faltam 5 minutos" depois da reunião).
  const when = sendAt.getTime();
  if (!Number.isFinite(when) || when <= Date.now()) {
    return { scheduled: false, reason: "in_the_past" };
  }

  if (buttons?.some((button) => button.label.includes("|") || button.id.includes("|"))) {
    console.error("[uazapi] botão com '|' no rótulo ou id — agendamento bloqueado");
    return { scheduled: false, reason: "rejected" };
  }

  const resolved = resolveDestination(groupId, config.mode);
  if (!resolved.ok) return { scheduled: false, reason: resolved.reason };

  try {
    const response = await fetch(`${config.serverUrl}/sender/simple`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: config.token },
      body: JSON.stringify({
        numbers: [resolved.destination],
        type: buttons?.length ? "button" : "text",
        text: message,
        ...(buttons?.length
          ? { choices: buttons.map((b) => `${b.label}|${b.id}`), ...(footerText ? { footerText } : {}) }
          : { linkPreview: false }),
        info,
        // Um destinatário só por campanha: o delay entre mensagens não se aplica.
        delayMin: 1,
        delayMax: 2,
        scheduled_for: when,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.error(`[uazapi] /sender/simple falhou com status ${response.status}`);
      return { scheduled: false, reason: "rejected", status: response.status };
    }

    const payload = (await response.json()) as { folder_id?: unknown };
    const folderId = typeof payload.folder_id === "string" ? payload.folder_id : null;
    if (!folderId) {
      // Sem o id não há como cancelar depois — tratar como falha é melhor que
      // deixar uma mensagem órfã viva na fila.
      console.error("[uazapi] /sender/simple não devolveu folder_id");
      return { scheduled: false, reason: "rejected" };
    }

    return { scheduled: true, folderId, destination: resolved.destination, mode: config.mode };
  } catch (error) {
    console.error("[uazapi] /sender/simple falhou:", error);
    return { scheduled: false, reason: "request_failed" };
  }
}

/**
 * Remove uma campanha agendada. Mensagens já enviadas não são afetadas.
 *
 * Devolve true também quando a campanha já não existe: o objetivo é "não vai
 * disparar", e isso já está satisfeito.
 */
export async function cancelWhatsAppSchedule(folderId: string): Promise<boolean> {
  const config = getConfiguration();
  if (!config) return false;

  try {
    const response = await fetch(`${config.serverUrl}/sender/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: config.token },
      body: JSON.stringify({ folder_id: folderId, action: "delete" }),
      signal: AbortSignal.timeout(15_000),
    });

    if (response.ok || response.status === 404) return true;

    console.error(`[uazapi] /sender/edit delete falhou com status ${response.status}`);
    return false;
  } catch (error) {
    console.error("[uazapi] /sender/edit delete falhou:", error);
    return false;
  }
}


/* ══════════════════════════════════════════════════════════════════════
   DISPAROS EM MASSA
   ══════════════════════════════════════════════════════════════════════ */

export type BroadcastOutboundType = "text" | "image" | "video" | "audio" | "poll";

export type BroadcastOutbound = {
  groupId: string;
  type: BroadcastOutboundType;
  /** Texto da mensagem, ou legenda quando for mídia. Já com as variáveis resolvidas. */
  text?: string | null;
  fileUrl?: string | null;
  choices?: string[];
  selectableCount?: number | null;
};

export type BulkSendResult =
  | { ok: true; folderId: string; mode: UazapiMode; queued: number }
  | {
      ok: false;
      reason: "not_configured" | "rejected" | "request_failed" | "empty" | "in_the_past";
      status?: number;
    };

/**
 * Entrega um disparo inteiro à fila da UAZAPI numa única chamada.
 *
 * Cada item de `outbound` já vai com o texto do seu destinatário — é assim que
 * as variáveis ({{nome}} e companhia) funcionam sem precisar de uma chamada por
 * cliente. O intervalo entre mensagens é `delayMin`/`delayMax`, sorteado lá, o
 * que evita o padrão de robô sem manter nenhuma função da Vercel viva esperando.
 *
 * O `folder_id` devolvido é o que permite acompanhar (listCampaignMessages) e
 * cancelar (cancelWhatsAppSchedule) depois.
 */
export async function sendWhatsAppBulk({
  outbound,
  delayMin,
  delayMax,
  scheduledFor,
  info,
  tokenOverride,
}: {
  outbound: BroadcastOutbound[];
  delayMin: number;
  delayMax: number;
  scheduledFor?: Date | null;
  info: string;
  /**
   * Token da instância de quem envia. Sem isto, sai pelo número de automação
   * (UAZAPI_INSTANCE_TOKEN). O modo (test/production) e a URL do servidor
   * continuam vindo do ambiente: o que muda é de qual número a mensagem sai,
   * não para onde ela vai — em teste tudo segue indo para o grupo de teste.
   */
  tokenOverride?: string | null;
}): Promise<BulkSendResult> {
  const base = getConfiguration();
  if (!base) return { ok: false, reason: "not_configured" };
  const config = tokenOverride?.trim()
    ? { ...base, token: tokenOverride.trim() }
    : base;

  if (scheduledFor) {
    const when = scheduledFor.getTime();
    if (!Number.isFinite(when) || when <= Date.now()) {
      return { ok: false, reason: "in_the_past" };
    }
  }

  // Em modo de teste todo destino vira o mesmo grupo autorizado. Mandar a lista
  // inteira encheria esse grupo com uma cópia por cliente, então passa só a
  // sequência do primeiro cliente — o suficiente para conferir o conteúdo.
  const firstGroupId = outbound[0]?.groupId ?? null;

  const messages: Record<string, unknown>[] = [];
  for (const item of outbound) {
    if (config.mode === "test" && item.groupId !== firstGroupId) continue;

    const resolved = resolveDestination(item.groupId, config.mode);
    if (!resolved.ok) {
      // Um grupo inválido não pode derrubar o disparo inteiro: ele é pulado e o
      // chamador percebe pela diferença entre o que pediu e o `queued`.
      console.error(`[uazapi] destino recusado no disparo: ${item.groupId} (${resolved.reason})`);
      continue;
    }

    const base: Record<string, unknown> = {
      number: resolved.destination,
      type: item.type,
    };

    if (item.type === "poll") {
      const choices = (item.choices ?? []).map((c) => c.trim()).filter(Boolean);
      if (!item.text?.trim() || choices.length < 2) {
        console.error("[uazapi] enquete sem pergunta ou com menos de 2 opções — item ignorado");
        continue;
      }
      base.text = item.text.trim();
      base.choices = choices;
      base.selectableCount = Math.min(Math.max(item.selectableCount ?? 1, 1), choices.length);
    } else if (item.type === "text") {
      if (!item.text?.trim()) continue;
      base.text = item.text;
      base.linkPreview = false;
    } else {
      if (!item.fileUrl) {
        console.error(`[uazapi] mídia sem arquivo (${item.type}) — item ignorado`);
        continue;
      }
      base.file = item.fileUrl;
      // Legenda é opcional em mídia; texto vazio não vai, para não mandar
      // uma linha em branco embaixo da imagem.
      if (item.text?.trim()) base.text = item.text;
    }

    messages.push(base);
  }

  if (messages.length === 0) return { ok: false, reason: "empty" };

  try {
    const response = await fetch(`${config.serverUrl}/sender/advanced`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: config.token },
      body: JSON.stringify({
        messages,
        delayMin,
        delayMax,
        info,
        ...(scheduledFor ? { scheduled_for: scheduledFor.getTime() } : {}),
      }),
      // A lista pode ter centenas de itens; o padrão de 10s é curto demais.
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      console.error(`[uazapi] /sender/advanced falhou com status ${response.status}`);
      return { ok: false, reason: "rejected", status: response.status };
    }

    const payload = (await response.json()) as { folder_id?: unknown };
    const folderId = typeof payload.folder_id === "string" ? payload.folder_id : null;
    if (!folderId) {
      // Sem o id o disparo vira uma campanha órfã: entregue, mas impossível de
      // acompanhar ou cancelar. Tratar como falha é mais honesto.
      console.error("[uazapi] /sender/advanced não devolveu folder_id");
      return { ok: false, reason: "rejected" };
    }

    return { ok: true, folderId, mode: config.mode, queued: messages.length };
  } catch (error) {
    console.error("[uazapi] /sender/advanced falhou:", error);
    return { ok: false, reason: "request_failed" };
  }
}

/**
 * Como a UAZAPI classifica uma mensagem: `Queued`, `Sent`, `Delivered`, `Read`,
 * `Failed`, `Canceled`.
 *
 * Reduzimos isso a três baldes porque o relatório responde "saiu, não saiu, ou
 * ainda vai sair". `Delivered` e `Read` contam como enviada — são estágios
 * DEPOIS do envio, e tratá-los como pendente fazia o disparo aparecer "na fila"
 * mesmo com a mensagem já lida no celular do cliente.
 */
export type CampaignOutcome = "sent" | "queued" | "failed" | "canceled";

export function classifyCampaignStatus(raw: string): CampaignOutcome {
  switch (raw.trim().toLowerCase()) {
    case "sent":
    case "delivered":
    case "read":
    case "played":
      return "sent";
    case "failed":
    case "error":
      return "failed";
    case "canceled":
    case "cancelled":
      return "canceled";
    // "Queued" e qualquer status novo caem aqui: é o balde seguro, porque
    // contar como enviada o que não conhecemos seria mentir no relatório.
    default:
      return "queued";
  }
}

export type CampaignMessage = {
  /** Destino como a UAZAPI devolve — no schema dela é `chatid` (ex.: 1203...@g.us). */
  number: string;
  /** Status cru, para depurar quando aparecer algo fora da lista conhecida. */
  status: string;
  outcome: CampaignOutcome;
  sentAt: Date | null;
  error: string | null;
};

/**
 * Lê o andamento de um disparo direto da UAZAPI.
 *
 * A fonte da verdade sobre entrega é ela, não o nosso banco — aqui só ficou
 * registrado para quem o disparo foi criado. Paginado porque um disparo para
 * todos os clientes passa de 100 mensagens.
 */
export async function listCampaignMessages(folderId: string): Promise<CampaignMessage[]> {
  const config = getConfiguration();
  if (!config) return [];

  const all: CampaignMessage[] = [];
  const pageSize = 500;

  for (let offset = 0; offset < 10_000; offset += pageSize) {
    let page: unknown;
    try {
      const response = await fetch(`${config.serverUrl}/sender/listmessages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: config.token },
        body: JSON.stringify({ folder_id: folderId, limit: pageSize, offset }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        console.error(`[uazapi] /sender/listmessages falhou com status ${response.status}`);
        break;
      }
      page = await response.json();
    } catch (error) {
      console.error("[uazapi] /sender/listmessages falhou:", error);
      break;
    }

    const rows = Array.isArray((page as { messages?: unknown })?.messages)
      ? ((page as { messages: unknown[] }).messages)
      : [];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (typeof row !== "object" || row === null) continue;
      const record = row as Record<string, unknown>;
      const number = readString(record, ["chatid", "chatId", "number", "jid", "destination"]);
      if (!number) continue;
      // O schema da UAZAPI expõe `messageTimestamp` em milissegundos; os nomes
      // seguintes são tolerância, não promessa.
      const rawSentAt = record.messageTimestamp ?? record.sentAt ?? record.sent_at ?? null;
      const sentAt =
        typeof rawSentAt === "number"
          ? new Date(rawSentAt > 1e12 ? rawSentAt : rawSentAt * 1000)
          : typeof rawSentAt === "string" && rawSentAt.trim()
            ? new Date(rawSentAt)
            : null;
      const status = readString(record, ["status", "messageStatus"]) || "Queued";
      all.push({
        number,
        status,
        outcome: classifyCampaignStatus(status),
        sentAt: sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : null,
        error: readString(record, ["error", "errorMessage", "failReason"]) || null,
      });
    }

    if (rows.length < pageSize) break;
  }

  return all;
}

export type CampaignFolder = {
  folderId: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  /** Já entregues/lidas — subconjunto de `sent`, útil para o relatório. */
  delivered: number;
  read: number;
  /** Nada mais para sair: tudo virou sucesso ou falha. */
  finished: boolean;
};

function readNumber(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

/**
 * Estado das campanhas direto da UAZAPI, pelos contadores que ela mantém.
 *
 * É mais confiável que somar o status de cada mensagem: aqui quem conta é o
 * próprio serviço que entrega. `log_sucess` é escrito assim mesmo do lado de
 * lá — o nome com um "c" só é da API, não erro de digitação daqui.
 *
 * O endpoint devolve todas as campanhas da instância, então filtramos pelos ids
 * que interessam.
 */
export async function listCampaignFolders(folderIds: string[]): Promise<Map<string, CampaignFolder>> {
  const found = new Map<string, CampaignFolder>();
  const wanted = new Set(folderIds.filter(Boolean));
  if (wanted.size === 0) return found;

  const config = getConfiguration();
  if (!config) return found;

  let payload: unknown;
  try {
    const response = await fetch(`${config.serverUrl}/sender/listfolders`, {
      method: "GET",
      headers: { token: config.token },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.error(`[uazapi] /sender/listfolders falhou com status ${response.status}`);
      return found;
    }
    payload = await response.json();
  } catch (error) {
    console.error("[uazapi] /sender/listfolders falhou:", error);
    return found;
  }

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { folders?: unknown })?.folders)
      ? (payload as { folders: unknown[] }).folders
      : [];

  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const record = row as Record<string, unknown>;
    const folderId = readString(record, ["id", "folder_id", "folderId"]);
    if (!folderId || !wanted.has(folderId)) continue;

    const total = readNumber(record, ["log_total"]);
    const sent = readNumber(record, ["log_sucess", "log_success"]);
    const failed = readNumber(record, ["log_failed"]);
    const status = readString(record, ["status"]);

    found.set(folderId, {
      folderId,
      status,
      total,
      sent,
      failed,
      delivered: readNumber(record, ["log_delivered"]),
      read: readNumber(record, ["log_read"]),
      // Sem total não dá para afirmar que acabou; melhor seguir "em andamento"
      // do que fechar um disparo que ainda tem mensagem para sair.
      finished: total > 0 && sent + failed >= total,
    });
  }

  return found;
}
