/**
 * Aponta o webhook da instância UAZAPI para a rota que recebe os cliques de
 * botão dos lembretes de reunião.
 *
 *   npm run uazapi:webhook            # mostra o que faria, sem aplicar
 *   npm run uazapi:webhook -- --apply # aplica na instância
 *
 * Roda só com as variáveis de ambiente já usadas pela app — nenhum token vai
 * para a linha de comando, para não ficar no histórico do shell.
 */

const APPLY = process.argv.includes("--apply");

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Faltou ${name} no ambiente.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const serverUrl = required("UAZAPI_SERVER_URL").replace(/\/$/, "");
  const token = required("UAZAPI_INSTANCE_TOKEN");
  const appUrl = required("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  const webhookToken = required("UAZAPI_WEBHOOK_TOKEN");

  const target = `${appUrl}/api/webhooks/uazapi?token=${encodeURIComponent(webhookToken)}`;

  const payload = {
    enabled: true,
    url: target,
    events: ["messages"],
    // Sem isto a instância devolve as próprias mensagens que a app envia e o
    // webhook processa o próprio eco.
    excludeMessages: ["wasSentByApi"],
  };

  const redacted = `${appUrl}/api/webhooks/uazapi?token=***`;
  console.log(`Instância : ${serverUrl}`);
  console.log(`Webhook   : ${redacted}`);
  console.log(`Eventos   : ${payload.events.join(", ")}`);
  console.log(`Excluindo : ${payload.excludeMessages.join(", ")}`);

  if (!APPLY) {
    console.log("\nSimulação — nada foi alterado. Rode com --apply para valer.");
    return;
  }

  const response = await fetch(`${serverUrl}/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    console.error(`\nUAZAPI respondeu HTTP ${response.status}.`);
    process.exit(1);
  }

  console.log("\nWebhook configurado.");
}

void main();
