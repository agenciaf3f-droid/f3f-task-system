-- Suporte a eventos com múltiplos dias, dia inteiro e convidados externos.
-- end_date permanece nullable para compatibilidade com reuniões legadas;
-- na aplicação, null significa a mesma data de início.

ALTER TABLE "meetings"
  ADD COLUMN "end_date" VARCHAR(10),
  ADD COLUMN "is_all_day" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "guest_emails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "meetings_end_date_status_idx" ON "meetings"("end_date", "status");
