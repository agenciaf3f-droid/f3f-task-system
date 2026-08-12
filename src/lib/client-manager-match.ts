function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const STOPWORDS = new Set([
  "reuniao", "daily", "apresentacao", "call", "meeting", "checkin", "check-in",
  "com", "para", "de", "da", "do", "dos", "das", "a", "o", "e",
]);

function tokenize(value: string): string[] {
  return normalizeName(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function matchScore(eventTokens: string[], clientTokens: string[]): number {
  if (eventTokens.length === 0) return 0;
  return eventTokens.filter((eventToken) =>
    clientTokens.some(
      (clientToken) =>
        eventToken === clientToken ||
        eventToken.startsWith(clientToken) ||
        clientToken.startsWith(eventToken),
    ),
  ).length;
}

export type ClientManagerIndexItem = {
  tokens: string[];
  managerId: string;
  norm: string;
};

export function buildClientManagerIndex(
  clients: { name: string; managerId: string | null }[],
): ClientManagerIndexItem[] {
  return clients
    .filter((client): client is { name: string; managerId: string } => client.managerId !== null)
    .map((client) => ({
      managerId: client.managerId,
      norm: normalizeName(client.name),
      tokens: tokenize(client.name),
    }));
}

export function findManagerByClientName(
  clientName: string | null,
  clients: ClientManagerIndexItem[],
): string | null {
  if (!clientName) return null;
  const norm = normalizeName(clientName);
  if (!norm) return null;

  const exactMatch = clients.find((client) => client.norm === norm);
  if (exactMatch) return exactMatch.managerId;

  const eventTokens = tokenize(clientName);
  if (eventTokens.length === 0) return null;

  let bestScore = 0;
  let bestManagers = new Set<string>();
  for (const client of clients) {
    const score = matchScore(eventTokens, client.tokens);
    if (score === 0) continue;
    if (score > bestScore) {
      bestScore = score;
      bestManagers = new Set([client.managerId]);
    } else if (score === bestScore) {
      bestManagers.add(client.managerId);
    }
  }

  return bestScore >= 1 && bestManagers.size === 1
    ? Array.from(bestManagers)[0]
    : null;
}
