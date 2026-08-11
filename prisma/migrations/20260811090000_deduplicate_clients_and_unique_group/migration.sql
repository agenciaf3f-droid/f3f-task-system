-- Consolida clientes duplicados pelo mesmo grupo antes de criar a proteção única.
-- Projetos, tarefas e links de agendamento são preservados e movidos para o
-- cadastro canônico (ativo e mais antigo).
CREATE TEMP TABLE client_duplicate_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    company_id,
    whatsapp_group_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY company_id, whatsapp_group_id
      ORDER BY (deleted_at IS NULL) DESC, created_at ASC, id ASC
    ) AS canonical_id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, whatsapp_group_id
      ORDER BY (deleted_at IS NULL) DESC, created_at ASC, id ASC
    ) AS position
  FROM clients
  WHERE whatsapp_group_id IS NOT NULL
)
SELECT id AS duplicate_id, canonical_id
FROM ranked
WHERE position > 1;

UPDATE projects AS project
SET client_id = map.canonical_id
FROM client_duplicate_map AS map
WHERE project.client_id = map.duplicate_id;

UPDATE tasks AS task
SET client_id = map.canonical_id
FROM client_duplicate_map AS map
WHERE task.client_id = map.duplicate_id;

UPDATE booking_magic_links AS link
SET client_id = map.canonical_id
FROM client_duplicate_map AS map
WHERE link.client_id = map.duplicate_id;

DELETE FROM clients AS client
USING client_duplicate_map AS map
WHERE client.id = map.duplicate_id;

CREATE UNIQUE INDEX clients_company_id_whatsapp_group_id_key
ON clients(company_id, whatsapp_group_id);
