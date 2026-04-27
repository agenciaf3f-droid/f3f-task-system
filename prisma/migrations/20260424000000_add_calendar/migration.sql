-- Add calendar_token to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "calendar_token" VARCHAR(32) UNIQUE;

-- CalendarAvailability
CREATE TABLE IF NOT EXISTS "calendar_availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calendar_availability_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "calendar_availability_user_id_day_of_week_key" UNIQUE ("user_id", "day_of_week"),
    CONSTRAINT "calendar_availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "calendar_availability_user_id_idx" ON "calendar_availability"("user_id");

-- Meeting
CREATE TABLE IF NOT EXISTS "meetings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    "booked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "meetings_user_id_date_start_time_key" UNIQUE ("user_id", "date", "start_time"),
    CONSTRAINT "meetings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "meetings_user_id_date_idx" ON "meetings"("user_id", "date");
