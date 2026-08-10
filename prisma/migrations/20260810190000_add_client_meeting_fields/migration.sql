ALTER TABLE "clients"
ADD COLUMN "meeting_plan" VARCHAR(100),
ADD COLUMN "whatsapp_group_id" VARCHAR(255),
ADD COLUMN "whatsapp_group_name" VARCHAR(255);

CREATE INDEX "clients_whatsapp_group_id_idx" ON "clients"("whatsapp_group_id");

ALTER TABLE "booking_magic_links"
ALTER COLUMN "client_email" DROP NOT NULL;
