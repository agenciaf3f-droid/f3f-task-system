-- Mantém uma única reunião confirmada por gestor/horário. Quando há repetição,
-- prioriza a ocorrência que pertence a uma série e possui vínculo com o Google.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, date, start_time
      ORDER BY
        CASE WHEN recurrence_rule IS NOT NULL OR recurrence_parent_id IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN google_event_id IS NOT NULL THEN 0 ELSE 1 END,
        booked_at ASC,
        id ASC
    ) AS duplicate_rank
  FROM meetings
  WHERE status = 'confirmed'
)
DELETE FROM meetings
WHERE id IN (SELECT id FROM ranked WHERE duplicate_rank > 1);

CREATE UNIQUE INDEX "meetings_one_confirmed_slot_per_user_key"
ON meetings(user_id, date, start_time)
WHERE status = 'confirmed';
