-- Consolida o cadastro legado "Sinergia (Rubens e Rogério)" em "Sinergia".
-- Todos os vínculos são transferidos antes da exclusão do registro duplicado.
DO $$
DECLARE
  duplicate_client RECORD;
  canonical_client_id UUID;
BEGIN
  FOR duplicate_client IN
    SELECT client.*
    FROM clients AS client
    WHERE lower(trim(client.name)) = lower('Sinergia (Rubens e Rogério)')
    ORDER BY client.created_at ASC, client.id ASC
  LOOP
    canonical_client_id := NULL;

    SELECT client.id
    INTO canonical_client_id
    FROM clients AS client
    WHERE client.company_id = duplicate_client.company_id
      AND client.id <> duplicate_client.id
      AND lower(trim(client.name)) = lower('Sinergia')
    ORDER BY (client.deleted_at IS NULL) DESC, client.created_at ASC, client.id ASC
    LIMIT 1;

    IF canonical_client_id IS NULL THEN
      UPDATE clients
      SET name = 'Sinergia', updated_at = NOW()
      WHERE id = duplicate_client.id;
      CONTINUE;
    END IF;

    UPDATE projects
    SET client_id = canonical_client_id
    WHERE client_id = duplicate_client.id;

    UPDATE tasks
    SET client_id = canonical_client_id
    WHERE client_id = duplicate_client.id;

    UPDATE booking_magic_links
    SET client_id = canonical_client_id,
        client_name = 'Sinergia'
    WHERE client_id = duplicate_client.id;

    UPDATE meetings
    SET client_name = 'Sinergia'
    WHERE user_id IN (
      SELECT id
      FROM users
      WHERE company_id = duplicate_client.company_id
    )
      AND (
        lower(trim(client_name)) = lower('Sinergia (Rubens e Rogério)')
        OR (
          duplicate_client.whatsapp_group_id IS NOT NULL
          AND client_group_id = duplicate_client.whatsapp_group_id
        )
      );

    -- Libera os identificadores únicos antes de transferi-los ao cadastro canônico.
    UPDATE clients
    SET source_group_id = NULL,
        whatsapp_group_id = NULL
    WHERE id = duplicate_client.id;

    UPDATE clients
    SET name = 'Sinergia',
        manager_id = COALESCE(duplicate_client.manager_id, manager_id),
        email = COALESCE(duplicate_client.email, email),
        phone = COALESCE(duplicate_client.phone, phone),
        meeting_plan = COALESCE(duplicate_client.meeting_plan, meeting_plan),
        source_group_id = COALESCE(duplicate_client.source_group_id, source_group_id),
        whatsapp_group_id = COALESCE(duplicate_client.whatsapp_group_id, whatsapp_group_id),
        whatsapp_group_name = COALESCE(duplicate_client.whatsapp_group_name, whatsapp_group_name),
        color = COALESCE(color, duplicate_client.color),
        avatar_url = COALESCE(avatar_url, duplicate_client.avatar_url),
        description = COALESCE(description, duplicate_client.description),
        deleted_at = NULL,
        updated_at = NOW()
    WHERE id = canonical_client_id;

    DELETE FROM clients
    WHERE id = duplicate_client.id;
  END LOOP;
END $$;

-- Também padroniza referências históricas que já estavam ligadas ao cadastro canônico.
UPDATE booking_magic_links AS link
SET client_name = 'Sinergia'
FROM clients AS client
WHERE link.client_id = client.id
  AND lower(trim(client.name)) = lower('Sinergia')
  AND link.client_name IS DISTINCT FROM 'Sinergia';
