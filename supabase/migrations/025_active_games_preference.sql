-- Migration 025: Add active games panel preference
-- Allows users to persist their Active Games panel collapsed state

-- Add column for active games panel state
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS active_games_collapsed BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN user_preferences.active_games_collapsed IS 'Whether the Active Games panel is collapsed by default';

-- Record migration
INSERT INTO _migrations (version, filename)
VALUES (25, '025_active_games_preference.sql')
ON CONFLICT (version) DO NOTHING;
