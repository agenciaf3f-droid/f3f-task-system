import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const tokenHash = createHash("sha256")
    .update(authorization.slice("Bearer ".length))
    .digest("hex");

  return tokenHash === "3930fb7a9a99cc3dae417b58f54434ef8fb795ef4e1229eaba49b37e8b48424a";
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "client_id" UUID');
    await prisma.$executeRawUnsafe(`
      UPDATE "tasks"
      SET "client_id" = "projects"."client_id"
      FROM "projects"
      WHERE "tasks"."project_id" = "projects"."id"
        AND "tasks"."client_id" IS NULL
    `);
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'tasks_client_id_fkey'
        ) THEN
          ALTER TABLE "tasks"
          ADD CONSTRAINT "tasks_client_id_fkey"
          FOREIGN KEY ("client_id") REFERENCES "clients"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "tasks_client_id_idx" ON "tasks"("client_id")');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Task client migration failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
