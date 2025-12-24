-- Migration: Create indexes for performance
-- Description: Adds indexes on frequently queried columns
-- Author: CoinFlip Team
-- Date: 2025-01-01

-- ===========================================================================
-- GAMES TABLE INDEXES
-- ===========================================================================

-- Index on creator address (for user's game history)
CREATE INDEX IF NOT EXISTS idx_games_creator
  ON games(creator);

-- Index on joiner address (for user's game history)
CREATE INDEX IF NOT EXISTS idx_games_joiner
  ON games(joiner)
  WHERE joiner IS NOT NULL;

-- Index on status (for filtering active games)
CREATE INDEX IF NOT EXISTS idx_games_status
  ON games(status);

-- Index on tier (for tier-specific queries)
CREATE INDEX IF NOT EXISTS idx_games_tier
  ON games(tier);

-- Composite index for user's games by tier
CREATE INDEX IF NOT EXISTS idx_games_creator_tier
  ON games(creator, tier);

-- Index on created_at for sorting by time
CREATE INDEX IF NOT EXISTS idx_games_created_at
  ON games(created_at DESC);

-- Index on matched_at for recent matches
CREATE INDEX IF NOT EXISTS idx_games_matched_at
  ON games(matched_at DESC)
  WHERE matched_at IS NOT NULL;

-- Index on VRF request ID for callback lookups
CREATE INDEX IF NOT EXISTS idx_games_vrf_request
  ON games(vrf_request_id)
  WHERE vrf_request_id IS NOT NULL;

-- Index on block number for event indexing
CREATE INDEX IF NOT EXISTS idx_games_block_number
  ON games(block_number DESC)
  WHERE block_number IS NOT NULL;

-- ===========================================================================
-- QUEUE TABLE INDEXES
-- ===========================================================================

-- Index on tier (for matchmaking within tier)
CREATE INDEX IF NOT EXISTS idx_queue_tier
  ON queue(tier)
  WHERE matched = false;

-- Index on player address
CREATE INDEX IF NOT EXISTS idx_queue_player
  ON queue(player_address);

-- Index on expires_at (for cleanup of expired entries)
CREATE INDEX IF NOT EXISTS idx_queue_expires
  ON queue(expires_at)
  WHERE matched = false;

-- Composite index for active queue entries by tier
CREATE INDEX IF NOT EXISTS idx_queue_active_tier
  ON queue(tier, joined_at)
  WHERE matched = false;

-- ===========================================================================
-- TIERS TABLE INDEXES
-- ===========================================================================

-- Index on enabled status
CREATE INDEX IF NOT EXISTS idx_tiers_enabled
  ON tiers(enabled)
  WHERE enabled = true;

-- ===========================================================================
-- PLAYER STATS TABLE INDEXES
-- ===========================================================================

-- Index on win rate for leaderboards
CREATE INDEX IF NOT EXISTS idx_player_stats_win_rate
  ON player_stats(win_rate DESC);

-- Index on total games for leaderboards
CREATE INDEX IF NOT EXISTS idx_player_stats_total_games
  ON player_stats(total_games DESC);

-- Index on total volume for high rollers
CREATE INDEX IF NOT EXISTS idx_player_stats_volume
  ON player_stats(total_volume_usd DESC);

-- Index on last activity
CREATE INDEX IF NOT EXISTS idx_player_stats_last_game
  ON player_stats(last_game_at DESC);

-- ===========================================================================
-- ANALYTICS TABLE INDEXES
-- ===========================================================================

-- Index on date for time-series queries
CREATE INDEX IF NOT EXISTS idx_analytics_date
  ON analytics(date DESC);

-- ===========================================================================
-- SUCCESS
-- ===========================================================================

DO $$
BEGIN
  RAISE NOTICE 'Indexes created successfully';
  RAISE NOTICE '   - Games table: 9 indexes';
  RAISE NOTICE '   - Queue table: 4 indexes';
  RAISE NOTICE '   - Tiers table: 1 index';
  RAISE NOTICE '   - Player stats: 4 indexes';
  RAISE NOTICE '   - Analytics: 1 index';
END $$;
