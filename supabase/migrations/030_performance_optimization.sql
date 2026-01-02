-- Migration 030: Performance Optimization (Phase 3)
--
-- Additional indexes for:
-- 1. Activity feed queries
-- 2. Audit log queries
-- 3. Realtime stats views
-- 4. Missing composite indexes

-- ============================================
-- 1. ACTIVITY FEED INDEXES
-- ============================================

-- Index for recent activity queries (most common)
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_desc
ON activity_feed(created_at DESC);

-- Index for activity by player
CREATE INDEX IF NOT EXISTS idx_activity_feed_player
ON activity_feed(player_address, created_at DESC);

-- Index for activity by event type (for filtering)
CREATE INDEX IF NOT EXISTS idx_activity_feed_event_type
ON activity_feed(event_type, created_at DESC);

-- Note: Partial index with NOW() not possible (not immutable)
-- Instead, application should query with time filter:
-- WHERE created_at > NOW() - INTERVAL '1 hour'

-- ============================================
-- 2. GAME STATE AUDIT INDEXES
-- ============================================

-- Index for audit log by game
CREATE INDEX IF NOT EXISTS idx_game_state_audit_game
ON game_state_audit(game_id, changed_at DESC);

-- Index for audit log by time (for monitoring)
CREATE INDEX IF NOT EXISTS idx_game_state_audit_time
ON game_state_audit(changed_at DESC);

-- Index for transition type queries
CREATE INDEX IF NOT EXISTS idx_game_state_audit_transition
ON game_state_audit(old_status, new_status, changed_at DESC);

-- ============================================
-- 3. REALTIME STATS OPTIMIZED VIEWS
-- ============================================

-- Refresh the pending_games_by_tier view with better performance
DROP VIEW IF EXISTS pending_games_by_tier CASCADE;

CREATE OR REPLACE VIEW pending_games_by_tier AS
SELECT
  tier,
  COUNT(*) as pending_count,
  MIN(created_at) as oldest_game,
  MAX(created_at) as newest_game,
  AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_wait_seconds
FROM games
WHERE status = 'pending'
GROUP BY tier;

COMMENT ON VIEW pending_games_by_tier IS 'Aggregated pending game counts by tier for queue display';

-- ============================================
-- 4. TIER MATCH STATISTICS VIEW
-- ============================================

-- Optimized view for match time estimation
DROP VIEW IF EXISTS tier_match_stats CASCADE;

CREATE OR REPLACE VIEW tier_match_stats AS
SELECT
  tier,
  COUNT(*) as total_matched,
  AVG(EXTRACT(EPOCH FROM (matched_at - created_at))) as avg_match_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (matched_at - created_at))) as median_match_seconds,
  MIN(EXTRACT(EPOCH FROM (matched_at - created_at))) as min_match_seconds,
  MAX(EXTRACT(EPOCH FROM (matched_at - created_at))) as max_match_seconds
FROM games
WHERE status IN ('matched', 'resolved')
  AND matched_at IS NOT NULL
  AND matched_at > NOW() - INTERVAL '7 days'  -- Last 7 days for relevance
GROUP BY tier;

COMMENT ON VIEW tier_match_stats IS 'Match time statistics per tier for ETA estimation';

-- ============================================
-- 5. OPTIMIZED COMBINED STATS VIEW
-- ============================================

CREATE OR REPLACE VIEW realtime_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM games WHERE status = 'pending') as total_pending,
  (SELECT COUNT(*) FROM games WHERE status = 'matched') as total_matched,
  (SELECT COUNT(*) FROM games WHERE status = 'resolved' AND resolved_at > NOW() - INTERVAL '24 hours') as resolved_24h,
  (SELECT COUNT(DISTINCT creator_address) + COUNT(DISTINCT joiner_address) FROM games WHERE status IN ('pending', 'matched')) as active_players,
  (SELECT last_processed_block FROM indexer_state WHERE indexer_name = 'coinflip_events') as last_indexed_block,
  (SELECT updated_at FROM indexer_state WHERE indexer_name = 'coinflip_events') as last_index_time;

COMMENT ON VIEW realtime_dashboard_stats IS 'Combined dashboard statistics for header display';

-- ============================================
-- 6. GAMES TABLE ADDITIONAL INDEXES
-- ============================================

-- Composite index for tier + status + created (covers TierSelector queries)
CREATE INDEX IF NOT EXISTS idx_games_tier_status_created
ON games(tier, status, created_at DESC)
WHERE status = 'pending';

-- Index for winner lookups with payout (leaderboard optimization)
CREATE INDEX IF NOT EXISTS idx_games_winner_resolved
ON games(winner_address, resolved_at DESC)
WHERE status = 'resolved';

-- Index for user notifications (both addresses with status)
CREATE INDEX IF NOT EXISTS idx_games_user_active
ON games(creator_address, joiner_address, status, updated_at DESC)
WHERE status IN ('pending', 'matched');

-- ============================================
-- 7. USER PREFERENCES INDEX
-- ============================================

-- Primary key is already indexed, but add lowercase for case-insensitive lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_address_lower
ON user_preferences(lower(user_address));

-- ============================================
-- 8. INDEXER STATE OPTIMIZATION
-- ============================================

-- Ensure single-row lookup is fast
CREATE INDEX IF NOT EXISTS idx_indexer_state_name
ON indexer_state(indexer_name);

-- ============================================
-- 9. ANALYZE TABLES
-- ============================================

-- Update statistics for query planner
ANALYZE games;
ANALYZE activity_feed;
ANALYZE game_state_audit;
ANALYZE user_preferences;
ANALYZE indexer_state;

-- ============================================
-- 10. CREATE FUNCTION FOR OPTIMIZED GAME LIST
-- ============================================

-- Function to get pending games with all needed data in one query
CREATE OR REPLACE FUNCTION get_pending_games_by_tier(p_tier INTEGER DEFAULT NULL)
RETURNS TABLE(
  id BIGINT,
  tier INTEGER,
  amount TEXT,
  creator_address TEXT,
  created_at TIMESTAMPTZ,
  wait_seconds DOUBLE PRECISION,
  tier_pending_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.tier,
    g.amount,
    g.creator_address,
    g.created_at,
    EXTRACT(EPOCH FROM (NOW() - g.created_at)) as wait_seconds,
    COUNT(*) OVER (PARTITION BY g.tier) as tier_pending_count
  FROM games g
  WHERE g.status = 'pending'
    AND (p_tier IS NULL OR g.tier = p_tier)
  ORDER BY g.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_pending_games_by_tier IS 'Optimized function to get pending games with tier counts';

-- ============================================
-- 11. RECORD MIGRATION
-- ============================================

INSERT INTO _migrations (version, filename)
VALUES (30, '030_performance_optimization.sql')
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- VERIFICATION & STATS
-- ============================================

-- Show all indexes on games table
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'games'
ORDER BY indexname;

-- Show table sizes
SELECT
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  pg_size_pretty(pg_relation_size(relid)) as data_size,
  pg_size_pretty(pg_indexes_size(relid)) as index_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('games', 'activity_feed', 'game_state_audit', 'user_preferences')
ORDER BY pg_total_relation_size(relid) DESC;

-- ============================================
-- NOTES FOR FUTURE OPTIMIZATION
-- ============================================
--
-- If queries are still slow after this migration:
--
-- 1. Consider materialized views for:
--    - Leaderboard data (refresh every 5 min)
--    - Daily statistics (refresh hourly)
--
-- 2. Consider partitioning games table by:
--    - created_at (monthly partitions)
--    - status (separate pending/resolved)
--
-- 3. Monitor slow queries with:
--    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
--    SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
--
-- 4. Consider connection pooling via PgBouncer for >1000 concurrent users
