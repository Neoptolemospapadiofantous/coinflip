-- Migration 021: Scalability Indexes
-- Additional indexes for high-concurrency scenarios (1000+ users)

-- ============================================================================
-- PLAYER GAME LOOKUPS (for usePlayerGames OR queries)
-- ============================================================================

-- General index on creator_address for all game lookups (not just resolved)
CREATE INDEX IF NOT EXISTS idx_games_creator_address
ON games(creator_address);

-- General index on joiner_address for all game lookups
CREATE INDEX IF NOT EXISTS idx_games_joiner_address
ON games(joiner_address);

-- Composite index for player games with status (covers common filter pattern)
CREATE INDEX IF NOT EXISTS idx_games_creator_status_created
ON games(creator_address, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_games_joiner_status_created
ON games(joiner_address, status, created_at DESC);

-- ============================================================================
-- PENDING GAMES (heavily queried by game list)
-- ============================================================================

-- Index for pending games listing
CREATE INDEX IF NOT EXISTS idx_games_pending_created
ON games(created_at DESC)
WHERE status = 'pending';

-- ============================================================================
-- FUNCTION: Aggregate player stats at database level (avoids N+1)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_player_stats(player_address text)
RETURNS TABLE(
  total_games bigint,
  wins bigint,
  losses bigint,
  total_wagered numeric,
  total_won numeric,
  total_lost numeric,
  net_profit numeric,
  win_rate numeric
) AS $$
DECLARE
  lower_addr text := lower(player_address);
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_games,
    COUNT(*) FILTER (WHERE lower(winner_address) = lower_addr)::bigint as wins,
    COUNT(*) FILTER (WHERE winner_address IS NOT NULL AND lower(winner_address) != lower_addr)::bigint as losses,
    COALESCE(SUM(amount), 0) as total_wagered,
    COALESCE(SUM(payout) FILTER (WHERE lower(winner_address) = lower_addr), 0) as total_won,
    COALESCE(SUM(amount) FILTER (WHERE winner_address IS NOT NULL AND lower(winner_address) != lower_addr), 0) as total_lost,
    COALESCE(SUM(payout) FILTER (WHERE lower(winner_address) = lower_addr), 0) -
      COALESCE(SUM(amount) FILTER (WHERE winner_address IS NOT NULL AND lower(winner_address) != lower_addr), 0) as net_profit,
    CASE
      WHEN COUNT(*) FILTER (WHERE winner_address IS NOT NULL) = 0 THEN 0
      ELSE ROUND(
        (COUNT(*) FILTER (WHERE lower(winner_address) = lower_addr)::numeric /
         NULLIF(COUNT(*) FILTER (WHERE winner_address IS NOT NULL), 0)::numeric) * 100,
        2
      )
    END as win_rate
  FROM games
  WHERE status = 'resolved'
    AND (lower(creator_address) = lower_addr OR lower(joiner_address) = lower_addr);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- RECORD MIGRATION
-- ============================================================================

INSERT INTO _migrations (version, filename)
VALUES (21, '021_scalability_indexes.sql')
ON CONFLICT (version) DO NOTHING;
