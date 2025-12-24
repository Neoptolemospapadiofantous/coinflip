-- Run All Migrations
-- Execute this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- ============================================================================
-- MIGRATION 001: Fix Tier Amounts
-- ============================================================================

-- Update tier amounts to match contract (0.001, 0.002, 0.005, 0.010, 0.020 ETH)
UPDATE tiers SET
  amount = '1000000000000000',        -- 0.001 ETH in wei
  amount_usd = 5,
  win_amount = '1900000000000000',    -- 0.0019 ETH in wei (95% of 0.002 ETH pot)
  win_amount_usd = 9.5,
  enabled = true
WHERE id = 0;

UPDATE tiers SET
  amount = '2000000000000000',        -- 0.002 ETH in wei
  amount_usd = 10,
  win_amount = '3800000000000000',    -- 0.0038 ETH in wei (95% of 0.004 ETH pot)
  win_amount_usd = 19,
  enabled = true
WHERE id = 1;

UPDATE tiers SET
  amount = '5000000000000000',        -- 0.005 ETH in wei
  amount_usd = 25,
  win_amount = '9500000000000000',    -- 0.0095 ETH in wei (95% of 0.010 ETH pot)
  win_amount_usd = 47.5,
  enabled = true
WHERE id = 2;

UPDATE tiers SET
  amount = '10000000000000000',       -- 0.010 ETH in wei
  amount_usd = 50,
  win_amount = '19000000000000000',   -- 0.019 ETH in wei (95% of 0.020 ETH pot)
  win_amount_usd = 95,
  enabled = true
WHERE id = 3;

UPDATE tiers SET
  amount = '20000000000000000',       -- 0.020 ETH in wei
  amount_usd = 100,
  win_amount = '38000000000000000',   -- 0.038 ETH in wei (95% of 0.040 ETH pot)
  win_amount_usd = 190,
  enabled = true
WHERE id = 4;

-- ============================================================================
-- MIGRATION 002: Games Table
-- ============================================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS games CASCADE;

-- Create games table
CREATE TABLE games (
  -- Primary identifiers
  id BIGINT PRIMARY KEY,
  tx_hash TEXT NOT NULL,

  -- Game configuration
  tier INTEGER NOT NULL,
  amount TEXT NOT NULL,

  -- Player information
  creator_address TEXT NOT NULL,
  creator_choice BOOLEAN NOT NULL,
  joiner_address TEXT,
  joiner_choice BOOLEAN,

  -- Game state
  status TEXT NOT NULL DEFAULT 'pending',
  winner_address TEXT,
  random_number TEXT,
  payout TEXT,

  -- Blockchain tracking
  block_number BIGINT NOT NULL,
  matched_tx_hash TEXT,
  matched_block_number BIGINT,
  resolved_tx_hash TEXT,
  resolved_block_number BIGINT,
  cancelled_tx_hash TEXT,
  cancelled_block_number BIGINT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'matched', 'resolved', 'cancelled')),
  CONSTRAINT valid_tier CHECK (tier >= 0 AND tier <= 4)
);

-- Create indexes
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_tier ON games(tier);
CREATE INDEX idx_games_creator ON games(creator_address);
CREATE INDEX idx_games_joiner ON games(joiner_address);
CREATE INDEX idx_games_created_at ON games(created_at DESC);
CREATE INDEX idx_games_block_number ON games(block_number DESC);
CREATE INDEX idx_games_pending_tier ON games(tier, created_at DESC) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games are viewable by everyone"
  ON games FOR SELECT
  USING (true);

CREATE POLICY "Games can be inserted by anyone"
  ON games FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Games can be updated by anyone"
  ON games FOR UPDATE
  USING (true);

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION update_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_games_updated_at_trigger
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_games_updated_at();

-- Views
CREATE VIEW active_games AS
SELECT
  g.*,
  t.amount_usd,
  t.win_amount_usd,
  CASE
    WHEN g.status = 'pending' THEN EXTRACT(EPOCH FROM (NOW() - g.created_at))
    WHEN g.status = 'matched' THEN EXTRACT(EPOCH FROM (NOW() - g.matched_at))
    ELSE 0
  END as time_waiting_seconds
FROM games g
JOIN tiers t ON g.tier = t.id
WHERE g.status IN ('pending', 'matched')
ORDER BY g.created_at DESC;

CREATE VIEW pending_games_by_tier AS
SELECT
  tier,
  COUNT(*) as players_in_queue,
  MIN(created_at) as oldest_game,
  MAX(created_at) as newest_game
FROM games
WHERE status = 'pending'
GROUP BY tier;

CREATE VIEW game_statistics AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'matched') as matched_count,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
  COUNT(*) as total_games,
  SUM(CAST(payout AS NUMERIC)) FILTER (WHERE status = 'resolved') as total_payouts,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) FILTER (WHERE status = 'resolved') as avg_game_duration_seconds
FROM games;

-- ============================================================================
-- MIGRATION 003: Indexer State Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS indexer_state (
  indexer_name TEXT PRIMARY KEY,
  last_processed_block TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE indexer_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Indexer state is viewable by everyone"
  ON indexer_state FOR SELECT
  USING (true);

CREATE POLICY "Indexer state can be modified by anyone"
  ON indexer_state FOR ALL
  USING (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify tiers
SELECT
  id,
  amount,
  CAST(amount AS NUMERIC) / 1000000000000000000 AS amount_eth,
  amount_usd,
  enabled
FROM tiers
ORDER BY id;

-- Check if games table exists
SELECT COUNT(*) as table_exists
FROM information_schema.tables
WHERE table_name = 'games';

-- Migration complete!
SELECT '✅ All migrations completed successfully!' as status;
