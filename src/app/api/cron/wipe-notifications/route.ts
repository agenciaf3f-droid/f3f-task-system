import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-time wipe: apaga TODAS notificações de todos os users.
// Proteção: mesmo padrão dos outros crons (header x-vercel-cron: 1 OU Bearer CRON_SECRET).
async function handle(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const expected = process.env.CRON_SECRET;
  const okBearer = expected && authHeader === `Bearer ${expected}`;
  if (!isVercelCron && !okBearer) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await prisma.notification.deleteMany({});
  return NextResponse.json({ ok: true, deleted: result.count });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
