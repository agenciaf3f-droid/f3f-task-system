-- Indexes pra acelerar sync (lookup batched por googleEventId)
-- e queries de slots route (date + status combinados).
CREATE INDEX IF NOT EXISTS "meetings_google_event_id_idx" ON "meetings"("google_event_id");
CREATE INDEX IF NOT EXISTS "meetings_date_status_idx" ON "meetings"("date", "status");
