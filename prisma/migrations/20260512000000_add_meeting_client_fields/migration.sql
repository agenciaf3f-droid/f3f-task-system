-- Add client data fields to Meeting
ALTER TABLE "meetings"
ADD COLUMN "client_name" TEXT,
ADD COLUMN "client_group_id" TEXT,
ADD COLUMN "client_plan" TEXT;
