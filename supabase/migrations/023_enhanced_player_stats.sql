-- Migration 023: Enhanced Player Stats RPC
-- Consolidates 3 separate queries into a single RPC call for better performance

-- ============================================================================
-- ENHANCED PLAYER STATS FUNCTION
-- Returns all player statistics including tier breakdown and pending count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_player_stats_v2(player_address text)
RETURNS TABLE(
  -- Basic stats (from original get_player_stats)
  total_games bigint,
  wins bigint,
  losses bigint,
  total_wagered numeric,
  total_won numeric,
  total_lost numeric,
  net_profit numeric,
  win_rate numeric,
  -- NEW: Pending/matched games count
  pending_games bigint,
  -- NEW: Tier breakdown as JSON arrays
  games_by_tier jsonb,
  wins_by_tier jsonb
) AS $$
DECLARE
  lower_addr text := lower(player_address);
BEGIN
  RETURN QUERY
  WITH player_resolved AS (
    -- All resolved games for this player
    SELECT
      g.tier,
      g.winner_address,
      g.amount::numeric as amount,
      g.payout::numeric as payout
    FROM games g
    WHERE g.status = 'resolved'
      AND (lower(g.creator_address) = lower_addr OR lower(g.joiner_address) = lower_addr)
  ),
  player_active AS (
    -- All pending/matched games for this player
    SELECT COUNT(*) as cnt
    FROM games g
    WHERE g.status IN ('pending', 'matched')
      AND (lower(g.creator_address) = lower_addr OR lower(g.joiner_address) = lower_addr)
  ),
  tier_stats AS (
    -- Games and wins by tier (0-4)
    SELECT
      jsonb_build_array(
        COALESCE(SUM(CASE WHEN tier = 0 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tier = 1 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tier = 2 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tier = 3 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tier = 4 THEN 1 ELSE 0 END), 0)
      ) as games_arr,
      jsonb_build_array(
        COALESCE(SUM(CASE WHEN tier = 0 AND lower(winner_address) = lower_addr THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tier = 1 AND lower(winner_address) = lower_addr THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tier = 2 AND lower(winner_address) = lower_addr THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tier = 3 AND lower(winner_address) = lower_addr THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tier = 4 AND lower(winner_address) = lower_addr THEN 1 ELSE 0 END), 0)
      ) as wins_arr
    FROM player_resolved
  ),
  basic_stats AS (
    SELECT
      COUNT(*)::bigint as total_games,
      COUNT(*) FILTER (WHERE lower(winner_address) = lower_addr)::bigint as wins,
      COUNT(*) FILTER (WHERE winner_address IS NOT NULL AND lower(winner_address) != lower_addr)::bigint as losses,
      COALESCE(SUM(amount), 0) as total_wagered,
      COALESCE(SUM(payout) FILTER (WHERE lower(winner_address) = lower_addr), 0) as total_won,
      COALESCE(SUM(amount) FILTER (WHERE winner_address IS NOT NULL AND lower(winner_address) != lower_addr), 0) as total_lost
    FROM player_resolved
  )
  SELECT
    bs.total_games,
    bs.wins,
    bs.losses,
    bs.total_wagered,
    bs.total_won,
    bs.total_lost,
    bs.total_won - bs.total_lost as net_profit,
    CASE
      WHEN bs.wins + bs.losses = 0 THEN 0
      ELSE ROUND((bs.wins::numeric / (bs.wins + bs.losses)::numeric) * 100, 2)
    END as win_rate,
    pa.cnt as pending_games,
    ts.games_arr as games_by_tier,
    ts.wins_arr as wins_by_tier
  FROM basic_stats bs
  CROSS JOIN player_active pa
  CROSS JOIN tier_stats ts;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add helpful comment
COMMENT ON FUNCTION get_player_stats_v2(text) IS
  'Enhanced player stats: returns basic stats, tier breakdown, and pending count in a single query';

-- ============================================================================
-- RECORD MIGRATION
-- ============================================================================

INSERT INTO _migrations (version, filename)
VALUES (23, '023_enhanced_player_stats.sql')
ON CONFLICT (version) DO NOTHING;
