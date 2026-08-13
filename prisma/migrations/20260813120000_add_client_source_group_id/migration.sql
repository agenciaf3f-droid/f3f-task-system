ALTER TABLE "clients" ADD COLUMN "source_group_id" VARCHAR(255);

CREATE UNIQUE INDEX "clients_company_id_source_group_id_key"
ON "clients"("company_id", "source_group_id");
