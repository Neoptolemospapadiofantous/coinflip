-- Migration 016: Tier Validation Monitoring
--
-- The tier amount validation trigger was disabled in migration 007 because:
-- 1. Historical games may have different tier amounts
-- 2. Tier amounts can be updated on the smart contract
-- 3. The indexer gets amounts from contract events (authoritative source)
--
-- Data integrity is maintained by:
-- 1. Foreign key constraint fk_games_tier (tier must exist in tiers table)
-- 2. CHECK constraint on tier range (0-9)
-- 3. Indexer validation at application layer
--
-- This migration adds monitoring views instead of blocking validation.

-- ============================================================================
-- MONITORING VIEW: Tier Amount Mismatches
-- ============================================================================

-- View to identify games where amount doesn't match current tier amount
-- This is informational only - mismatches are expected for historical games
CREATE OR REPLACE VIEW tier_amount_mismatches AS
SELECT
  g.id as game_id,
  g.tier,
  g.amount as game_amount,
  t.amount as current_tier_amount,
  g.status,
  g.created_at,
  CASE
    WHEN g.amount = t.amount THEN 'match'
    WHEN g.amount IS NULL THEN 'null_amount'
    ELSE 'mismatch'
  END as match_status
FROM games g
LEFT JOIN tiers t ON g.tier = t.id
WHERE g.amount != t.amount OR g.amount IS NULL
ORDER BY g.created_at DESC;

-- Comment explaining the view
COMMENT ON VIEW tier_amount_mismatches IS
  'Shows games where amount differs from current tier amount. Mismatches are expected for historical games or after tier amount updates.';

-- ============================================================================
-- MONITORING VIEW: Tier Statistics
-- ============================================================================

-- View for tier usage statistics
CREATE OR REPLACE VIEW tier_statistics AS
SELECT
  t.id as tier_id,
  t.amount,
  t.enabled,
  COUNT(g.id) as total_games,
  COUNT(CASE WHEN g.status = 'pending' THEN 1 END) as pending_games,
  COUNT(CASE WHEN g.status = 'matched' THEN 1 END) as matched_games,
  COUNT(CASE WHEN g.status = 'resolved' THEN 1 END) as resolved_games,
  COUNT(CASE WHEN g.status = 'cancelled' THEN 1 END) as cancelled_games,
  SUM(CASE WHEN g.status = 'resolved' THEN CAST(g.fee AS NUMERIC) ELSE 0 END) as total_fees_collected
FROM tiers t
LEFT JOIN games g ON t.id = g.tier
GROUP BY t.id, t.amount, t.enabled
ORDER BY t.id;

COMMENT ON VIEW tier_statistics IS
  'Statistics per tier including game counts and fees collected.';

-- ============================================================================
-- RECORD MIGRATION
-- ============================================================================

INSERT INTO _migrations (version, filename)
VALUES (16, '016_tier_validation_monitoring.sql')
ON CONFLICT (version) DO NOTHING;
