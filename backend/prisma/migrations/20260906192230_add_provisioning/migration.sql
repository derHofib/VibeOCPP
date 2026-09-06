-- CreateEnum
CREATE TYPE "planned_station_status" AS ENUM ('Planned', 'Linked');

-- CreateEnum
CREATE TYPE "connector_format" AS ENUM ('Socket', 'Cable');

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_stations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "chargeboxId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "vendor" TEXT,
    "model" TEXT,
    "ocppVersion" TEXT,
    "status" "planned_station_status" NOT NULL DEFAULT 'Planned',
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_connectors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "evseId" INTEGER NOT NULL,
    "connectorId" INTEGER NOT NULL DEFAULT 1,
    "type" TEXT NOT NULL,
    "format" "connector_format" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unknown_chargers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chargeboxId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "unknown_chargers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planned_stations_tenantId_chargeboxId_key" ON "planned_stations"("tenantId", "chargeboxId");

-- CreateIndex
CREATE UNIQUE INDEX "planned_connectors_stationId_evseId_connectorId_key" ON "planned_connectors"("stationId", "evseId", "connectorId");

-- CreateIndex
CREATE UNIQUE INDEX "unknown_chargers_tenantId_chargeboxId_key" ON "unknown_chargers"("tenantId", "chargeboxId");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_stations" ADD CONSTRAINT "planned_stations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_stations" ADD CONSTRAINT "planned_stations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_connectors" ADD CONSTRAINT "planned_connectors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_connectors" ADD CONSTRAINT "planned_connectors_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "planned_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unknown_chargers" ADD CONSTRAINT "unknown_chargers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
