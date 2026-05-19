-- Mapeamento gestor → agenda Google para sync atribuir reuniões ao gestor dono
-- (e não tudo num bucket "admin"). Slots de cada gestor passam a respeitar
-- apenas as reuniões da agenda dele + reuniões do bucket "admin" (shared).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_calendar_id" VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_calendar_id_key" ON "users"("google_calendar_id");
