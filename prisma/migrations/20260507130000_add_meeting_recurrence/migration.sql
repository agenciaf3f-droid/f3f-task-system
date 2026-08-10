ALTER TABLE "meetings"
  ADD COLUMN IF NOT EXISTS "recurrence_rule" JSONB,
  ADD COLUMN IF NOT EXISTS "recurrence_parent_id" UUID;

CREATE INDEX IF NOT EXISTS "meetings_recurrence_parent_id_idx"
  ON "meetings"("recurrence_parent_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meetings_recurrence_parent_id_fkey'
  ) THEN
    ALTER TABLE "meetings"
      ADD CONSTRAINT "meetings_recurrence_parent_id_fkey"
      FOREIGN KEY ("recurrence_parent_id")
      REFERENCES "meetings"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
