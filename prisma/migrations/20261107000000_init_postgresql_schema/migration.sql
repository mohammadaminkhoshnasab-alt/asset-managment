-- IT Asset Management System — Initial PostgreSQL Migration
-- Phase P02: PostgreSQL Data Architecture
-- Migration: 20261107000000_init_postgresql_schema

-- 1. Create Enums
CREATE TYPE "AssetStatus" AS ENUM ('IN_USE', 'SPARE', 'DISPOSED', 'UNKNOWN');
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AuditSource" AS ENUM ('UI', 'EXCEL_MIGRATION', 'SYSTEM', 'API');
CREATE TYPE "DatePrecision" AS ENUM ('DAY', 'MONTH');
CREATE TYPE "VerificationOutcome" AS ENUM ('VERIFIED_MATCH', 'LOCATION_MISMATCH', 'USER_MISMATCH', 'STATUS_MISMATCH', 'NOT_FOUND', 'DAMAGED');
CREATE TYPE "FollowUpStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');
CREATE TYPE "FollowUpPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- 2. Lookup Tables (Extensible)
CREATE TABLE "asset_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "building" TEXT,
    "floor" TEXT,
    "room" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "device_health_statuses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_health_statuses_pkey" PRIMARY KEY ("id")
);

-- 3. People / Identities Table
-- Preserves distinct concepts: AC Owner (responsible person), Personal Code, and Current Username (actual user)
CREATE TABLE "people" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" TEXT NOT NULL,
    "personal_code" TEXT,
    "username" TEXT,
    "department" TEXT,
    "cost_center" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- 4. Core Assets Table
-- Immutable internal UUID; independently unique optional Asset Number and Serial Number (permits multiple NULLs)
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_number" TEXT,
    "serial_number" TEXT,
    "type_id" UUID,
    "model" TEXT NOT NULL,
    "department" TEXT,
    "cost_center" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'SPARE',
    "location_id" UUID,
    "device_health_id" UUID,
    "label" TEXT,
    "comment" TEXT,
    "ac_owner_id" UUID,
    "current_user_id" UUID,
    "legacy_new_cost_center" TEXT,
    "last_verified_at" TIMESTAMP(3),
    "last_verified_year_month" TEXT,
    "last_verification_outcome" "VerificationOutcome",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- 5. Asset Transfers & Assignment History
-- Non-unique eForm Number (can repeat across assets); Completed requires non-empty eForm Number
CREATE TABLE "asset_transfers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "from_person_id" UUID,
    "to_person_id" UUID,
    "from_department" TEXT,
    "to_department" TEXT,
    "from_location_id" UUID,
    "to_location_id" UUID,
    "eform_number" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by" TEXT,

    CONSTRAINT "asset_transfers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_transfer_completed_eform" CHECK ("status" != 'COMPLETED' OR ("eform_number" IS NOT NULL AND length(trim("eform_number")) > 0))
);

-- 6. Append-Only Asset Audit Events
-- Restrict delete: no cascading deletion
CREATE TABLE "asset_audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "source" "AuditSource" NOT NULL DEFAULT 'SYSTEM',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operation_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "changed_fields" JSONB NOT NULL,
    "before_values" JSONB,
    "after_values" JSONB,
    "eform_number" TEXT,

    CONSTRAINT "asset_audit_events_pkey" PRIMARY KEY ("id")
);

-- 7. Physical Verification Attempts
-- Preserves MONTH-only vs DAY precision without inventing days
CREATE TABLE "physical_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "verified_by" TEXT NOT NULL,
    "outcome" "VerificationOutcome" NOT NULL,
    "is_successful" BOOLEAN NOT NULL DEFAULT true,
    "date_precision" "DatePrecision" NOT NULL DEFAULT 'DAY',
    "verified_year" INTEGER NOT NULL,
    "verified_month" INTEGER NOT NULL,
    "verified_day" INTEGER,
    "verified_date" TIMESTAMP(3),
    "verified_year_month" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "physical_verifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_verification_date_precision" CHECK (
        ("date_precision" = 'DAY' AND "verified_day" IS NOT NULL) OR 
        ("date_precision" = 'MONTH' AND "verified_day" IS NULL)
    ),
    CONSTRAINT "chk_verification_month_range" CHECK ("verified_month" >= 1 AND "verified_month" <= 12),
    CONSTRAINT "chk_verification_day_range" CHECK ("verified_day" IS NULL OR ("verified_day" >= 1 AND "verified_day" <= 31))
);

-- 8. Asset Follow-Ups
CREATE TABLE "asset_follow_ups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "FollowUpPriority" NOT NULL DEFAULT 'MEDIUM',
    "assigned_to" TEXT,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "asset_follow_ups_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_followup_resolved_timestamp" CHECK ("status" != 'RESOLVED' OR "resolved_at" IS NOT NULL)
);

-- 9. Application Settings & Single-Admin Credential Storage
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "admin_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "salt" TEXT,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "password_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_credentials_pkey" PRIMARY KEY ("id")
);

-- -------------------------------------------------------------
-- Indexes & Unique Constraints
-- -------------------------------------------------------------

-- Unique lookups
CREATE UNIQUE INDEX "asset_types_name_key" ON "asset_types"("name");
CREATE UNIQUE INDEX "locations_name_key" ON "locations"("name");
CREATE UNIQUE INDEX "device_health_statuses_name_key" ON "device_health_statuses"("name");

-- People identities (unique personal code and username independently; supports NULLs)
CREATE UNIQUE INDEX "people_personal_code_key" ON "people"("personal_code");
CREATE UNIQUE INDEX "people_username_key" ON "people"("username");
CREATE INDEX "people_full_name_idx" ON "people"("full_name");
CREATE INDEX "people_department_idx" ON "people"("department");

-- Assets: Independent uniqueness when non-NULL; supports unlimited NULLs
CREATE UNIQUE INDEX "assets_asset_number_key" ON "assets"("asset_number");
CREATE UNIQUE INDEX "assets_serial_number_key" ON "assets"("serial_number");
CREATE INDEX "assets_status_idx" ON "assets"("status");
CREATE INDEX "assets_department_idx" ON "assets"("department");
CREATE INDEX "assets_cost_center_idx" ON "assets"("cost_center");

-- Transfers: eForm Number is NON-UNIQUE and can repeat across assets
CREATE INDEX "asset_transfers_asset_id_idx" ON "asset_transfers"("asset_id");
CREATE INDEX "asset_transfers_eform_number_idx" ON "asset_transfers"("eform_number");
CREATE INDEX "asset_transfers_status_idx" ON "asset_transfers"("status");

-- Audits: Grouping and performance indexes
CREATE INDEX "asset_audit_events_asset_id_timestamp_idx" ON "asset_audit_events"("asset_id", "timestamp");
CREATE INDEX "asset_audit_events_operation_id_idx" ON "asset_audit_events"("operation_id");
CREATE INDEX "asset_audit_events_eform_number_idx" ON "asset_audit_events"("eform_number");

-- Physical Verifications
CREATE INDEX "physical_verifications_asset_id_verified_year_month_idx" ON "physical_verifications"("asset_id", "verified_year", "verified_month");
CREATE INDEX "physical_verifications_outcome_idx" ON "physical_verifications"("outcome");

-- Follow-Ups
CREATE INDEX "asset_follow_ups_asset_id_status_idx" ON "asset_follow_ups"("asset_id", "status");
CREATE INDEX "asset_follow_ups_status_priority_idx" ON "asset_follow_ups"("status", "priority");

-- Admin Credential
CREATE UNIQUE INDEX "admin_credentials_username_key" ON "admin_credentials"("username");

-- -------------------------------------------------------------
-- Foreign Keys (with ON DELETE RESTRICT on audit/history)
-- -------------------------------------------------------------

ALTER TABLE "assets" ADD CONSTRAINT "assets_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "asset_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_device_health_id_fkey" FOREIGN KEY ("device_health_id") REFERENCES "device_health_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_ac_owner_id_fkey" FOREIGN KEY ("ac_owner_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_current_user_id_fkey" FOREIGN KEY ("current_user_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Do not silently cascade-delete transfer, audit, verification, or follow-up history
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_from_person_id_fkey" FOREIGN KEY ("from_person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_to_person_id_fkey" FOREIGN KEY ("to_person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_audit_events" ADD CONSTRAINT "asset_audit_events_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "physical_verifications" ADD CONSTRAINT "physical_verifications_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_follow_ups" ADD CONSTRAINT "asset_follow_ups_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
