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

