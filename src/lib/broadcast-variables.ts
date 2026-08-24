/**
 * Variáveis que podem ser usadas no texto de um disparo.
 *
 * Fica fora de actions.ts de propósito: aquele arquivo é "use server" e só pode
 * exportar funções async, então uma constante ou uma função síncrona ali
 * quebram o build. A tela também precisa dessa lista para mostrar os botões.
 */

export const BROADCAST_VARIABLES = [
  { token: "{{nome}}", label: "Nome do cliente", example: "Erica Ranzani" },
  { token: "{{primeiro_nome}}", label: "Primeiro nome", example: "Erica" },
  { token: "{{id_cliente}}", label: "ID do cliente", example: "401" },
] as const;

export type RecipientContext = { name: string; externalId: string | null };

/**
 * Tira o rótulo interno entre parênteses que abre o nome de alguns cadastros.
 *
 * Três clientes ativos são gravados como "(Kika) Erica Ranzani" — o "(Kika)" é
 * o estúdio/dono, controle interno da agência. O nome vem assim da planilha e
 * `extractClientName` não mexe nisso, então sem esta limpeza {{primeiro_nome}}
 * viraria "(Kika)" e o cliente receberia "Oi (Kika)!".
 */
function displayName(rawName: string): string {
  const withoutTag = rawName.trim().replace(/^\([^)]*\)\s*/, "").trim();
  // Se o nome for só o rótulo, é melhor manter o original do que mandar vazio.
  return withoutTag || rawName.trim();
}

export function applyVariables(template: string, client: RecipientContext): string {
  const name = displayName(client.name);
  const firstName = name.split(/\s+/)[0] ?? name;
  return template
    .replace(/\{\{\s*nome\s*\}\}/gi, name)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, firstName)
    // Cliente sem ID na planilha não pode deixar "{{id_cliente}}" cru na
    // mensagem; melhor sair vazio do que expor a variável para o cliente.
    .replace(/\{\{\s*id_cliente\s*\}\}/gi, client.externalId ?? "");
}
