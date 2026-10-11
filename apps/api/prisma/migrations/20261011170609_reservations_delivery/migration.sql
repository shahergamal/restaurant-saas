-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('booked', 'seated', 'cancelled', 'no_show');

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "table_id" UUID,
    "guest_name" TEXT NOT NULL,
    "phone_enc" TEXT,
    "guests" INTEGER NOT NULL,
    "section" "Section" NOT NULL DEFAULT 'family',
    "at" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'booked',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_channels" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "credentials_ref" TEXT,
    "commission_bp" INTEGER NOT NULL,

    CONSTRAINT "delivery_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_organization_id_branch_id_at_idx" ON "reservations"("organization_id", "branch_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_channels_branch_id_platform_key" ON "delivery_channels"("branch_id", "platform");

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON reservations USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());
ALTER TABLE delivery_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_channels FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON delivery_channels USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());
