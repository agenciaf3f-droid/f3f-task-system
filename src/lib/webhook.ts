import { prisma } from "@/lib/prisma";

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export async function dispatchWebhook(companyId: string, event: string, data: Record<string, unknown>) {
  try {
    const config = await prisma.webhookConfig.findUnique({
      where: { companyId },
    });

    if (!config || !config.isActive || !config.url) return;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.secret) {
      headers["X-Webhook-Secret"] = config.secret;
    }

    fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // fire-and-forget — never block the main flow
  }
}
