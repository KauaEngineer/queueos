-- AlterTable
ALTER TABLE "job_logs" ADD COLUMN     "tenant_id" TEXT NOT NULL DEFAULT 'default';

-- CreateIndex
CREATE INDEX "job_logs_tenant_id_created_at_idx" ON "job_logs"("tenant_id", "created_at" DESC);
