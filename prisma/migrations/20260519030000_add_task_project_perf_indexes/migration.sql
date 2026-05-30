-- Hot-path indexes pra dashboard counts, taskVisibilityFilter (createdById OR),
-- recurrence chain lookups, parentTaskId joins. pg_trgm + GIN cobre search ILIKE.
CREATE INDEX IF NOT EXISTS "tasks_company_assignee_deleted_idx" ON "tasks"("company_id", "assignee_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "tasks_company_status_due_idx" ON "tasks"("company_id", "status", "due_date");
CREATE INDEX IF NOT EXISTS "tasks_company_completed_idx" ON "tasks"("company_id", "completed_at");
CREATE INDEX IF NOT EXISTS "tasks_created_by_idx" ON "tasks"("created_by");
CREATE INDEX IF NOT EXISTS "tasks_recurrence_parent_idx" ON "tasks"("recurrence_parent_id");
CREATE INDEX IF NOT EXISTS "tasks_parent_task_idx" ON "tasks"("parent_task_id");
CREATE INDEX IF NOT EXISTS "projects_created_by_idx" ON "projects"("created_by");

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "tasks_title_trgm_idx" ON "tasks" USING gin (lower("title") gin_trgm_ops);
