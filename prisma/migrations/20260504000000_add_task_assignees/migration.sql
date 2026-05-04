-- CreateTable: task_assignees (multi-assignee junction table)
CREATE TABLE "task_assignees" (
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_id" UUID NOT NULL,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("task_id","user_id")
);

-- CreateIndex
CREATE INDEX "task_assignees_task_id_idx" ON "task_assignees"("task_id");
CREATE INDEX "task_assignees_user_id_idx" ON "task_assignees"("user_id");

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_assigned_by_id_fkey"
    FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy existing assigneeId into task_assignees
INSERT INTO "task_assignees" ("task_id", "user_id", "assigned_at", "assigned_by_id")
SELECT t.id, t.assignee_id, t.created_at, t.created_by
FROM "tasks" t
WHERE t.assignee_id IS NOT NULL
  AND t.deleted_at IS NULL
ON CONFLICT DO NOTHING;
