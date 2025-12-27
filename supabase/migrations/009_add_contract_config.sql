-- Contract configuration synced from blockchain
-- This table stores contract metadata for easy querying

CREATE TABLE IF NOT EXISTS contract_config (
  id TEXT PRIMARY KEY DEFAULT 'current',
  contract_address TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'sepolia',

  -- Fee configuration
  fee_basis_points INTEGER NOT NULL DEFAULT 500,  -- 500 = 5%
  fee_percentage NUMERIC GENERATED ALWAYS AS (fee_basis_points / 100.0) STORED,

  -- Timeout configuration
  timeout_blocks INTEGER NOT NULL DEFAULT 100,
  vrf_timeout_blocks INTEGER NOT NULL DEFAULT 1000,

  -- Tier configuration (amounts in wei)
  tier_amounts JSONB NOT NULL DEFAULT '[]',
  active_tier_count INTEGER NOT NULL DEFAULT 0,

  -- VRF configuration
  vrf_subscription_id TEXT,
  vrf_key_hash TEXT,

  -- Metadata
  contract_version INTEGER NOT NULL DEFAULT 1,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_block TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE contract_config IS 'Contract configuration synced from blockchain';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_contract_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contract_config_updated_at
  BEFORE UPDATE ON contract_config
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_config_updated_at();
