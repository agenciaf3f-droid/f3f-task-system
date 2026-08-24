-- Áreas contratadas por cliente, vindas da aba "ÁREA" da planilha de controle.
--
-- Lista, e não uma coluna só: das 103 linhas ativas, 83 têm mais de uma área
-- marcada (só a combinação design + tráfego são 68). Guardar uma única área
-- perderia informação e faria o filtro do disparo mentir.
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "areas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "clients_areas_idx" ON "clients" USING GIN ("areas");
