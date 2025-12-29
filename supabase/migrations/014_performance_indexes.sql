-- Migration 014: Performance Indexes
-- Adds missing indexes for common query patterns

-- ============================================================================
-- ACTIVE GAMES QUERIES (used by active_games view and UI list)
-- ============================================================================

-- Composite index for active games - covers pending and matched status queries
CREATE INDEX IF NOT EXISTS idx_games_status_created
ON games(status, created_at DESC)
WHERE status IN ('pending', 'matched');

-- ============================================================================
-- PLAYER STATISTICS QUERIES (used by usePlayerStats and leaderboard)
-- ============================================================================

-- Index for player game counts and stats (creator)
CREATE INDEX IF NOT EXISTS idx_games_creator_resolved
ON games(creator_address, status)
WHERE status = 'resolved';

-- Index for player game counts and stats (joiner)
CREATE INDEX IF NOT EXISTS idx_games_joiner_resolved
ON games(joiner_address, status)
WHERE status = 'resolved';

-- Index for leaderboard winner queries
CREATE INDEX IF NOT EXISTS idx_games_winner_payout
ON games(winner_address, payout)
WHERE status = 'resolved' AND winner_address IS NOT NULL;

-- ============================================================================
-- TIME-BASED QUERIES (used by metrics and analytics)
-- ============================================================================

-- Index for resolved games by time
CREATE INDEX IF NOT EXISTS idx_games_resolved_at
ON games(resolved_at DESC)
WHERE resolved_at IS NOT NULL;

-- Index for matched games tracking
CREATE INDEX IF NOT EXISTS idx_games_matched_at
ON games(matched_at DESC)
WHERE status = 'matched' AND matched_at IS NOT NULL;

-- ============================================================================
-- INDEXER QUERIES (used by event indexer for sync)
-- ============================================================================

-- Index for finding games by block number range
CREATE INDEX IF NOT EXISTS idx_games_block_status
ON games(block_number DESC, status);

-- ============================================================================
-- RECORD MIGRATION
-- ============================================================================

INSERT INTO _migrations (version, filename)
VALUES (14, '014_performance_indexes.sql')
ON CONFLICT (version) DO NOTHING;
