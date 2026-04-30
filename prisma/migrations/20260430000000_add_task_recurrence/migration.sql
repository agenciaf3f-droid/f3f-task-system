-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "recurrence_rule" JSONB,
ADD COLUMN "recurrence_parent_id" UUID;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_parent_id_fkey" FOREIGN KEY ("recurrence_parent_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "tasks_recurrence_parent_id_idx" ON "tasks"("recurrence_parent_id");
