import assert from "node:assert/strict";

const authorizedGroup = "120363290811576538@g.us";

// Precisa estar no ambiente antes do import dos módulos: o singleton do Prisma
// é construído no topo de src/lib/prisma.ts e whatsapp.ts lê a config daqui.
// Por isso os imports são dinâmicos, dentro de main().
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/db";
process.env.UAZAPI_MODE = "test";
process.env.UAZAPI_SERVER_URL = "https://example.uazapi.com";
process.env.UAZAPI_INSTANCE_TOKEN = "test-token";
process.env.UAZAPI_TEST_GROUP_ID = authorizedGroup;

type RemindersModule = typeof import("../src/lib/meeting-reminders");
type WhatsAppModule = typeof import("../src/lib/whatsapp");

const originalFetch = globalThis.fetch;
let lastPath = "";
let lastBody: Record<string, unknown> | null = null;

globalThis.fetch = (async (input, init) => {
  lastPath = new URL(String(input)).pathname;
  lastBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
  return new Response("{}", { status: 200 });
}) as typeof fetch;

function testMessages({ buildReminderMessage }: RemindersModule) {
  const ctx = { clientName: "Rayanne", meetingDate: "2026-08-20", startTime: "14:00" };

  // 2026-08-20 é quinta-feira.
  assert.equal(
    buildReminderMessage("day_before", ctx),
    "🤖 Opa Rayanne!\n\nEstou passando para confirmar sua reunião com nossa equipe amanhã quinta-feira às 14:00\n\nEstá tudo certo para você participar?👇",
  );
  assert.equal(
    buildReminderMessage("morning", ctx),
    "🤖 Passando para te lembrar o seguinte Rayanne👇\n\n🗓️ Sua reunião com a F3F é hoje às 14:00",
  );
  assert.equal(
    buildReminderMessage("hour_before", ctx),
    "🤖 Rayanne, tudo bem?\n\n*Em menos de 1 hora* iremos te enviar o link da nossa reunião!",
  );
  assert.equal(
    buildReminderMessage("minutes_before", ctx),
    "🤖 Faltam alguns minutos para nossa reunião!\n\nIremos te enviar o link aqui mesmo!",
  );
}

function testButtonExtraction({ extractButtonResponse }: RemindersModule) {
  const meetingId = "3f2b9c14-8d5a-4e67-9b01-2c7d8e4f5a6b";
  const other = "9a1b2c3d-4e5f-4071-8293-a4b5c6d7e8f9";

  // O caso que importa: a resposta vem acompanhada da mensagem original citada,
  // que lista as DUAS opções. Só a chave "selected" define a escolha — uma
  // leitura ingênua cancelaria uma reunião que o cliente acabou de confirmar.
  const replyWithQuote = {
    event: "messages",
    message: {
      buttonsResponseMessage: {
        selectedButtonId: `f3f-sim:${meetingId}`,
        selectedDisplayText: "Sim, tudo certo!",
        contextInfo: {
          quotedMessage: {
            buttonsMessage: {
              buttons: [
                { buttonId: `f3f-sim:${meetingId}`, buttonText: { displayText: "Sim, tudo certo!" } },
                { buttonId: `f3f-nao:${meetingId}`, buttonText: { displayText: "Não vou conseguir!" } },
              ],
            },
          },
        },
      },
    },
  };
  assert.deepEqual(extractButtonResponse(replyWithQuote), { meetingId, response: "confirmed" });

  const declineWithQuote = structuredClone(replyWithQuote);
  declineWithQuote.message.buttonsResponseMessage.selectedButtonId = `f3f-nao:${meetingId}`;
  assert.deepEqual(extractButtonResponse(declineWithQuote), { meetingId, response: "declined" });

  // Formato real da instância, capturado em /message/find: o id do botão
  // tocado vem em `buttonOrListid`, enquanto a mensagem original citada carrega
  // as DUAS opções dentro de `buttonParamsJSON` (string com JSON embutido).
  const uazapiReply = {
    event: "messages",
    message: {
      buttonOrListid: `f3f-nao:${meetingId}`,
      chatid: "120363290811576538@g.us",
      fromMe: false,
      messageType: "NativeFlowMessage",
      text: "Não vou conseguir!",
      content: {
        InteractiveMessage: {
          NativeFlowMessage: {
            buttons: [
              {
                name: "quick_reply",
                buttonParamsJSON: `{"id": "f3f-sim:${meetingId}", "display_text": "Sim, tudo certo!"}`,
              },
              {
                name: "quick_reply",
                buttonParamsJSON: `{"id": "f3f-nao:${meetingId}", "display_text": "Não vou conseguir!"}`,
              },
            ],
          },
        },
      },
    },
  };
  assert.deepEqual(extractButtonResponse(uazapiReply), { meetingId, response: "declined" });

  // Mesmo payload, escolha oposta: tem de seguir a escolha, não a ordem dos
  // botões citados.
  const uazapiConfirm = structuredClone(uazapiReply);
  uazapiConfirm.message.buttonOrListid = `f3f-sim:${meetingId}`;
  assert.deepEqual(extractButtonResponse(uazapiConfirm), { meetingId, response: "confirmed" });

  // Mensagem que NÓS enviamos volta com buttonOrListid vazio — não pode ser
  // lida como resposta do cliente.
  const echoOfSentMessage = structuredClone(uazapiReply);
  echoOfSentMessage.message.buttonOrListid = "";
  echoOfSentMessage.message.fromMe = true;
  assert.equal(extractButtonResponse(echoOfSentMessage), null);

  // Sem chave "selected", um payload que cita as duas opções é ambíguo:
  // recusar é o comportamento correto, agir por adivinhação não.
  assert.equal(
    extractButtonResponse({
      buttons: [{ buttonId: `f3f-sim:${meetingId}` }, { buttonId: `f3f-nao:${meetingId}` }],
    }),
    null,
  );

  // Formato desconhecido, mas mencionando uma única opção: aceita.
  assert.deepEqual(
    extractButtonResponse({ payload: { texto: `f3f-nao:${meetingId}` } }),
    { meetingId, response: "declined" },
  );

  // Ruído sem id nosso, e id de outra reunião não vira confirmação errada.
  assert.equal(extractButtonResponse({ message: { conversation: "oi" } }), null);
  assert.deepEqual(
    extractButtonResponse({ selectedButtonId: `f3f-sim:${other}` }),
    { meetingId: other, response: "confirmed" },
  );
}

async function testButtonSend({ sendWhatsAppButtons }: WhatsAppModule) {
  const meetingId = "3f2b9c14-8d5a-4e67-9b01-2c7d8e4f5a6b";

  // Destino de cliente real é substituído pelo grupo de homologação.
  const sent = await sendWhatsAppButtons({
    groupId: "120363000000000000@g.us",
    message: "Confirma?",
    trackId: "test-buttons",
    buttons: [
      { label: "Sim, tudo certo!", id: `f3f-sim:${meetingId}` },
      { label: "Não vou conseguir!", id: `f3f-nao:${meetingId}` },
    ],
  });
  assert.equal(sent.delivered, true);
  assert.equal(lastPath, "/send/menu");
  assert.equal(lastBody?.number, authorizedGroup);
  assert.equal(lastBody?.type, "button");
  assert.deepEqual(lastBody?.choices, [
    `Sim, tudo certo!|f3f-sim:${meetingId}`,
    `Não vou conseguir!|f3f-nao:${meetingId}`,
  ]);

  // "|" no rótulo quebraria o parsing do id pela UAZAPI.
  const rejected = await sendWhatsAppButtons({
    groupId: authorizedGroup,
    message: "x",
    trackId: "t",
    buttons: [{ label: "a|b", id: "f3f-sim:x" }],
  });
  assert.deepEqual(rejected, { delivered: false, reason: "rejected" });

  // Sem o grupo autorizado configurado, nada sai em modo teste.
  process.env.UAZAPI_TEST_GROUP_ID = "120363999999999999@g.us";
  const blocked = await sendWhatsAppButtons({
    groupId: authorizedGroup,
    message: "Não deve enviar",
    trackId: "t",
    buttons: [{ label: "Sim", id: "f3f-sim:x" }],
  });
  assert.deepEqual(blocked, { delivered: false, reason: "not_configured" });
  process.env.UAZAPI_TEST_GROUP_ID = authorizedGroup;
}

async function main() {
  try {
    const reminders = await import("../src/lib/meeting-reminders");
    const whatsapp = await import("../src/lib/whatsapp");

    testMessages(reminders);
    testButtonExtraction(reminders);
    await testButtonSend(whatsapp);

    console.log("Meeting reminder checks passed");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main();
