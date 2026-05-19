-- Permite múltiplos Meetings no mesmo slot (userId/date/startTime).
-- Necessário pro sync do Google Calendar importar todos os eventos
-- (gestor pode ter agendas paralelas no mesmo horário em calendários distintos).
-- Checagem de duplicata passa a ser feita via query no endpoint de booking.
ALTER TABLE "meetings" DROP CONSTRAINT IF EXISTS "meetings_user_id_date_start_time_key";
