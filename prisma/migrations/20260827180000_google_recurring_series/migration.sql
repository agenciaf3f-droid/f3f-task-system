-- Vínculo com a série recorrente do Google Calendar.
--
-- O sync busca eventos com singleEvents: true, que expande a série em
-- ocorrências independentes. Sem guardar o id da série, cada ocorrência chegava
-- ao Task como uma reunião solta e a agenda nunca oferecia "esta e as
-- seguintes" ao apagar — só reunião marcada pelo próprio cliente, pelo link de
-- agendamento, era reconhecida como recorrente.
ALTER TABLE "meetings"
  ADD COLUMN IF NOT EXISTS "google_recurring_event_id" TEXT;

CREATE INDEX IF NOT EXISTS "meetings_google_recurring_event_id_idx"
  ON "meetings"("google_recurring_event_id");
