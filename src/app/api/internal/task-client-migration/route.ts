import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request) {
  const token = process.env.TASK_CLIENT_MIGRATION_TOKEN;
  return Boolean(token) && request.headers.get("authorization") === `Bearer ${token}`;
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
