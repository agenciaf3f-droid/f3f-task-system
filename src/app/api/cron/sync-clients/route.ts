import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { auditBookingDestinations, syncClientsFromPublishedSheet } from "@/lib/client-sheet-sync";

const GITHUB_JWKS = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);
const GITHUB_REPOSITORY = "agenciaf3f-droid/f3f-task-system";
const GITHUB_WORKFLOW_REF =
  `${GITHUB_REPOSITORY}/.github/workflows/sync-clients.yml@refs/heads/main`;

async function isAuthorized(request: Request): Promise<boolean> {
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
      audience: "f3f-task-client-sync",
    });
    return payload.repository === GITHUB_REPOSITORY
      && payload.ref === "refs/heads/main"
      && payload.workflow_ref === GITHUB_WORKFLOW_REF
      && (
        payload.event_name === "push"
        || payload.event_name === "schedule"
        || payload.event_name === "workflow_dispatch"
      );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!await isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const result = await syncClientsFromPublishedSheet({ dryRun });
    const bookingAudit = await auditBookingDestinations();
    console.info("[client-sheet-sync] completed", {
      dryRun,
      rows: result.rows,
      created: result.created,
      updated: result.updated,
      archived: result.archived,
      deduplicated: result.deduplicated,
      skipped: result.skipped,
    });
    return NextResponse.json({ ok: true, dryRun, ...result, bookingAudit });
  } catch (error) {
    console.error("[client-sheet-sync] failed", error);
    return NextResponse.json({ ok: false, error: "sync_failed" }, { status: 500 });
  }
}

export const maxDuration = 60;
export const dynamic = "force-dynamic";
