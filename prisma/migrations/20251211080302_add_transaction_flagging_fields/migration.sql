-- AlterTable: Add flagging fields to transaction_history table
-- These fields are nullable with defaults, so existing data will not be affected
ALTER TABLE "transaction_history" 
ADD COLUMN IF NOT EXISTS "is_flagged" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "flagged_at" BIGINT,
ADD COLUMN IF NOT EXISTS "flagged_by" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "flagged_reason" TEXT;

-- AlterTable: Add flagging fields to wallet_transfers table
-- These fields are nullable with defaults, so existing data will not be affected
ALTER TABLE "wallet_transfers" 
ADD COLUMN IF NOT EXISTS "is_flagged" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "flagged_at" BIGINT,
ADD COLUMN IF NOT EXISTS "flagged_by" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "flagged_reason" TEXT;

-- CreateIndex: Add index on is_flagged for transaction_history
CREATE INDEX IF NOT EXISTS "idx_transactions_is_flagged" ON "transaction_history"("is_flagged");

-- CreateIndex: Add index on is_flagged for wallet_transfers
CREATE INDEX IF NOT EXISTS "idx_wallet_transfers_is_flagged" ON "wallet_transfers"("is_flagged");


