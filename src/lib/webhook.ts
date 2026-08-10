import { prisma } from "@/lib/prisma";

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export type WebhookDeliveryResult =
  | { delivered: true }
  | { delivered: false; reason: "not_configured" | "request_failed" };

export async function deliverWebhook(
  companyId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<WebhookDeliveryResult> {
  try {
    const config = await prisma.webhookConfig.findUnique({
      where: { companyId },
    });

    if (!config || !config.isActive || !config.url) {
      return { delivered: false, reason: "not_configured" };
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.secret) headers["X-Webhook-Secret"] = config.secret;

    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`[webhook] ${event} failed with status ${response.status}`);
      return { delivered: false, reason: "request_failed" };
    }

    return { delivered: true };
  } catch (error) {
    console.error(`[webhook] ${event} request failed:`, error);
    return { delivered: false, reason: "request_failed" };
  }
}

export async function dispatchWebhook(companyId: string, event: string, data: Record<string, unknown>) {
  void deliverWebhook(companyId, event, data);
}
