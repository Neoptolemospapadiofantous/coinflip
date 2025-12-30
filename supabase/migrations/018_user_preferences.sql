-- User Preferences Table
-- Stores user settings that should persist across devices/sessions

CREATE TABLE IF NOT EXISTS user_preferences (
  -- Primary key
  user_address TEXT PRIMARY KEY,

  -- Animation preferences
  skip_animation BOOLEAN NOT NULL DEFAULT FALSE,

  -- Sound preferences
  sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Quick re-bet settings (from last completed game)
  last_game_tier INTEGER,
  last_game_choice BOOLEAN, -- false = heads, true = tails
  last_game_was_win BOOLEAN,
  last_game_amount TEXT,

  -- Game creation defaults (remembered selections)
  default_tier INTEGER,
  default_choice BOOLEAN,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_address ON user_preferences(user_address);

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_user_preferences_updated_at_trigger ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at_trigger
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

COMMENT ON TABLE user_preferences IS 'User settings and preferences that persist across sessions';
