import { NextResponse } from "next/server";
import { syncClientsFromPublishedSheet } from "@/lib/client-sheet-sync";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const result = await syncClientsFromPublishedSheet({ dryRun });
    console.info("[client-sheet-sync] completed", {
      dryRun,
      rows: result.rows,
      created: result.created,
      updated: result.updated,
      archived: result.archived,
      skipped: result.skipped,
    });
    return NextResponse.json({ ok: true, dryRun, ...result });
  } catch (error) {
    console.error("[client-sheet-sync] failed", error);
    return NextResponse.json({ ok: false, error: "sync_failed" }, { status: 500 });
  }
}

export const maxDuration = 60;
export const dynamic = "force-dynamic";
