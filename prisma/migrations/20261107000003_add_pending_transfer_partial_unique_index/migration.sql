-- Safe Additive Migration: Concurrency-Safe Pending Transfer Partial Unique Index (Phase P10-REWORK)
-- Guarantees at most one active PENDING transfer per asset at the PostgreSQL database level.
-- Does NOT impose uniqueness on eform_number (which remains reusable across different assets).

CREATE UNIQUE INDEX IF NOT EXISTS "asset_transfers_asset_id_pending_unique"
ON "asset_transfers" ("asset_id")
WHERE "status" = 'PENDING';
