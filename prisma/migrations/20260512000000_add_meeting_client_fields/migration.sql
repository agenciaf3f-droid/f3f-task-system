-- Add client data fields to Meeting
ALTER TABLE "meetings"
ADD COLUMN IF NOT EXISTS "client_name" TEXT,
ADD COLUMN IF NOT EXISTS "client_group_id" TEXT,
ADD COLUMN IF NOT EXISTS "client_plan" TEXT;
