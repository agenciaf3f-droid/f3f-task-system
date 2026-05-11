ALTER TABLE "meetings"
  ADD COLUMN IF NOT EXISTS "recurrence_rule" JSONB,
  ADD COLUMN IF NOT EXISTS "recurrence_parent_id" UUID;

CREATE INDEX IF NOT EXISTS "meetings_recurrence_parent_id_idx"
  ON "meetings"("recurrence_parent_id");

ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_recurrence_parent_id_fkey"
  FOREIGN KEY ("recurrence_parent_id")
  REFERENCES "meetings"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
