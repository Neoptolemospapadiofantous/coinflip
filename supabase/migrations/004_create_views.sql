-- Create views for better query performance and cleaner code

-- Active games view (pending + matched games)
DROP VIEW IF EXISTS active_games CASCADE;
CREATE OR REPLACE VIEW active_games AS
SELECT * FROM games
WHERE status IN ('pending', 'matched')
ORDER BY created_at DESC;

-- Game statistics view (aggregated stats)
DROP VIEW IF EXISTS game_statistics CASCADE;
CREATE OR REPLACE VIEW game_statistics AS
SELECT
  COUNT(*) as total_games,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_games,
  COUNT(CASE WHEN status = 'matched' THEN 1 END) as matched_games,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_games,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_games,

  -- Average game duration (from creation to resolution)
  AVG(
    EXTRACT(EPOCH FROM (resolved_at - created_at))
  ) FILTER (WHERE status = 'resolved') as avg_game_duration_seconds,

  -- Total volume
  SUM(
    CASE
      WHEN status = 'resolved' THEN (amount::numeric * 2)
      ELSE 0
    END
  ) as total_volume_wei,

  -- Unique players (count distinct creator and joiner addresses)
  (
    SELECT COUNT(DISTINCT player_address)
    FROM (
      SELECT creator_address as player_address FROM games
      UNION
      SELECT joiner_address FROM games WHERE joiner_address IS NOT NULL
    ) players
  ) as total_unique_players,

  -- Games by tier
  (
    SELECT jsonb_object_agg(tier::text, tier_count)
    FROM (
      SELECT tier, COUNT(*) as tier_count
      FROM games
      GROUP BY tier
    ) tier_counts
  ) as games_by_tier
FROM games;

-- Player leaderboard view
DROP VIEW IF EXISTS player_leaderboard CASCADE;
CREATE OR REPLACE VIEW player_leaderboard AS
SELECT
  player_address,
  COUNT(*) as total_games,
  SUM(CASE WHEN winner_address = player_address THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN winner_address != player_address AND status = 'resolved' THEN 1 ELSE 0 END) as losses,
  ROUND(
    (SUM(CASE WHEN winner_address = player_address THEN 1 ELSE 0 END)::numeric /
     NULLIF(COUNT(CASE WHEN status = 'resolved' THEN 1 END), 0)) * 100,
    2
  ) as win_rate_percentage,
  SUM(CASE WHEN winner_address = player_address THEN payout::numeric ELSE 0 END) as total_winnings_wei,
  MAX(created_at) as last_game_at,
  MIN(created_at) as first_game_at
FROM (
  SELECT
    creator_address as player_address,
    winner_address,
    status,
    payout,
    created_at
  FROM games
  WHERE status = 'resolved'

  UNION ALL

  SELECT
    joiner_address as player_address,
    winner_address,
    status,
    payout,
    created_at
  FROM games
  WHERE status = 'resolved' AND joiner_address IS NOT NULL
) player_games
GROUP BY player_address
ORDER BY wins DESC, total_games DESC;

-- Recent games view (last 100 games with full details)
DROP VIEW IF EXISTS recent_games CASCADE;
CREATE OR REPLACE VIEW recent_games AS
SELECT
  g.*,
  t.amount_usd as tier_amount_usd,
  t.win_amount_usd as tier_win_amount_usd
FROM games g
LEFT JOIN tiers t ON g.tier = t.id
ORDER BY g.created_at DESC
LIMIT 100;

-- Grant permissions
GRANT SELECT ON active_games TO anon, authenticated;
GRANT SELECT ON game_statistics TO anon, authenticated;
GRANT SELECT ON player_leaderboard TO anon, authenticated;
GRANT SELECT ON recent_games TO anon, authenticated;

-- Add helpful comment
COMMENT ON VIEW active_games IS 'Shows all active games (pending + matched status)';
COMMENT ON VIEW game_statistics IS 'Aggregated statistics about all games';
COMMENT ON VIEW player_leaderboard IS 'Player rankings by wins and win rate';
COMMENT ON VIEW recent_games IS 'Last 100 games with tier information';
