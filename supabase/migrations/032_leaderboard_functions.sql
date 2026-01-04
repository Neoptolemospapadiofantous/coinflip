-- Migration 032: Leaderboard RPC Functions
-- Provides paginated leaderboard queries for different ranking types
-- Connects to existing player_leaderboard view from migration 004

-- ============================================================================
-- LEADERBOARD BY WINS
-- Returns players ranked by total wins
-- ============================================================================

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
  WITH player_stats AS (
    SELECT
      pl.player_address,
      pl.wins,
      pl.losses,
      pl.total_games,
      pl.win_rate_percentage as win_rate,
      pl.total_winnings_wei as total_profit,
      COALESCE((
        SELECT SUM(g.amount::numeric)
        FROM games g
        WHERE g.status = 'resolved'
          AND (lower(g.creator_address) = lower(pl.player_address)
               OR lower(g.joiner_address) = lower(pl.player_address))
      ), 0) as total_wagered
    FROM player_leaderboard pl
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY ps.wins DESC, ps.total_games DESC, ps.win_rate DESC NULLS LAST)::BIGINT as rank,
    ps.player_address::TEXT,
    ps.wins::BIGINT,
    ps.losses::BIGINT,
    ps.total_games::BIGINT,
    COALESCE(ps.win_rate, 0)::NUMERIC,
    COALESCE(ps.total_profit, 0)::NUMERIC,
    ps.total_wagered::NUMERIC
  FROM player_stats ps
  ORDER BY ps.wins DESC, ps.total_games DESC, ps.win_rate DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- LEADERBOARD BY PROFIT
-- Returns players ranked by total profit (winnings)
-- ============================================================================

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
  WITH player_stats AS (
    SELECT
      pl.player_address,
      pl.wins,
      pl.losses,
      pl.total_games,
      pl.win_rate_percentage as win_rate,
      pl.total_winnings_wei as total_profit,
      COALESCE((
        SELECT SUM(g.amount::numeric)
        FROM games g
        WHERE g.status = 'resolved'
          AND (lower(g.creator_address) = lower(pl.player_address)
               OR lower(g.joiner_address) = lower(pl.player_address))
      ), 0) as total_wagered
    FROM player_leaderboard pl
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY ps.total_profit DESC NULLS LAST, ps.wins DESC)::BIGINT as rank,
    ps.player_address::TEXT,
    ps.wins::BIGINT,
    ps.losses::BIGINT,
    ps.total_games::BIGINT,
    COALESCE(ps.win_rate, 0)::NUMERIC,
    COALESCE(ps.total_profit, 0)::NUMERIC,
    ps.total_wagered::NUMERIC
  FROM player_stats ps
  ORDER BY ps.total_profit DESC NULLS LAST, ps.wins DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- LEADERBOARD BY WIN RATE
-- Returns players ranked by win rate (minimum games threshold)
-- ============================================================================

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
  WITH player_stats AS (
    SELECT
      pl.player_address,
      pl.wins,
      pl.losses,
      pl.total_games,
      pl.win_rate_percentage as win_rate,
      pl.total_winnings_wei as total_profit,
      COALESCE((
        SELECT SUM(g.amount::numeric)
        FROM games g
        WHERE g.status = 'resolved'
          AND (lower(g.creator_address) = lower(pl.player_address)
               OR lower(g.joiner_address) = lower(pl.player_address))
      ), 0) as total_wagered
    FROM player_leaderboard pl
    WHERE pl.total_games >= p_min_games
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY ps.win_rate DESC NULLS LAST, ps.wins DESC, ps.total_games DESC)::BIGINT as rank,
    ps.player_address::TEXT,
    ps.wins::BIGINT,
    ps.losses::BIGINT,
    ps.total_games::BIGINT,
    COALESCE(ps.win_rate, 0)::NUMERIC,
    COALESCE(ps.total_profit, 0)::NUMERIC,
    ps.total_wagered::NUMERIC
  FROM player_stats ps
  ORDER BY ps.win_rate DESC NULLS LAST, ps.wins DESC, ps.total_games DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- LEADERBOARD BY VOLUME
-- Returns players ranked by total amount wagered
-- ============================================================================

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
  WITH player_stats AS (
    SELECT
      pl.player_address,
      pl.wins,
      pl.losses,
      pl.total_games,
      pl.win_rate_percentage as win_rate,
      pl.total_winnings_wei as total_profit,
      COALESCE((
        SELECT SUM(g.amount::numeric)
        FROM games g
        WHERE g.status = 'resolved'
          AND (lower(g.creator_address) = lower(pl.player_address)
               OR lower(g.joiner_address) = lower(pl.player_address))
      ), 0) as total_wagered
    FROM player_leaderboard pl
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY ps.total_wagered DESC, ps.total_games DESC)::BIGINT as rank,
    ps.player_address::TEXT,
    ps.wins::BIGINT,
    ps.losses::BIGINT,
    ps.total_games::BIGINT,
    COALESCE(ps.win_rate, 0)::NUMERIC,
    COALESCE(ps.total_profit, 0)::NUMERIC,
    ps.total_wagered::NUMERIC
  FROM player_stats ps
  ORDER BY ps.total_wagered DESC, ps.total_games DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- GET PLAYER RANK
-- Returns a specific player's rank across all categories
-- ============================================================================

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
  WITH player_stats AS (
    SELECT
      pl.player_address,
      pl.wins,
      pl.losses,
      pl.total_games,
      pl.win_rate_percentage as win_rate,
      pl.total_winnings_wei as total_profit,
      COALESCE((
        SELECT SUM(g.amount::numeric)
        FROM games g
        WHERE g.status = 'resolved'
          AND (lower(g.creator_address) = lower(pl.player_address)
               OR lower(g.joiner_address) = lower(pl.player_address))
      ), 0) as total_wagered
    FROM player_leaderboard pl
  ),
  ranked AS (
    SELECT
      ps.*,
      ROW_NUMBER() OVER (ORDER BY ps.wins DESC, ps.total_games DESC) as rk_wins,
      ROW_NUMBER() OVER (ORDER BY ps.total_profit DESC NULLS LAST) as rk_profit,
      ROW_NUMBER() OVER (ORDER BY ps.win_rate DESC NULLS LAST, ps.wins DESC) as rk_winrate,
      ROW_NUMBER() OVER (ORDER BY ps.total_wagered DESC) as rk_volume
    FROM player_stats ps
  ),
  total AS (
    SELECT COUNT(*)::BIGINT as cnt FROM player_leaderboard
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
  LEFT JOIN ranked r ON lower(r.player_address) = lower_addr;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- GET LEADERBOARD STATS
-- Returns aggregate stats for the leaderboard page
-- ============================================================================

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
    COUNT(DISTINCT pl.player_address)::BIGINT as total_players,
    SUM(pl.total_games)::BIGINT / 2 as total_games, -- Divide by 2 since each game has 2 players
    SUM(pl.total_winnings_wei)::NUMERIC as total_volume,
    ROUND(AVG(pl.win_rate_percentage), 2)::NUMERIC as avg_win_rate
  FROM player_leaderboard pl;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_leaderboard_by_wins(INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_by_profit(INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_by_winrate(INTEGER, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_by_volume(INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_player_rank(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard_stats() TO anon, authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_leaderboard_by_wins IS 'Get paginated leaderboard sorted by total wins';
COMMENT ON FUNCTION get_leaderboard_by_profit IS 'Get paginated leaderboard sorted by total profit';
COMMENT ON FUNCTION get_leaderboard_by_winrate IS 'Get paginated leaderboard sorted by win rate (min games threshold)';
COMMENT ON FUNCTION get_leaderboard_by_volume IS 'Get paginated leaderboard sorted by total volume wagered';
COMMENT ON FUNCTION get_player_rank IS 'Get a specific player rank across all leaderboard categories';
COMMENT ON FUNCTION get_leaderboard_stats IS 'Get aggregate statistics for the leaderboard page';

-- ============================================================================
-- RECORD MIGRATION
-- ============================================================================

INSERT INTO _migrations (version, filename)
VALUES (32, '032_leaderboard_functions.sql')
ON CONFLICT (version) DO NOTHING;
