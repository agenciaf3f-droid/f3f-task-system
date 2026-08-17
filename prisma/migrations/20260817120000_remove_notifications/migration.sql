-- Remove o sistema de notificações.
-- A tabela e o enum saem juntos: nenhuma outra coluna referencia "NotificationType".
-- As FKs de notifications são ON DELETE CASCADE a partir de companies/users, então
-- derrubar a tabela não deixa constraint órfã em nenhum dos dois lados.

DROP TABLE IF EXISTS "notifications";

DROP TYPE IF EXISTS "NotificationType";
