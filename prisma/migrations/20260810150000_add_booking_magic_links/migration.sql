CREATE TABLE "booking_magic_links" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "manager_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "client_email" VARCHAR(255) NOT NULL,
    "client_name" VARCHAR(255) NOT NULL,
    "client_plan" VARCHAR(255),
    "client_group_id" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "opened_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_magic_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_magic_links_token_hash_key" ON "booking_magic_links"("token_hash");
CREATE INDEX "booking_magic_links_client_id_expires_at_idx" ON "booking_magic_links"("client_id", "expires_at");
CREATE INDEX "booking_magic_links_manager_id_idx" ON "booking_magic_links"("manager_id");
CREATE INDEX "booking_magic_links_expires_at_revoked_at_idx" ON "booking_magic_links"("expires_at", "revoked_at");

ALTER TABLE "booking_magic_links"
ADD CONSTRAINT "booking_magic_links_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_magic_links"
ADD CONSTRAINT "booking_magic_links_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_magic_links"
ADD CONSTRAINT "booking_magic_links_manager_id_fkey"
FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_magic_links"
ADD CONSTRAINT "booking_magic_links_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
