-- Additive Migration: Controlled Transfer Dimensions (Phase P10)
-- Adds Current User, Cost Center, and change intent flags to asset_transfers

ALTER TABLE "asset_transfers" ADD COLUMN "from_current_user_id" UUID;
ALTER TABLE "asset_transfers" ADD COLUMN "to_current_user_id" UUID;
ALTER TABLE "asset_transfers" ADD COLUMN "from_cost_center" TEXT;
ALTER TABLE "asset_transfers" ADD COLUMN "to_cost_center" TEXT;
ALTER TABLE "asset_transfers" ADD COLUMN "change_ac_owner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "asset_transfers" ADD COLUMN "change_current_user" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "asset_transfers" ADD COLUMN "change_department" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "asset_transfers" ADD COLUMN "change_cost_center" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "asset_transfers" ADD COLUMN "change_location" BOOLEAN NOT NULL DEFAULT false;

-- Foreign Keys for from_current_user_id and to_current_user_id
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_from_current_user_id_fkey" FOREIGN KEY ("from_current_user_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_to_current_user_id_fkey" FOREIGN KEY ("to_current_user_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
