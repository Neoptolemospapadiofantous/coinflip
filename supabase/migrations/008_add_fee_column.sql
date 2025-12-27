-- Add fee column to games table
-- Fee is 5% of total pot (2x bet amount), deducted from winner's payout

ALTER TABLE games ADD COLUMN IF NOT EXISTS fee TEXT;

COMMENT ON COLUMN games.fee IS 'Platform fee in wei (5% of total pot)';

-- Update existing resolved games to calculate their fees
-- Fee = (2 * amount * 0.05) = amount * 0.1
UPDATE games
SET fee = (CAST(amount AS NUMERIC) * 0.1)::BIGINT::TEXT
WHERE status = 'resolved' AND fee IS NULL;
