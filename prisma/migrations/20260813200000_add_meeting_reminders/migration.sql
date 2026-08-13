-- Confirmação do cliente pelo botão do lembrete de véspera
ALTER TABLE "meetings"
  ADD COLUMN IF NOT EXISTS "client_response" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "client_responded_at" TIMESTAMP(3);

-- Lembretes já disparados. A unique (meeting_id, kind) é a trava de
-- idempotência: o cron roda a cada 5 min e enxerga a mesma reunião vencida
-- em várias execuções, mas só a primeira consegue inserir a linha.
CREATE TABLE IF NOT EXISTS "meeting_reminders" (
  "id" UUID NOT NULL,
  "meeting_id" UUID NOT NULL,
  "kind" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "destination" VARCHAR(255),
  "detail" VARCHAR(255),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meeting_reminders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meeting_reminders_meeting_id_fkey"
    FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "meeting_reminders_meeting_id_kind_key"
  ON "meeting_reminders"("meeting_id", "kind");

CREATE INDEX IF NOT EXISTS "meeting_reminders_created_at_idx"
  ON "meeting_reminders"("created_at");
