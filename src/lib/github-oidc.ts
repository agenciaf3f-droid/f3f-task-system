import { createRemoteJWKSet, jwtVerify } from "jose";

const GITHUB_JWKS = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);
const GITHUB_REPOSITORY = "agenciaf3f-droid/f3f-task-system";

/**
 * Autoriza uma chamada de cron vinda do GitHub Actions.
 *
 * Aceita duas provas de identidade:
 * 1. `Bearer ${CRON_SECRET}` — para disparo manual.
 * 2. Token OIDC assinado pelo GitHub, amarrado a este repositório, à branch
 *    `main` e ao workflow informado. É o caminho do agendamento, e não depende
 *    de segredo de longa duração guardado no repo (que é público).
 */
export async function isAuthorizedCronRequest(
  request: Request,
  { audience, workflowFile }: { audience: string; workflowFile: string },
): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (secret && authorization === `Bearer ${secret}`) return true;

  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, GITHUB_JWKS, {
      issuer: "https://token.actions.githubusercontent.com",
      audience,
    });
    return payload.repository === GITHUB_REPOSITORY
      && payload.ref === "refs/heads/main"
      && payload.workflow_ref
        === `${GITHUB_REPOSITORY}/.github/workflows/${workflowFile}@refs/heads/main`
      && (
        payload.event_name === "push"
        || payload.event_name === "schedule"
        || payload.event_name === "workflow_dispatch"
      );
  } catch {
    return false;
  }
}
