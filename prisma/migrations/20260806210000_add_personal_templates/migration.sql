ALTER TABLE "templates"
  ADD COLUMN IF NOT EXISTS "is_personal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "templates_company_id_is_personal_created_by_idx"
  ON "templates"("company_id", "is_personal", "created_by");
