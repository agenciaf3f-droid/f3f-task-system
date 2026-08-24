-- Token da UAZAPI do número pessoal de cada gestor, cifrado em AES-256-GCM
-- (src/lib/secret-box.ts). Texto, não varchar curto: o blob guarda iv, tag e
-- payload junto com o prefixo de versão.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "uazapi_token" TEXT;

DO $$ BEGIN
  CREATE TYPE "BroadcastSenderMode" AS ENUM ('automation', 'manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "broadcasts"
  ADD COLUMN IF NOT EXISTS "sender_mode" "BroadcastSenderMode" NOT NULL DEFAULT 'automation';

-- Um envio à UAZAPI dentro de um disparo.
--
-- No modo automação existe um só. No modo por gestor, os destinatários são
-- agrupados pelo gestor responsável e cada grupo vira uma chamada
-- /sender/advanced com o token daquele gestor — logo vários folder_id por
-- disparo, e o relatório soma todos.
CREATE TABLE IF NOT EXISTS "broadcast_dispatches" (
  "id" UUID NOT NULL,
  "broadcast_id" UUID NOT NULL,
  "manager_id" UUID,
  "sender_label" VARCHAR(255) NOT NULL,
  "folder_id" VARCHAR(255) NOT NULL,
  "queued" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "broadcast_dispatches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "broadcast_dispatches_broadcast_id_fkey"
    FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "broadcast_dispatches_manager_id_fkey"
    FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "broadcast_dispatches_broadcast_id_idx"
  ON "broadcast_dispatches"("broadcast_id");

-- Disparos que já existiam saíram todos pelo número de automação e têm um
-- folder_id só; virar linha de dispatch mantém o relatório com um caminho único.
INSERT INTO "broadcast_dispatches" ("id", "broadcast_id", "manager_id", "sender_label", "folder_id", "queued", "created_at")
SELECT gen_random_uuid(), b."id", NULL, 'Número de automação', b."folder_id", b."total_messages", b."created_at"
FROM "broadcasts" b
WHERE b."folder_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "broadcast_dispatches" d WHERE d."broadcast_id" = b."id");
