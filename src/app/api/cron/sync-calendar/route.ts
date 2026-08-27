import { NextResponse } from "next/server";
import { syncCalendarToSystem } from "@/lib/calendar-sync";
import { isAuthorizedCronRequest } from "@/lib/github-oidc";

/**
 * Cron handler — sincroniza Google Calendar → Meeting.
 *
 * Vercel Cron envia GET com header `Authorization: Bearer ${CRON_SECRET}`.
 * Também aceita POST com mesma autenticação para trigger manual.
 */
async function handle(request: Request): Promise<NextResponse> {
  // Chamada interna do Vercel Cron continua valendo. Além dela, aceita a
  // identidade assinada do GitHub Actions — mesmo caminho já usado pelos
  // lembretes —, que é o que dá um gatilho manual sem espalhar o CRON_SECRET.
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const authorized = isVercelCron || await isAuthorizedCronRequest(request, {
    audience: "f3f-task-calendar-sync",
    workflowFile: "sync-calendar.yml",
  });
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await syncCalendarToSystem();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

// Vercel Cron máx 300s; sync sob 100 eventos roda em <30s.
export const maxDuration = 300;
