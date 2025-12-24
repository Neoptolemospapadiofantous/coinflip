-- Indexer State Table
-- Tracks the last processed block for each indexer

CREATE TABLE IF NOT EXISTS indexer_state (
  indexer_name TEXT PRIMARY KEY,
  last_processed_block TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE indexer_state ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read
CREATE POLICY "Indexer state is viewable by everyone"
  ON indexer_state FOR SELECT
  USING (true);

-- Policy: Anyone can insert/update (restrict to service role in production)
CREATE POLICY "Indexer state can be modified by anyone"
  ON indexer_state FOR ALL
  USING (true);

COMMENT ON TABLE indexer_state IS 'Tracks last processed block number for event indexers';
