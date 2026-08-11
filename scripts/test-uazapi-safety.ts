import assert from "node:assert/strict";
import { sendWhatsAppText, verifyWhatsAppGroupDestination } from "../src/lib/whatsapp";

const authorizedGroup = "120363290811576538@g.us";
const originalFetch = globalThis.fetch;
let requestCount = 0;
let destination = "";
let groupListBody: Record<string, unknown> | null = null;

process.env.UAZAPI_MODE = "test";
process.env.UAZAPI_SERVER_URL = "https://example.uazapi.com";
process.env.UAZAPI_INSTANCE_TOKEN = "test-token";
process.env.UAZAPI_TEST_GROUP_ID = authorizedGroup;

globalThis.fetch = (async (_input, init) => {
  requestCount += 1;
  if (String(_input).endsWith("/group/list?force=false")) {
    groupListBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json([
      { JID: authorizedGroup, Name: "Nome atual diferente da planilha" },
    ]);
  }
  const body = JSON.parse(String(init?.body)) as { number?: string };
  destination = body.number ?? "";
  return new Response("{}", { status: 200 });
}) as typeof fetch;

async function main() {
  try {
    assert.equal(await verifyWhatsAppGroupDestination(authorizedGroup), true);
    assert.equal(await verifyWhatsAppGroupDestination("120363000000000000@g.us"), false);
    assert.deepEqual(groupListBody, {
      limit: 1000,
      offset: 0,
      force: false,
      noParticipants: true,
    });

    const forced = await sendWhatsAppText({
      groupId: "120363000000000000@g.us",
      message: "Teste",
      trackId: "test-1",
    });
    assert.equal(forced.delivered, true);
    assert.equal(destination, authorizedGroup);
    assert.equal(requestCount, 3);

    process.env.UAZAPI_TEST_GROUP_ID = "120363999999999999@g.us";
    const blocked = await sendWhatsAppText({
      groupId: authorizedGroup,
      message: "Não deve enviar",
      trackId: "test-2",
    });
    assert.deepEqual(blocked, { delivered: false, reason: "not_configured" });
    assert.equal(requestCount, 3);

    console.log("UAZAPI safety checks passed");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main();
