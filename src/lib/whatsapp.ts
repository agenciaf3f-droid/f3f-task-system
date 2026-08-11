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

  let destination = groupId.trim();
  if (config.mode === "test") {
    const configuredTestGroup = process.env.UAZAPI_TEST_GROUP_ID?.trim();
    if (configuredTestGroup !== AUTHORIZED_TEST_GROUP_ID) {
      return { delivered: false, reason: "not_configured" };
    }
    destination = AUTHORIZED_TEST_GROUP_ID;
  }

  if (!GROUP_ID_PATTERN.test(destination)) {
    return { delivered: false, reason: "rejected" };
  }

  try {
    const response = await fetch(`${config.serverUrl}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: config.token,
      },
      body: JSON.stringify({
        number: destination,
        text: message,
        linkPreview: false,
        track_id: trackId,
        async: false,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`[uazapi] send/text failed with status ${response.status}`);
      return { delivered: false, reason: "rejected", status: response.status };
    }

    return { delivered: true, destination, mode: config.mode };
  } catch (error) {
    console.error("[uazapi] send/text request failed:", error);
    return { delivered: false, reason: "request_failed" };
  }
}
