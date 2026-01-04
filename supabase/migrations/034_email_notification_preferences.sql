-- Add email notification preferences to user_preferences table

-- Add email notification columns
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_on_game_matched BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS email_on_game_resolved BOOLEAN NOT NULL DEFAULT TRUE;

-- Also add UI collapse preferences if they don't exist
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS active_games_collapsed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS activity_feed_collapsed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN user_preferences.email_notifications_enabled IS 'Master toggle for email notifications';
COMMENT ON COLUMN user_preferences.email_on_game_matched IS 'Send email when a game is matched';
COMMENT ON COLUMN user_preferences.email_on_game_resolved IS 'Send email when a game is resolved';
