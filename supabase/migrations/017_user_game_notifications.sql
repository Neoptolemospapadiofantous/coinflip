-- User Game Notifications Table
-- Tracks which modals/sounds have been shown to each user per game
-- Prevents duplicate notifications across devices/sessions

CREATE TABLE IF NOT EXISTS user_game_notifications (
  -- Composite primary key
  user_address TEXT NOT NULL,
  game_id BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,

  -- Modal tracking
  matched_modal_shown BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_modal_shown BOOLEAN NOT NULL DEFAULT FALSE,
  expired_modal_shown BOOLEAN NOT NULL DEFAULT FALSE,

  -- Sound tracking
  matched_sound_played BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_sound_played BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Primary key
  PRIMARY KEY (user_address, game_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_user_game_notifications_user ON user_game_notifications(user_address);
CREATE INDEX idx_user_game_notifications_game ON user_game_notifications(game_id);

-- Enable Row Level Security
ALTER TABLE user_game_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON user_game_notifications;
CREATE POLICY "Users can view own notifications"
  ON user_game_notifications FOR SELECT
  USING (true);

-- Policy: Users can insert their own notifications
DROP POLICY IF EXISTS "Users can insert own notifications" ON user_game_notifications;
CREATE POLICY "Users can insert own notifications"
  ON user_game_notifications FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON user_game_notifications;
CREATE POLICY "Users can update own notifications"
  ON user_game_notifications FOR UPDATE
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_game_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_game_notifications_updated_at_trigger ON user_game_notifications;
CREATE TRIGGER update_user_game_notifications_updated_at_trigger
  BEFORE UPDATE ON user_game_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_user_game_notifications_updated_at();

-- Cleanup old notifications (games older than 7 days)
-- This can be run periodically via a cron job or Supabase scheduled function
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM user_game_notifications
  WHERE game_id IN (
    SELECT id FROM games
    WHERE created_at < NOW() - INTERVAL '7 days'
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE user_game_notifications IS 'Tracks which game notifications (modals/sounds) have been shown to each user';
