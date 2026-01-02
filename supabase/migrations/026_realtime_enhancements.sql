-- Migration 026: Realtime UX Enhancements
-- Adds: Per-tier pending counts, Global activity feed, Match time tracking

-- ============================================
-- 1. PER-TIER PENDING COUNTS VIEW
-- ============================================
-- Provides realtime counts of pending games per tier for faster matching decisions

DROP VIEW IF EXISTS pending_games_by_tier CASCADE;
CREATE OR REPLACE VIEW pending_games_by_tier AS
SELECT
  t.id as tier_id,
  t.amount,
  t.amount_usd,
  COUNT(g.id) as pending_count,
  MIN(g.created_at) as oldest_pending_at
FROM tiers t
LEFT JOIN games g ON g.tier = t.id AND g.status = 'pending'
WHERE t.enabled = true
GROUP BY t.id, t.amount, t.amount_usd
ORDER BY t.id;

GRANT SELECT ON pending_games_by_tier TO anon, authenticated;
COMMENT ON VIEW pending_games_by_tier IS 'Pending game counts per tier for matchmaking visibility';

-- ============================================
-- 2. GLOBAL ACTIVITY FEED TABLE
-- ============================================
-- Stores recent game events for realtime activity feed
-- Auto-cleaned to keep only last 100 entries

CREATE TABLE IF NOT EXISTS activity_feed (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('game_created', 'game_matched', 'game_resolved', 'big_win')),
  game_id BIGINT REFERENCES games(id) ON DELETE CASCADE,
  player_address TEXT,
  opponent_address TEXT,
  tier INTEGER,
  amount TEXT,
  payout TEXT,
  is_winner BOOLEAN,
  coin_result BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON activity_feed(created_at DESC);

-- Enable RLS
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

-- Anyone can read the activity feed
DROP POLICY IF EXISTS "Activity feed is viewable by everyone" ON activity_feed;
CREATE POLICY "Activity feed is viewable by everyone"
  ON activity_feed FOR SELECT
  USING (true);

-- Only service role can insert (via triggers)
DROP POLICY IF EXISTS "Activity feed insert by service" ON activity_feed;
CREATE POLICY "Activity feed insert by service"
  ON activity_feed FOR INSERT
  WITH CHECK (true);

-- Enable realtime for activity feed
ALTER PUBLICATION supabase_realtime ADD TABLE activity_feed;

GRANT SELECT ON activity_feed TO anon, authenticated;
COMMENT ON TABLE activity_feed IS 'Realtime feed of game events for social engagement';

-- ============================================
-- 3. TRIGGER: Auto-populate activity feed
-- ============================================

CREATE OR REPLACE FUNCTION populate_activity_feed()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_player_address TEXT;
  v_opponent_address TEXT;
  v_is_winner BOOLEAN;
  v_payout TEXT;
BEGIN
  -- Determine event type based on status change
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    v_event_type := 'game_created';
    v_player_address := NEW.creator_address;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'matched' THEN
    v_event_type := 'game_matched';
    v_player_address := NEW.joiner_address;
    v_opponent_address := NEW.creator_address;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'matched' AND NEW.status = 'resolved' THEN
    v_event_type := 'game_resolved';
    v_player_address := NEW.winner_address;
    v_is_winner := true;
    v_payout := NEW.payout;

    -- Also track the loser (opposite player)
    IF NEW.winner_address = NEW.creator_address THEN
      v_opponent_address := NEW.joiner_address;
    ELSE
      v_opponent_address := NEW.creator_address;
    END IF;

    -- Check for big win (tier 3 or 4)
    IF NEW.tier >= 3 THEN
      v_event_type := 'big_win';
    END IF;

  ELSE
    -- Skip other transitions (cancelled, etc.)
    RETURN NEW;
  END IF;

  -- Insert activity entry
  INSERT INTO activity_feed (
    event_type,
    game_id,
    player_address,
    opponent_address,
    tier,
    amount,
    payout,
    is_winner,
    coin_result
  ) VALUES (
    v_event_type,
    NEW.id,
    v_player_address,
    v_opponent_address,
    NEW.tier,
    NEW.amount,
    v_payout,
    v_is_winner,
    NEW.coin_result
  );

  -- Cleanup: Keep only last 100 entries
  DELETE FROM activity_feed
  WHERE id NOT IN (
    SELECT id FROM activity_feed
    ORDER BY created_at DESC
    LIMIT 100
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_populate_activity_feed ON games;
CREATE TRIGGER trigger_populate_activity_feed
  AFTER INSERT OR UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION populate_activity_feed();

-- ============================================
-- 4. MATCH TIME TRACKING
-- ============================================
-- Extend game_statistics view with per-tier match time averages

DROP VIEW IF EXISTS tier_match_stats CASCADE;
CREATE OR REPLACE VIEW tier_match_stats AS
SELECT
  tier,
  COUNT(*) FILTER (WHERE status = 'resolved') as total_resolved,
  COUNT(*) FILTER (WHERE status = 'pending') as currently_pending,
  -- Average time from creation to match (in seconds)
  ROUND(AVG(
    EXTRACT(EPOCH FROM (matched_at - created_at))
  ) FILTER (WHERE matched_at IS NOT NULL))::INTEGER as avg_match_time_seconds,
  -- Median approximation using percentile
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (matched_at - created_at))
  ) FILTER (WHERE matched_at IS NOT NULL))::INTEGER as median_match_time_seconds,
  -- 90th percentile for "worst case" estimate
  ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (matched_at - created_at))
  ) FILTER (WHERE matched_at IS NOT NULL))::INTEGER as p90_match_time_seconds,
  -- Recent average (last 24 hours) for more accurate current estimate
  ROUND(AVG(
    EXTRACT(EPOCH FROM (matched_at - created_at))
  ) FILTER (WHERE matched_at IS NOT NULL AND matched_at > NOW() - INTERVAL '24 hours'))::INTEGER as recent_avg_match_time_seconds,
  -- Count of recent matches (for confidence)
  COUNT(*) FILTER (WHERE matched_at IS NOT NULL AND matched_at > NOW() - INTERVAL '24 hours') as recent_match_count
FROM games
WHERE tier IS NOT NULL
GROUP BY tier
ORDER BY tier;

GRANT SELECT ON tier_match_stats TO anon, authenticated;
COMMENT ON VIEW tier_match_stats IS 'Match time statistics per tier for ETA estimation';

-- ============================================
-- 5. INDEXER STATE REALTIME
-- ============================================
-- Enable realtime on indexer_state (if not already)
DO $$
BEGIN
  -- Check if already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'indexer_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE indexer_state;
  END IF;
END $$;

-- ============================================
-- 6. RPC FUNCTION: Get realtime stats
-- ============================================
-- Single RPC call for all realtime dashboard data

CREATE OR REPLACE FUNCTION get_realtime_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'pending_by_tier', (
      SELECT json_agg(row_to_json(t))
      FROM pending_games_by_tier t
    ),
    'match_times', (
      SELECT json_agg(row_to_json(t))
      FROM tier_match_stats t
    ),
    'recent_activity', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT * FROM activity_feed
        ORDER BY created_at DESC
        LIMIT 10
      ) t
    ),
    'indexer_state', (
      SELECT json_build_object(
        'last_block', last_processed_block,
        'updated_at', updated_at
      )
      FROM indexer_state
      WHERE indexer_name = 'coinflip_events'
      LIMIT 1
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_realtime_stats() TO anon, authenticated;
COMMENT ON FUNCTION get_realtime_stats() IS 'Single RPC call for all realtime dashboard data';

-- ============================================
-- 7. RECORD MIGRATION
-- ============================================
INSERT INTO _migrations (version, filename)
VALUES (26, '026_realtime_enhancements.sql')
ON CONFLICT (version) DO NOTHING;
