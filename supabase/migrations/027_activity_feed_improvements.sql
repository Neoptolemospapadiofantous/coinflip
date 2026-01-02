-- Migration 027: Activity Feed Improvements
-- 1. Add unique constraint to prevent duplicate activity entries
-- 2. Add activity_collapsed preference to user_preferences

-- ============================================
-- 1. PREVENT DUPLICATE ACTIVITY ENTRIES
-- ============================================

-- Add unique constraint on game_id + event_type
-- This prevents the same event from being recorded twice
ALTER TABLE activity_feed
ADD CONSTRAINT activity_feed_unique_event UNIQUE (game_id, event_type);

-- Update the trigger to use ON CONFLICT to skip duplicates
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

    -- Track opponent
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

  -- Insert activity entry (skip if duplicate)
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
  )
  ON CONFLICT (game_id, event_type) DO NOTHING;

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

-- ============================================
-- 2. ADD ACTIVITY COLLAPSED PREFERENCE
-- ============================================

-- Add column for activity feed panel state
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS activity_feed_collapsed BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN user_preferences.activity_feed_collapsed IS 'Whether the Activity Feed panel is collapsed by default';

-- ============================================
-- 3. CLEAN UP EXISTING DUPLICATES
-- ============================================

-- Remove duplicates keeping only the oldest entry per game_id + event_type
DELETE FROM activity_feed a
WHERE a.id NOT IN (
  SELECT MIN(id)
  FROM activity_feed
  GROUP BY game_id, event_type
);

-- ============================================
-- 4. RECORD MIGRATION
-- ============================================
INSERT INTO _migrations (version, filename)
VALUES (27, '027_activity_feed_improvements.sql')
ON CONFLICT (version) DO NOTHING;
