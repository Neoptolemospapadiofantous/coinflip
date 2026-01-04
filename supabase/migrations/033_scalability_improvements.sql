-- Migration 033: Scalability Improvements
-- 1. Materialized view for leaderboard data (pre-computed stats)
-- 2. Refresh function for scheduled updates
-- 3. Optimized leaderboard functions using materialized view
-- 4. Query timeout settings for long-running queries

-- ============================================================================
-- 1. MATERIALIZED VIEW: Pre-computed player statistics
-- Eliminates expensive subqueries in leaderboard functions
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS player_stats_materialized CASCADE;

CREATE MATERIALIZED VIEW player_stats_materialized AS
WITH player_games AS (
  SELECT
    lower(creator_address) as player_address,
    amount::numeric as wagered_amount,
    CASE WHEN lower(winner_address) = lower(creator_address) THEN 1 ELSE 0 END as is_win,
    CASE WHEN winner_address IS NOT NULL AND lower(winner_address) != lower(creator_address) THEN 1 ELSE 0 END as is_loss,
    CASE WHEN lower(winner_address) = lower(creator_address) THEN payout::numeric ELSE 0 END as profit
  FROM games
  WHERE status = 'resolved'
  UNION ALL
  SELECT
    lower(joiner_address) as player_address,
    amount::numeric as wagered_amount,
    CASE WHEN lower(winner_address) = lower(joiner_address) THEN 1 ELSE 0 END as is_win,
    CASE WHEN winner_address IS NOT NULL AND lower(winner_address) != lower(joiner_address) THEN 1 ELSE 0 END as is_loss,
    CASE WHEN lower(winner_address) = lower(joiner_address) THEN payout::numeric ELSE 0 END as profit
  FROM games
  WHERE status = 'resolved' AND joiner_address IS NOT NULL
)
SELECT
  player_address,
  COUNT(*)::BIGINT as total_games,
  SUM(is_win)::BIGINT as wins,
  SUM(is_loss)::BIGINT as losses,
  SUM(wagered_amount) as total_wagered,
  SUM(profit) as total_profit,
  CASE
    WHEN SUM(is_win + is_loss) > 0
    THEN ROUND((SUM(is_win)::NUMERIC / SUM(is_win + is_loss)::NUMERIC) * 100, 2)
    ELSE 0
  END as win_rate
FROM player_games
WHERE player_address IS NOT NULL
GROUP BY player_address;

-- Index for fast lookups
CREATE UNIQUE INDEX idx_player_stats_mat_address ON player_stats_materialized(player_address);
CREATE INDEX idx_player_stats_mat_wins ON player_stats_materialized(wins DESC, total_games DESC);
CREATE INDEX idx_player_stats_mat_profit ON player_stats_materialized(total_profit DESC);
CREATE INDEX idx_player_stats_mat_winrate ON player_stats_materialized(win_rate DESC, wins DESC);
CREATE INDEX idx_player_stats_mat_volume ON player_stats_materialized(total_wagered DESC);

COMMENT ON MATERIALIZED VIEW player_stats_materialized IS 'Pre-computed player statistics for fast leaderboard queries. Refresh every 5 minutes.';

-- ============================================================================
-- 2. REFRESH FUNCTION: Called by scheduled job or trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_player_stats_materialized()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY player_stats_materialized;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_player_stats_materialized IS 'Refreshes player stats materialized view. Safe for concurrent reads.';

-- Grant execute to service role for scheduled jobs
GRANT EXECUTE ON FUNCTION refresh_player_stats_materialized() TO service_role;

-- ============================================================================
-- 3. OPTIMIZED LEADERBOARD FUNCTIONS
-- Replace subquery-based functions with materialized view lookups
-- ============================================================================

-- Optimized: Leaderboard by wins
CREATE OR REPLACE FUNCTION get_leaderboard_by_wins(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  rank BIGINT,
  player_address TEXT,
  wins BIGINT,
  losses BIGINT,
  total_games BIGINT,
  win_rate NUMERIC,
  total_profit NUMERIC,
  total_wagered NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY ps.wins DESC, ps.total_games DESC, ps.win_rate DESC NULLS LAST)::BIGINT as rank,
    ps.player_address::TEXT,
    ps.wins,
    ps.losses,
    ps.total_games,
    ps.win_rate,
    ps.total_profit,
    ps.total_wagered
  FROM player_stats_materialized ps
  ORDER BY ps.wins DESC, ps.total_games DESC, ps.win_rate DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Optimized: Leaderboard by profit
CREATE OR REPLACE FUNCTION get_leaderboard_by_profit(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  rank BIGINT,
  player_address TEXT,
  wins BIGINT,
  losses BIGINT,
  total_games BIGINT,
  win_rate NUMERIC,
  total_profit NUMERIC,
  total_wagered NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY ps.total_profit DESC NULLS LAST, ps.wins DESC)::BIGINT as rank,
    ps.player_address::TEXT,
    ps.wins,
    ps.losses,
    ps.total_games,
    ps.win_rate,
    ps.total_profit,
    ps.total_wagered
  FROM player_stats_materialized ps
  ORDER BY ps.total_profit DESC NULLS LAST, ps.wins DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Optimized: Leaderboard by win rate
CREATE OR REPLACE FUNCTION get_leaderboard_by_winrate(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_min_games INTEGER DEFAULT 10
)
RETURNS TABLE(
  rank BIGINT,
  player_address TEXT,
  wins BIGINT,
  losses BIGINT,
  total_games BIGINT,
  win_rate NUMERIC,
  total_profit NUMERIC,
  total_wagered NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY ps.win_rate DESC NULLS LAST, ps.wins DESC, ps.total_games DESC)::BIGINT as rank,
    ps.player_address::TEXT,
    ps.wins,
    ps.losses,
    ps.total_games,
    ps.win_rate,
    ps.total_profit,
    ps.total_wagered
  FROM player_stats_materialized ps
  WHERE ps.total_games >= p_min_games
  ORDER BY ps.win_rate DESC NULLS LAST, ps.wins DESC, ps.total_games DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Optimized: Leaderboard by volume
CREATE OR REPLACE FUNCTION get_leaderboard_by_volume(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  rank BIGINT,
  player_address TEXT,
  wins BIGINT,
  losses BIGINT,
  total_games BIGINT,
  win_rate NUMERIC,
  total_profit NUMERIC,
  total_wagered NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY ps.total_wagered DESC, ps.total_games DESC)::BIGINT as rank,
    ps.player_address::TEXT,
    ps.wins,
    ps.losses,
    ps.total_games,
    ps.win_rate,
    ps.total_profit,
    ps.total_wagered
  FROM player_stats_materialized ps
  ORDER BY ps.total_wagered DESC, ps.total_games DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Optimized: Get player rank
CREATE OR REPLACE FUNCTION get_player_rank(p_player_address TEXT)
RETURNS TABLE(
  rank_by_wins BIGINT,
  rank_by_profit BIGINT,
  rank_by_winrate BIGINT,
  rank_by_volume BIGINT,
  total_players BIGINT,
  player_wins BIGINT,
  player_losses BIGINT,
  player_total_games BIGINT,
  player_win_rate NUMERIC,
  player_total_profit NUMERIC,
  player_total_wagered NUMERIC
) AS $$
DECLARE
  lower_addr TEXT := lower(p_player_address);
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      ps.*,
      ROW_NUMBER() OVER (ORDER BY ps.wins DESC, ps.total_games DESC) as rk_wins,
      ROW_NUMBER() OVER (ORDER BY ps.total_profit DESC NULLS LAST) as rk_profit,
      ROW_NUMBER() OVER (ORDER BY ps.win_rate DESC NULLS LAST, ps.wins DESC) as rk_winrate,
      ROW_NUMBER() OVER (ORDER BY ps.total_wagered DESC) as rk_volume
    FROM player_stats_materialized ps
  ),
  total AS (
    SELECT COUNT(*)::BIGINT as cnt FROM player_stats_materialized
  )
  SELECT
    COALESCE(r.rk_wins, t.cnt + 1)::BIGINT,
    COALESCE(r.rk_profit, t.cnt + 1)::BIGINT,
    COALESCE(r.rk_winrate, t.cnt + 1)::BIGINT,
    COALESCE(r.rk_volume, t.cnt + 1)::BIGINT,
    t.cnt,
    COALESCE(r.wins, 0)::BIGINT,
    COALESCE(r.losses, 0)::BIGINT,
    COALESCE(r.total_games, 0)::BIGINT,
    COALESCE(r.win_rate, 0)::NUMERIC,
    COALESCE(r.total_profit, 0)::NUMERIC,
    COALESCE(r.total_wagered, 0)::NUMERIC
  FROM total t
  LEFT JOIN ranked r ON r.player_address = lower_addr;
END;
$$ LANGUAGE plpgsql STABLE;

-- Optimized: Leaderboard stats
CREATE OR REPLACE FUNCTION get_leaderboard_stats()
RETURNS TABLE(
  total_players BIGINT,
  total_games BIGINT,
  total_volume NUMERIC,
  avg_win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_players,
    (SUM(ps.total_games) / 2)::BIGINT as total_games, -- Each game has 2 players
    SUM(ps.total_wagered)::NUMERIC as total_volume,
    ROUND(AVG(ps.win_rate), 2)::NUMERIC as avg_win_rate
  FROM player_stats_materialized ps;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4. QUERY TIMEOUT SETTINGS
-- Prevent runaway queries from blocking the connection pool
-- ============================================================================

-- Note: These settings apply to new connections
-- Set statement timeout to 30 seconds for normal queries
ALTER DATABASE postgres SET statement_timeout = '30s';

-- ============================================================================
-- 5. AUTO-REFRESH TRIGGER (optional - can use pg_cron instead)
-- Refresh materialized view when games are resolved
-- ============================================================================

-- Create a flag table to track refresh needs (avoids refreshing on every game)
CREATE TABLE IF NOT EXISTS _refresh_flags (
  view_name TEXT PRIMARY KEY,
  needs_refresh BOOLEAN DEFAULT false,
  last_refresh TIMESTAMPTZ,
  refresh_count BIGINT DEFAULT 0
);

INSERT INTO _refresh_flags (view_name, needs_refresh, last_refresh)
VALUES ('player_stats_materialized', false, NOW())
ON CONFLICT (view_name) DO NOTHING;

-- Function to mark refresh needed
CREATE OR REPLACE FUNCTION mark_stats_refresh_needed()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE _refresh_flags
  SET needs_refresh = true
  WHERE view_name = 'player_stats_materialized';
  RETURN NULL; -- After trigger, return value is ignored
END;
$$ LANGUAGE plpgsql;

-- Trigger on game resolution
DROP TRIGGER IF EXISTS trg_mark_refresh_on_resolve ON games;
CREATE TRIGGER trg_mark_refresh_on_resolve
AFTER UPDATE OF status ON games
FOR EACH ROW
WHEN (NEW.status = 'resolved' AND OLD.status != 'resolved')
EXECUTE FUNCTION mark_stats_refresh_needed();

-- Function for batched refresh (call from scheduled job)
CREATE OR REPLACE FUNCTION refresh_stats_if_needed()
RETURNS BOOLEAN AS $$
DECLARE
  should_refresh BOOLEAN;
  last_refresh_time TIMESTAMPTZ;
BEGIN
  SELECT needs_refresh, last_refresh
  INTO should_refresh, last_refresh_time
  FROM _refresh_flags
  WHERE view_name = 'player_stats_materialized';

  -- Refresh if flagged OR if last refresh was more than 5 minutes ago
  IF should_refresh OR (NOW() - last_refresh_time > INTERVAL '5 minutes') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY player_stats_materialized;

    UPDATE _refresh_flags
    SET needs_refresh = false,
        last_refresh = NOW(),
        refresh_count = refresh_count + 1
    WHERE view_name = 'player_stats_materialized';

    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION refresh_stats_if_needed() TO service_role;

-- ============================================================================
-- 6. CONNECTION POOL MONITORING VIEW
-- Track connection usage for capacity planning
-- ============================================================================

CREATE OR REPLACE VIEW connection_stats AS
SELECT
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
  max(EXTRACT(EPOCH FROM (NOW() - query_start))) FILTER (WHERE state = 'active') as longest_query_seconds
FROM pg_stat_activity
WHERE datname = current_database();

COMMENT ON VIEW connection_stats IS 'Monitor connection pool usage for capacity planning';

-- ============================================================================
-- RECORD MIGRATION
-- ============================================================================

INSERT INTO _migrations (version, filename)
VALUES (33, '033_scalability_improvements.sql')
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- INITIAL REFRESH
-- ============================================================================

-- Do initial population of materialized view
REFRESH MATERIALIZED VIEW player_stats_materialized;
