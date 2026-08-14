-- Arthur e Gabriela são contas administrativas da operação F3F.
-- Mantém os cargos alinhados à permissão de visualizar as tarefas da equipe.
UPDATE "users"
SET "role" = 'admin'
WHERE "is_active" = true
  AND "deleted_at" IS NULL
  AND lower(trim("name")) IN ('arthur', 'gabriela')
  AND "role" <> 'admin';
