import { NextResponse } from "next/server";
import { syncCalendarToSystem } from "@/lib/calendar-sync";

/**
 * Cron handler — sincroniza Google Calendar → Meeting.
 *
 * Vercel Cron envia GET com header `Authorization: Bearer ${CRON_SECRET}`.
 * Também aceita POST com mesma autenticação para trigger manual.
 */
async function handle(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const expected = process.env.CRON_SECRET;

  // Aceita: (a) chamada interna do Vercel Cron OU (b) Bearer token correto
  const okBearer = expected && authHeader === `Bearer ${expected}`;
  if (!isVercelCron && !okBearer) {
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
