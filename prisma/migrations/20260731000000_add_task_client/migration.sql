ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "client_id" UUID;

UPDATE "tasks"
SET "client_id" = "projects"."client_id"
FROM "projects"
WHERE "tasks"."project_id" = "projects"."id"
  AND "tasks"."client_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_client_id_fkey'
  ) THEN
    ALTER TABLE "tasks"
    ADD CONSTRAINT "tasks_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tasks_client_id_idx" ON "tasks"("client_id");
