-- CreateTable: task_dependencies
-- taskId blocks blocksTaskId (A → B means "A must be done before B")
CREATE TABLE "task_dependencies" (
    "task_id" UUID NOT NULL,
    "blocks_task_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("task_id","blocks_task_id")
);

CREATE INDEX "task_dependencies_task_id_idx" ON "task_dependencies"("task_id");
CREATE INDEX "task_dependencies_blocks_task_id_idx" ON "task_dependencies"("blocks_task_id");

ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_blocks_task_id_fkey"
    FOREIGN KEY ("blocks_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
