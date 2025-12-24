-- Migration: Create helper functions and triggers
-- Description: Database functions for common operations
-- Author: CoinFlip Team
-- Date: 2025-01-01

-- ===========================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ===========================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_updated_at_column IS 'Automatically updates updated_at timestamp';

-- Apply trigger to all tables
CREATE TRIGGER update_tiers_updated_at
  BEFORE UPDATE ON tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_updated_at
  BEFORE UPDATE ON queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_updated_at
  BEFORE UPDATE ON analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_stats_updated_at
  BEFORE UPDATE ON player_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================================================
-- GET ACTIVE GAMES FOR TIER
-- ===========================================================================

CREATE OR REPLACE FUNCTION get_active_games_by_tier(tier_id INTEGER)
RETURNS SETOF games
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM games
  WHERE tier = tier_id
    AND status IN ('created', 'matched', 'pending_vrf')
  ORDER BY created_at DESC;
$$;

COMMENT ON FUNCTION get_active_games_by_tier IS 'Returns all active games for a specific tier';

-- ===========================================================================
-- GET USER GAME HISTORY
-- ===========================================================================

CREATE OR REPLACE FUNCTION get_user_games(user_address TEXT, limit_count INTEGER DEFAULT 20)
RETURNS SETOF games
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM games
  WHERE creator = user_address
     OR joiner = user_address
  ORDER BY created_at DESC
  LIMIT limit_count;
$$;

COMMENT ON FUNCTION get_user_games IS 'Returns game history for a specific user';

-- ===========================================================================
-- UPDATE QUEUE COUNT FOR TIER
-- ===========================================================================

CREATE OR REPLACE FUNCTION update_tier_queue_count(tier_id INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  queue_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO queue_count
  FROM queue
  WHERE tier = tier_id
    AND matched = false
    AND expires_at > NOW();

  UPDATE tiers
  SET players_in_queue = queue_count
  WHERE id = tier_id;
END;
$$;

COMMENT ON FUNCTION update_tier_queue_count IS 'Updates the player count in queue for a tier';

-- ===========================================================================
-- CLEAN EXPIRED QUEUE ENTRIES
-- ===========================================================================

CREATE OR REPLACE FUNCTION clean_expired_queue_entries()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM queue
    WHERE expires_at < NOW()
      AND matched = false
    RETURNING tier
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  -- Update queue counts for affected tiers
  UPDATE tiers
  SET players_in_queue = (
    SELECT COUNT(*)
    FROM queue
    WHERE queue.tier = tiers.id
      AND matched = false
      AND expires_at > NOW()
  );

  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION clean_expired_queue_entries IS 'Removes expired queue entries and updates tier counts';

-- ===========================================================================
-- CALCULATE PLAYER WIN RATE
-- ===========================================================================

CREATE OR REPLACE FUNCTION calculate_win_rate(user_address TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        (COUNT(*) FILTER (WHERE winner = user_address)::NUMERIC / COUNT(*)::NUMERIC) * 100,
        2
      )
    END
  FROM games
  WHERE (creator = user_address OR joiner = user_address)
    AND status = 'resolved'
    AND winner IS NOT NULL;
$$;

COMMENT ON FUNCTION calculate_win_rate IS 'Calculates win rate percentage for a player';

-- ===========================================================================
-- GET LEADERBOARD
-- ===========================================================================

CREATE OR REPLACE FUNCTION get_leaderboard(
  order_by TEXT DEFAULT 'total_games',
  limit_count INTEGER DEFAULT 10
)
RETURNS SETOF player_stats
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  EXECUTE format('
    SELECT * FROM player_stats
    WHERE total_games > 0
    ORDER BY %I DESC
    LIMIT $1
  ', order_by)
  USING limit_count;
END;
$$;

COMMENT ON FUNCTION get_leaderboard IS 'Returns top players by specified metric (total_games, win_rate, total_volume_usd)';

-- ===========================================================================
-- MATCH PLAYERS IN QUEUE
-- ===========================================================================

CREATE OR REPLACE FUNCTION match_players_in_tier(tier_id INTEGER)
RETURNS TABLE (
  player1_id TEXT,
  player1_address TEXT,
  player2_id TEXT,
  player2_address TEXT,
  tier INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH available_players AS (
    SELECT
      id,
      player_address,
      tier,
      joined_at,
      ROW_NUMBER() OVER (ORDER BY joined_at) as row_num
    FROM queue
    WHERE queue.tier = tier_id
      AND matched = false
      AND expires_at > NOW()
    LIMIT 2
  )
  SELECT
    p1.id as player1_id,
    p1.player_address as player1_address,
    p2.id as player2_id,
    p2.player_address as player2_address,
    p1.tier
  FROM available_players p1
  JOIN available_players p2 ON p1.row_num = 1 AND p2.row_num = 2
  WHERE p1.player_address != p2.player_address;
END;
$$;

COMMENT ON FUNCTION match_players_in_tier IS 'Finds two available players in a tier for matching';

-- ===========================================================================
-- SUCCESS
-- ===========================================================================

DO $$
BEGIN
  RAISE NOTICE 'Functions and triggers created successfully';
  RAISE NOTICE '   - update_updated_at_column() + triggers';
  RAISE NOTICE '   - get_active_games_by_tier()';
  RAISE NOTICE '   - get_user_games()';
  RAISE NOTICE '   - update_tier_queue_count()';
  RAISE NOTICE '   - clean_expired_queue_entries()';
  RAISE NOTICE '   - calculate_win_rate()';
  RAISE NOTICE '   - get_leaderboard()';
  RAISE NOTICE '   - match_players_in_tier()';
END $$;
