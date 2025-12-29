-- Migration 015: Fix Historical Fee Calculations
--
-- Previous migration (008) incorrectly calculated fees as 10% of bet amount.
-- The actual contract fee is 3% of the total pot (300 basis points).
--
-- Correct calculation:
--   pot = 2 * amount (both players bet the same amount)
--   fee = pot * 0.03 = 2 * amount * 0.03 = amount * 0.06
--
-- Note: New games have correct fees written by the indexer from contract events.
-- This migration only fixes historical games that were backfilled incorrectly.

-- ============================================================================
-- FIX HISTORICAL FEE VALUES
-- ============================================================================

-- Recalculate fees for resolved games created before the indexer fix
-- Only update if the fee looks like it was calculated with the wrong formula
-- (i.e., fee = amount * 0.1 instead of amount * 0.06)
UPDATE games
SET fee = (CAST(amount AS NUMERIC) * 0.06)::BIGINT::TEXT
WHERE status = 'resolved'
  AND fee IS NOT NULL
  AND amount IS NOT NULL
  -- Only update if fee appears to be calculated with old 10% formula
  -- Allow small tolerance for rounding
  AND ABS(CAST(fee AS NUMERIC) - CAST(amount AS NUMERIC) * 0.1) < 100;

-- Update comment to reflect correct fee percentage
COMMENT ON COLUMN games.fee IS 'Platform fee in wei (3% of total pot = 6% of bet amount)';

-- ============================================================================
-- RECORD MIGRATION
-- ============================================================================

INSERT INTO _migrations (version, filename)
VALUES (15, '015_fix_historical_fees.sql')
ON CONFLICT (version) DO NOTHING;
