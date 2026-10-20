-- A manager can put a task on a direct report's list (ADR-0032). NULL means the owner wrote it.
ALTER TABLE "tasks" ADD COLUMN "assigned_by" UUID;

-- CreateIndex
CREATE INDEX "tasks_assigned_by_idx" ON "tasks"("assigned_by");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
