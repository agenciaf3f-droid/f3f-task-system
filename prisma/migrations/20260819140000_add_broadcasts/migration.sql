-- ID do cliente na planilha de controle (coluna "ID Cliente"). Serve para a
-- variável {{id_cliente}} nos disparos e para casar o cliente com a planilha
-- por um código estável, em vez de pelo nome do grupo.
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "external_id" VARCHAR(50);

CREATE INDEX IF NOT EXISTS "clients_company_id_external_id_idx"
  ON "clients"("company_id", "external_id");

DO $$ BEGIN
  CREATE TYPE "BroadcastStatus" AS ENUM ('draft', 'scheduled', 'sending', 'completed', 'canceled', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BroadcastMessageType" AS ENUM ('text', 'image', 'video', 'audio', 'poll');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Disparos em massa para os grupos de WhatsApp dos clientes.
--
-- O envio não roda aqui: uma chamada /sender/advanced entrega a lista inteira à
-- UAZAPI de uma vez e devolve um folder_id. É por ele que o andamento é
-- consultado (/sender/listmessages) e que o disparo é cancelado (/sender/edit).
-- Sem isso, uma função da Vercel teria que ficar viva o disparo todo esperando
-- o intervalo entre mensagens — que aqui é problema da fila da UAZAPI.
CREATE TABLE IF NOT EXISTS "broadcasts" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "created_by_id" UUID,
  "name" VARCHAR(255) NOT NULL,
  "status" "BroadcastStatus" NOT NULL DEFAULT 'draft',
  "delay_min" INTEGER NOT NULL DEFAULT 15,
  "delay_max" INTEGER NOT NULL DEFAULT 30,
  "scheduled_for" TIMESTAMP(3),
  "folder_id" VARCHAR(255),
  "total_targets" INTEGER NOT NULL DEFAULT 0,
  "total_messages" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "broadcasts_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "broadcasts_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "broadcasts_company_id_created_at_idx"
  ON "broadcasts"("company_id", "created_at");

-- Uma linha por mensagem da sequência (o mockup permite empilhar várias).
-- O texto fica com as variáveis cruas ({{nome}}); quem resolve por destinatário
-- é o momento do envio, para o relatório continuar mostrando o que foi escrito.
CREATE TABLE IF NOT EXISTS "broadcast_messages" (
  "id" UUID NOT NULL,
  "broadcast_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "type" "BroadcastMessageType" NOT NULL,
  "text" TEXT,
  "file_url" TEXT,
  "file_name" VARCHAR(255),
  "choices" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "selectable_count" INTEGER,
  CONSTRAINT "broadcast_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "broadcast_messages_broadcast_id_fkey"
    FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "broadcast_messages_broadcast_id_position_idx"
  ON "broadcast_messages"("broadcast_id", "position");

-- Para quem o disparo foi. Nome e ID Cliente ficam copiados de propósito: o
-- cliente pode ser renomeado ou arquivado depois, e o relatório precisa
-- continuar dizendo para quem foi na época do envio.
CREATE TABLE IF NOT EXISTS "broadcast_recipients" (
  "id" UUID NOT NULL,
  "broadcast_id" UUID NOT NULL,
  "client_id" UUID,
  "client_name" VARCHAR(255) NOT NULL,
  "group_id" VARCHAR(255) NOT NULL,
  "external_id" VARCHAR(50),
  CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "broadcast_recipients_broadcast_id_fkey"
    FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "broadcast_recipients_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Impede o mesmo grupo entrar duas vezes no mesmo disparo.
CREATE UNIQUE INDEX IF NOT EXISTS "broadcast_recipients_broadcast_id_group_id_key"
  ON "broadcast_recipients"("broadcast_id", "group_id");

CREATE INDEX IF NOT EXISTS "broadcast_recipients_broadcast_id_idx"
  ON "broadcast_recipients"("broadcast_id");
