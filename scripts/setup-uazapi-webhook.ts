/**
 * Registra um webhook ADICIONAL na instância UAZAPI, apontando para a rota que
 * recebe os cliques de botão dos lembretes de reunião.
 *
 *   npm run uazapi:webhook            # mostra o que faria, sem aplicar
 *   npm run uazapi:webhook -- --apply # aplica na instância
 *
 * Usa `action: "add"` de propósito. O "modo simples" da UAZAPI (sem action)
 * gerencia UM único webhook por instância e sobrescreveria o que já existe —
 * a instância também alimenta https://controle.agenciaf3f.com.br, que pararia
 * de receber eventos.
 *
 * Lê tudo do ambiente: nenhum token passa pela linha de comando, para não
 * ficar no histórico do shell.
 */

const APPLY = process.argv.includes("--apply");

type Webhook = { id?: string; url?: string; enabled?: boolean; events?: string[] };

/** Mesmo domínio que os workflows do GitHub já chamam. */
const DEFAULT_APP_URL = "https://task.agenciaf3f.com.br";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Faltou ${name} no ambiente.`);
    process.exit(1);
  }
  return value;
}

/**
 * Base pública da app. `NEXT_PUBLIC_APP_URL` está vazia na Vercel hoje, então
 * aceita `--url=` e cai no domínio de produção conhecido.
 */
function resolveAppUrl(): string {
  const fromArg = process.argv.find((arg) => arg.startsWith("--url="))?.slice("--url=".length);
  const raw = fromArg?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL;
  return raw.replace(/\/$/, "");
}

/** Compara sem a query string, que carrega o segredo. */
function samePath(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin && ua.pathname === ub.pathname;
  } catch {
    return false;
  }
}

async function main() {
  const serverUrl = required("UAZAPI_SERVER_URL").replace(/\/$/, "");
  const token = required("UAZAPI_INSTANCE_TOKEN");
  const appUrl = resolveAppUrl();
  const webhookToken = required("UAZAPI_WEBHOOK_TOKEN");

  const target = `${appUrl}/api/webhooks/uazapi?token=${encodeURIComponent(webhookToken)}`;
  const redacted = `${appUrl}/api/webhooks/uazapi?token=***`;

  const existingResponse = await fetch(`${serverUrl}/webhook`, {
    headers: { token },
    signal: AbortSignal.timeout(20_000),
  });
  if (!existingResponse.ok) {
    console.error(`Não consegui listar os webhooks: HTTP ${existingResponse.status}.`);
    process.exit(1);
  }
  const existing: Webhook[] = await existingResponse.json();

  console.log(`Instância: ${serverUrl}`);
  console.log(`Webhooks já registrados: ${existing.length}`);
  for (const hook of existing) {
    const url = hook.url ?? "";
    console.log(`  - ${url.split("?")[0]} (${hook.enabled ? "ativo" : "inativo"})`);
  }

  if (existing.some((hook) => samePath(hook.url ?? "", target))) {
    console.log("\nO webhook dos lembretes já está registrado. Nada a fazer.");
    return;
  }

  console.log(`\nVai ADICIONAR (sem alterar os existentes):`);
  console.log(`  ${redacted}`);
  console.log(`  eventos: messages · excluindo: wasSentByApi`);

  if (!APPLY) {
    console.log("\nSimulação — nada foi alterado. Rode com --apply para valer.");
    return;
  }

  const response = await fetch(`${serverUrl}/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({
      action: "add",
      enabled: true,
      url: target,
      events: ["messages"],
      // Sem isto a instância devolve as próprias mensagens que a app envia e o
      // webhook processa o próprio eco.
      excludeMessages: ["wasSentByApi"],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    console.error(`\nUAZAPI respondeu HTTP ${response.status}.`);
    console.error((await response.text()).slice(0, 300));
    process.exit(1);
  }

  console.log("\nWebhook adicionado.");
}

void main();
