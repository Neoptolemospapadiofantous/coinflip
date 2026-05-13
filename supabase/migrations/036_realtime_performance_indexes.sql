-- Migration 036: Realtime Performance Indexes
-- Optimizes queries for realtime game discovery and tracking
-- These indexes support the fully realtime game experience

-- ============================================================================
-- GAME DISCOVERY BY TX_HASH (critical for game tracking after creation)
-- ============================================================================

-- Index for finding games by transaction hash
-- Used by useCreatedGameTracking to find newly created games
-- Filtered to active statuses since resolved/cancelled games don't need fast lookup
CREATE INDEX IF NOT EXISTS idx_games_tx_hash_active
ON games(tx_hash)
WHERE status IN ('pending', 'matched');

-- Full tx_hash index for historical lookups (unfiltered)
CREATE INDEX IF NOT EXISTS idx_games_tx_hash
ON games(tx_hash)
WHERE tx_hash IS NOT NULL;

-- ============================================================================
-- PLAYER ACTIVE GAMES (optimized for useUserActiveGames queries)
-- ============================================================================

-- Composite index for creator's active games lookup
-- Covers the common query pattern: WHERE creator_address = X AND status IN ('pending', 'matched')
CREATE INDEX IF NOT EXISTS idx_games_creator_active
ON games(creator_address, status, created_at DESC)
WHERE status IN ('pending', 'matched');

-- Composite index for joiner's active games lookup
CREATE INDEX IF NOT EXISTS idx_games_joiner_active
ON games(joiner_address, status, created_at DESC)
WHERE status IN ('pending', 'matched');

-- ============================================================================
-- PENDING TRANSACTIONS TABLE (for faster lookups)
-- ============================================================================

-- Index for pending transactions by user and status
-- Supports the usePendingTransactions hook queries
CREATE INDEX IF NOT EXISTS idx_pending_tx_user_status
ON pending_transactions(user_address, status)
WHERE status IN ('pending', 'submitted');

-- Index for pending transactions by tx_hash (for correlation with games)
CREATE INDEX IF NOT EXISTS idx_pending_tx_hash
ON pending_transactions(tx_hash)
WHERE tx_hash IS NOT NULL;

-- ============================================================================
-- ACTIVITY FEED OPTIMIZATION
-- ============================================================================

-- Index for activity feed queries (recent events)
CREATE INDEX IF NOT EXISTS idx_activity_feed_created
ON activity_feed(created_at DESC);

-- ============================================================================
-- RECORD MIGRATION
-- ============================================================================

INSERT INTO _migrations (version, filename)
VALUES (36, '036_realtime_performance_indexes.sql')
ON CONFLICT (version) DO NOTHING;
