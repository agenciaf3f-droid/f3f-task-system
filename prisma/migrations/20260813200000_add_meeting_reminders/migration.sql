-- Confirmação do cliente pelo botão do lembrete de véspera
ALTER TABLE "meetings"
  ADD COLUMN IF NOT EXISTS "client_response" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "client_responded_at" TIMESTAMP(3);

-- Lembretes agendados na fila da UAZAPI.
--
-- "folder_id" é a campanha do lado de lá; é por ele que o lembrete é cancelado
-- quando a reunião cai. A unique (meeting_id, kind) impede agendar o mesmo
-- lembrete duas vezes.
CREATE TABLE IF NOT EXISTS "meeting_reminders" (
  "id" UUID NOT NULL,
  "meeting_id" UUID NOT NULL,
  "kind" VARCHAR(20) NOT NULL,
  "scheduled_for" TIMESTAMP(3) NOT NULL,
  "folder_id" VARCHAR(64),
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
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

-- Serve o reconciliador diário, que varre o que ficou pendente/agendado.
CREATE INDEX IF NOT EXISTS "meeting_reminders_status_scheduled_for_idx"
  ON "meeting_reminders"("status", "scheduled_for");
