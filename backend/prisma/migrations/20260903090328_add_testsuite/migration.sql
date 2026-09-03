-- CreateEnum
CREATE TYPE "testsuite_run_status" AS ENUM ('running', 'completed', 'aborted');

-- CreateEnum
CREATE TYPE "testsuite_step_kind" AS ENUM ('trigger', 'command', 'observe');

-- CreateEnum
CREATE TYPE "testsuite_step_status" AS ENUM ('pending', 'running', 'pass', 'fail', 'timeout', 'skipped');

-- CreateTable
CREATE TABLE "testsuite_run" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ocppConnectionName" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "firmwareVersion" TEXT,
    "ocppVersion" TEXT NOT NULL,
    "status" "testsuite_run_status" NOT NULL DEFAULT 'running',
    "startedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "testsuite_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testsuite_step" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequenceIndex" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "kind" "testsuite_step_kind" NOT NULL,
    "status" "testsuite_step_status" NOT NULL DEFAULT 'pending',
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "testsuite_step_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "testsuite_run_tenantId_ocppConnectionName_startedAt_idx" ON "testsuite_run"("tenantId", "ocppConnectionName", "startedAt");

-- CreateIndex
CREATE INDEX "testsuite_run_tenantId_manufacturer_model_firmwareVersion_o_idx" ON "testsuite_run"("tenantId", "manufacturer", "model", "firmwareVersion", "ocppVersion");

-- CreateIndex
CREATE UNIQUE INDEX "testsuite_step_runId_sequenceIndex_key" ON "testsuite_step"("runId", "sequenceIndex");

-- AddForeignKey
ALTER TABLE "testsuite_run" ADD CONSTRAINT "testsuite_run_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testsuite_run" ADD CONSTRAINT "testsuite_run_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testsuite_step" ADD CONSTRAINT "testsuite_step_runId_fkey" FOREIGN KEY ("runId") REFERENCES "testsuite_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
