ALTER TABLE "tasks" ADD COLUMN "client_id" UUID;

UPDATE "tasks"
SET "client_id" = "projects"."client_id"
FROM "projects"
WHERE "tasks"."project_id" = "projects"."id"
  AND "tasks"."client_id" IS NULL;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "clients"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tasks_client_id_idx" ON "tasks"("client_id");
