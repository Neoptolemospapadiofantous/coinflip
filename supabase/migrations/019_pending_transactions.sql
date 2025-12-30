-- Pending Transactions Table
-- Tracks blockchain transactions that are in-flight (awaiting confirmation)
-- Enables cross-device/session visibility of pending operations

CREATE TABLE IF NOT EXISTS pending_transactions (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,

  -- User who initiated the transaction
  user_address TEXT NOT NULL,

  -- Transaction type
  tx_type TEXT NOT NULL CHECK (tx_type IN ('create', 'cancel', 'join')),

  -- Transaction hash (set when tx is submitted to blockchain)
  tx_hash TEXT,

  -- Game ID (for cancel/join operations)
  game_id BIGINT REFERENCES games(id) ON DELETE CASCADE,

  -- Create operation details
  tier INTEGER,
  choice BOOLEAN, -- false = heads, true = tails
  amount_eth TEXT,

  -- Transaction status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed', 'expired')),

  -- Error message if failed
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index to prevent duplicate pending transactions
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_create
  ON pending_transactions(user_address, tx_type, COALESCE(game_id, -1))
  WHERE status IN ('pending', 'submitted');

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_pending_tx_user ON pending_transactions(user_address);
CREATE INDEX IF NOT EXISTS idx_pending_tx_status ON pending_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pending_tx_user_status ON pending_transactions(user_address, status);
CREATE INDEX IF NOT EXISTS idx_pending_tx_hash ON pending_transactions(tx_hash) WHERE tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_tx_game ON pending_transactions(game_id) WHERE game_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE pending_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own pending transactions" ON pending_transactions;
CREATE POLICY "Users can view own pending transactions"
  ON pending_transactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own pending transactions" ON pending_transactions;
CREATE POLICY "Users can insert own pending transactions"
  ON pending_transactions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own pending transactions" ON pending_transactions;
CREATE POLICY "Users can update own pending transactions"
  ON pending_transactions FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Users can delete own pending transactions" ON pending_transactions;
CREATE POLICY "Users can delete own pending transactions"
  ON pending_transactions FOR DELETE
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pending_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_pending_transactions_updated_at_trigger ON pending_transactions;
CREATE TRIGGER update_pending_transactions_updated_at_trigger
  BEFORE UPDATE ON pending_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_transactions_updated_at();

-- Auto-expire old pending transactions (older than 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_expired_pending_transactions()
RETURNS void AS $$
BEGIN
  UPDATE pending_transactions
  SET status = 'expired', error_message = 'Transaction timed out'
  WHERE status IN ('pending', 'submitted')
    AND created_at < NOW() - INTERVAL '10 minutes';

  -- Delete very old records (older than 24 hours)
  DELETE FROM pending_transactions
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Function to auto-resolve pending transactions when game is created
CREATE OR REPLACE FUNCTION resolve_pending_on_game_create()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new game is created, mark any pending 'create' transactions as confirmed
  UPDATE pending_transactions
  SET status = 'confirmed', updated_at = NOW()
  WHERE user_address = NEW.creator_address
    AND tx_type = 'create'
    AND status IN ('pending', 'submitted')
    AND tier = NEW.tier;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-resolve pending creates
DROP TRIGGER IF EXISTS resolve_pending_create_trigger ON games;
CREATE TRIGGER resolve_pending_create_trigger
  AFTER INSERT ON games
  FOR EACH ROW
  EXECUTE FUNCTION resolve_pending_on_game_create();

-- Function to auto-resolve pending transactions when game status changes
CREATE OR REPLACE FUNCTION resolve_pending_on_game_update()
RETURNS TRIGGER AS $$
BEGIN
  -- When a game is cancelled, mark pending cancel as confirmed
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE pending_transactions
    SET status = 'confirmed', updated_at = NOW()
    WHERE game_id = NEW.id
      AND tx_type = 'cancel'
      AND status IN ('pending', 'submitted');
  END IF;

  -- When a game is matched/resolved, mark pending join as confirmed
  IF NEW.status IN ('matched', 'resolved') AND OLD.status = 'pending' THEN
    UPDATE pending_transactions
    SET status = 'confirmed', updated_at = NOW()
    WHERE game_id = NEW.id
      AND tx_type = 'join'
      AND status IN ('pending', 'submitted');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-resolve pending operations on game updates
DROP TRIGGER IF EXISTS resolve_pending_on_game_update_trigger ON games;
CREATE TRIGGER resolve_pending_on_game_update_trigger
  AFTER UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION resolve_pending_on_game_update();

COMMENT ON TABLE pending_transactions IS 'Tracks in-flight blockchain transactions for cross-device visibility';
