-- CreateEnum
CREATE TYPE "citrineos_message_event" AS ENUM ('connected', 'closed', 'message');

-- CreateEnum
CREATE TYPE "citrineos_message_origin" AS ENUM ('ChargingStation', 'ChargingStationManagementSystem');

-- CreateTable
CREATE TABLE "citrineos_message_log" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ocppConnectionName" TEXT NOT NULL,
    "event" "citrineos_message_event" NOT NULL,
    "origin" "citrineos_message_origin",
    "rawMessage" TEXT,
    "info" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citrineos_message_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "citrineos_message_log_tenantId_ocppConnectionName_receivedA_idx" ON "citrineos_message_log"("tenantId", "ocppConnectionName", "receivedAt");

-- AddForeignKey
ALTER TABLE "citrineos_message_log" ADD CONSTRAINT "citrineos_message_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
