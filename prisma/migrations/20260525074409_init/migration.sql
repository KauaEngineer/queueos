-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('completed', 'failed');

-- CreateTable
CREATE TABLE "job_logs" (
    "id" TEXT NOT NULL,
    "queue_name" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_snapshots" (
    "id" TEXT NOT NULL,
    "worker_name" TEXT NOT NULL,
    "cpu_percent" DOUBLE PRECISION NOT NULL,
    "memory_mb" DOUBLE PRECISION NOT NULL,
    "current_job_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_snapshots" (
    "id" TEXT NOT NULL,
    "queue_name" TEXT NOT NULL,
    "waiting" INTEGER NOT NULL,
    "active" INTEGER NOT NULL,
    "completed" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "delayed" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_logs_queue_name_created_at_idx" ON "job_logs"("queue_name", "created_at" DESC);

-- CreateIndex
CREATE INDEX "job_logs_status_created_at_idx" ON "job_logs"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "worker_snapshots_worker_name_timestamp_idx" ON "worker_snapshots"("worker_name", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "queue_snapshots_queue_name_timestamp_idx" ON "queue_snapshots"("queue_name", "timestamp" DESC);
