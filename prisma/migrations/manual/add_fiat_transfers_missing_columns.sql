-- Migration: Add missing columns to fiat_bank_transfers
-- The admin conversions service queries these columns but they were never added
-- to the production table. Safe to run — all columns are nullable with defaults.

ALTER TABLE fiat_bank_transfers
    ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
    ADD COLUMN IF NOT EXISTS device TEXT,
    ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS flagged_at BIGINT,
    ADD COLUMN IF NOT EXISTS flagged_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS flagged_reason TEXT,
    ADD COLUMN IF NOT EXISTS status_notes TEXT,
    ADD COLUMN IF NOT EXISTS status_updated_at BIGINT,
    ADD COLUMN IF NOT EXISTS status_updated_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS updated_at BIGINT,
    ADD COLUMN IF NOT EXISTS onchain_tx_hash VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_fiat_transfers_is_flagged ON fiat_bank_transfers(is_flagged);
