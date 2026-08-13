CREATE TABLE "template_sectors" (
  "template_id" UUID NOT NULL,
  "sector_id" UUID NOT NULL,
  CONSTRAINT "template_sectors_pkey" PRIMARY KEY ("template_id", "sector_id"),
  CONSTRAINT "template_sectors_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "template_sectors_sector_id_fkey"
    FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "template_sectors_sector_id_idx" ON "template_sectors"("sector_id");
