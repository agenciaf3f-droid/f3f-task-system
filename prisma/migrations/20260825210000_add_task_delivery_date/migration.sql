-- Segunda data da tarefa, opcional: o "Prazo de entrega".
--
-- A obrigatória continua sendo `due_date`, que na interface passa a se chamar
-- "Prazo de conclusão". O nome da coluna não muda de propósito: ela é a data
-- que os índices, os relatórios de atraso e a ordenação do board usam, e
-- renomear obrigaria a mexer nos três sem ganho nenhum.
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "delivery_date" TIMESTAMP(3);
