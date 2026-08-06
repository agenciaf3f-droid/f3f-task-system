import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const TOKEN_HASH = "936202ff4299293589ba264af82d5fb2637caf174e30cb13c099a1198ed766fb";

function hasValidToken(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;

  return createHash("sha256").update(token).digest("hex") === TOKEN_HASH;
}

export async function POST(request: NextRequest) {
  if (!hasValidToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$executeRawUnsafe(
    'ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "is_personal" BOOLEAN NOT NULL DEFAULT false',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "templates_company_id_is_personal_created_by_idx" ON "templates"("company_id", "is_personal", "created_by")',
  );

  return NextResponse.json({ ok: true });
}
