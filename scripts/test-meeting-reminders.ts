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

function testUnreadReplyDetection({ looksLikeUnreadButtonReply }: RemindersModule) {
  // Só decide se vale logar. Mensagem comum de grupo — o caso de longe mais
  // frequente — precisa sair barato, sem varrer o payload.
  assert.equal(looksLikeUnreadButtonReply({ message: { messageType: "conversation" } }), false);
  assert.equal(looksLikeUnreadButtonReply({ message: { buttonOrListid: "" } }), false);
  assert.equal(looksLikeUnreadButtonReply(null), false);
  assert.equal(looksLikeUnreadButtonReply("texto"), false);

  assert.equal(
    looksLikeUnreadButtonReply({ message: { messageType: "ButtonsResponseMessage" } }),
    true,
  );
  assert.equal(looksLikeUnreadButtonReply({ messageType: "ListResponseMessage" }), true);
  assert.equal(looksLikeUnreadButtonReply({ message: { buttonOrListid: "algo" } }), true);
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

  // Estrutura REAL de uma resposta de botão, capturada em /message/find contra
  // a instância. Não é invenção: a UAZAPI não documenta esse evento.
  //
  // O ponto crítico está em contextInfo.quotedMessage — a citação da mensagem
  // original carrega as DUAS opções dentro de buttonParamsJSON. Ou seja, o
  // payload de uma CONFIRMAÇÃO contém a string "f3f-nao:". Ler o JSON inteiro
  // atrás do primeiro id cancelaria a reunião que o cliente acabou de aceitar.
  const realReply = (tapped: "sim" | "nao") => ({
    buttonOrListid: `f3f-${tapped}:${meetingId}`,
    chatid: "120363290811576538@g.us",
    fromMe: false,
    messageType: "ButtonsResponseMessage",
    quoted: "3EB0D1F34298B7A228F0CD",
    content: {
      Response: { SelectedDisplayText: tapped === "sim" ? "Sim, tudo certo!" : "Não vou conseguir!" },
      selectedButtonID: `f3f-${tapped}:${meetingId}`,
      type: 1,
      contextInfo: {
        stanzaID: "3EB0D1F34298B7A228F0CD",
        quotedMessage: {
          interactiveMessage: {
            InteractiveMessage: {
              NativeFlowMessage: {
                buttons: [
                  {
                    name: "quick_reply",
                    buttonParamsJSON: `{"id": "f3f-sim:${meetingId}", "display_text": "Sim, tudo certo!", "disabled": false}`,
                  },
                  {
                    name: "quick_reply",
                    buttonParamsJSON: `{"id": "f3f-nao:${meetingId}", "display_text": "Não vou conseguir!", "disabled": false}`,
                  },
                ],
              },
            },
            header: { Media: null, title: "🤖 Opa Arthur!" },
            body: { text: "\nEstou passando para confirmar…" },
            footer: { Media: null, text: "" },
          },
        },
      },
    },
  });

  const confirmReply = realReply("sim");
  // A prova de que o teste vale: a opção oposta ESTÁ no payload.
  assert.ok(JSON.stringify(confirmReply).includes(`f3f-nao:${meetingId}`));
  assert.deepEqual(extractButtonResponse(confirmReply), { meetingId, response: "confirmed" });

  const declineReply = realReply("nao");
  assert.ok(JSON.stringify(declineReply).includes(`f3f-sim:${meetingId}`));
  assert.deepEqual(extractButtonResponse(declineReply), { meetingId, response: "declined" });

  // Envelopado como o webhook entrega (evento + mensagem aninhada).
  assert.deepEqual(
    extractButtonResponse({ event: "messages", message: confirmReply }),
    { meetingId, response: "confirmed" },
  );

  // Eco da mensagem que NÓS enviamos: buttonOrListid vem vazio e os dois ids
  // aparecem no corpo. Não pode ser lido como resposta do cliente.
  const echoOfSentMessage = {
    buttonOrListid: "",
    fromMe: true,
    messageType: "NativeFlowMessage",
    sendPayload: {
      choices: [`Sim, tudo certo!|f3f-sim:${meetingId}`, `Não vou conseguir!|f3f-nao:${meetingId}`],
    },
  };
  assert.equal(extractButtonResponse(echoOfSentMessage), null);

  // Sem chave "selected", um payload que cita as duas opções é ambíguo:
  // recusar é o comportamento correto, agir por adivinhação não.
  assert.equal(
    extractButtonResponse({
      buttons: [{ buttonId: `f3f-sim:${meetingId}` }, { buttonId: `f3f-nao:${meetingId}` }],
    }),
    null,
  );

  // Id nosso solto num campo qualquer NÃO conta. Ler o payload inteiro exigiria
  // serializá-lo a cada mensagem de cada grupo — custo que não se paga, já que o
  // formato real é conhecido. Se a UAZAPI mudar, o webhook loga e a gente ajusta.
  assert.equal(extractButtonResponse({ payload: { texto: `f3f-nao:${meetingId}` } }), null);

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
    testUnreadReplyDetection(reminders);
    await testButtonSend(whatsapp);

    console.log("Meeting reminder checks passed");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main();
