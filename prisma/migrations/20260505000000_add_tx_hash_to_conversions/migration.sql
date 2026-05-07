-- Migration: add tx_hash columns to conversion tables
-- Allows admins to record the blockchain/payment transaction ID when
-- manually approving conversions (USDT→NGN and NGN→USDT buy orders).

ALTER TABLE fiat_bank_transfers
    ADD COLUMN IF NOT EXISTS onchain_tx_hash VARCHAR(255);

ALTER TABLE transaction_history
    ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(255);
