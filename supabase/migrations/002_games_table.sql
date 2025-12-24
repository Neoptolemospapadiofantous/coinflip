-- Games Table Migration
-- Stores all coinflip games synced from blockchain events

-- Drop existing table if it exists
DROP TABLE IF EXISTS games CASCADE;

-- Create games table
CREATE TABLE games (
  -- Primary identifiers
  id BIGINT PRIMARY KEY,                    -- Game ID from contract
  tx_hash TEXT NOT NULL,                    -- Transaction hash of GameCreated event

  -- Game configuration
  tier INTEGER NOT NULL,                    -- Tier level (0-4)
  amount TEXT NOT NULL,                     -- Bet amount in wei

  -- Player information
  creator_address TEXT NOT NULL,            -- Address of player who created game
  creator_choice BOOLEAN NOT NULL,          -- Creator's choice (false=Heads, true=Tails)
  joiner_address TEXT,                      -- Address of player who joined (null if pending)
  joiner_choice BOOLEAN,                    -- Joiner's choice (null if pending)

  -- Game state
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | matched | resolved | cancelled
  winner_address TEXT,                      -- Address of winner (null until resolved)
  random_number TEXT,                       -- VRF random number (null until resolved)
  payout TEXT,                              -- Payout amount in wei (null until resolved)

  -- Blockchain tracking
  block_number BIGINT NOT NULL,             -- Block number of creation
  matched_tx_hash TEXT,                     -- Transaction hash of GameMatched event
  matched_block_number BIGINT,              -- Block number when matched
  resolved_tx_hash TEXT,                    -- Transaction hash of GameResolved event
  resolved_block_number BIGINT,             -- Block number when resolved
  cancelled_tx_hash TEXT,                   -- Transaction hash if cancelled
  cancelled_block_number BIGINT,            -- Block number if cancelled

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'matched', 'resolved', 'cancelled')),
  CONSTRAINT valid_tier CHECK (tier >= 0 AND tier <= 4)
);

-- Create indexes for efficient queries
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_tier ON games(tier);
CREATE INDEX idx_games_creator ON games(creator_address);
CREATE INDEX idx_games_joiner ON games(joiner_address);
CREATE INDEX idx_games_created_at ON games(created_at DESC);
CREATE INDEX idx_games_block_number ON games(block_number DESC);

-- Index for finding pending games by tier
CREATE INDEX idx_games_pending_tier ON games(tier, created_at DESC) WHERE status = 'pending';

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read games
CREATE POLICY "Games are viewable by everyone"
  ON games FOR SELECT
  USING (true);

-- Policy: Only the indexer service can insert/update games
-- For now, allow all inserts (you can restrict this later with a service role)
CREATE POLICY "Games can be inserted by anyone"
  ON games FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Games can be updated by anyone"
  ON games FOR UPDATE
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_games_updated_at_trigger
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_games_updated_at();

-- Create view for active games (pending + matched)
CREATE VIEW active_games AS
SELECT
  g.*,
  t.amount_usd,
  t.win_amount_usd,
  CASE
    WHEN g.status = 'pending' THEN EXTRACT(EPOCH FROM (NOW() - g.created_at))
    WHEN g.status = 'matched' THEN EXTRACT(EPOCH FROM (NOW() - g.matched_at))
    ELSE 0
  END as time_waiting_seconds
FROM games g
JOIN tiers t ON g.tier = t.id
WHERE g.status IN ('pending', 'matched')
ORDER BY g.created_at DESC;

-- Create view for pending games grouped by tier
CREATE VIEW pending_games_by_tier AS
SELECT
  tier,
  COUNT(*) as players_in_queue,
  MIN(created_at) as oldest_game,
  MAX(created_at) as newest_game
FROM games
WHERE status = 'pending'
GROUP BY tier;

-- Create view for game statistics
CREATE VIEW game_statistics AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'matched') as matched_count,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
  COUNT(*) as total_games,
  SUM(CAST(payout AS NUMERIC)) FILTER (WHERE status = 'resolved') as total_payouts,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) FILTER (WHERE status = 'resolved') as avg_game_duration_seconds
FROM games;

-- Insert sample comment
COMMENT ON TABLE games IS 'Stores all coinflip games synced from blockchain events';
COMMENT ON COLUMN games.status IS 'Game status: pending (waiting for joiner), matched (both players joined, waiting for VRF), resolved (game complete), cancelled (creator cancelled)';
COMMENT ON COLUMN games.creator_choice IS 'false = Heads (0), true = Tails (1)';
