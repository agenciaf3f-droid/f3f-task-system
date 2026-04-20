import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, unknown> = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL ? "SET (" + process.env.DATABASE_URL.split("@")[1] + ")" : "MISSING",
    SESSION_SECRET: process.env.SESSION_SECRET ? `SET (length: ${process.env.SESSION_SECRET.length})` : "MISSING",
  };

  // Test DB connection
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "OK — connected";
  } catch (e: unknown) {
    checks.db = "ERROR: " + (e instanceof Error ? e.message : String(e));
  }

  // Test session module
  try {
    await import("@/lib/session");
    checks.session = "OK";
  } catch (e: unknown) {
    checks.session = "ERROR: " + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json(checks);
}
