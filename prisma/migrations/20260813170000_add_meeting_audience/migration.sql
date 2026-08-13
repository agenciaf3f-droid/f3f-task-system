CREATE TABLE "meeting_audience" (
  "meeting_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  CONSTRAINT "meeting_audience_pkey" PRIMARY KEY ("meeting_id", "user_id"),
  CONSTRAINT "meeting_audience_meeting_id_fkey"
    FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "meeting_audience_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "meeting_audience_user_id_idx" ON "meeting_audience"("user_id");
