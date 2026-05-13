-- Test wallets table — stores generated testnet wallets and their on-chain state
-- Private keys stored here are TESTNET ONLY. Never store mainnet keys in a database.

CREATE TABLE IF NOT EXISTS test_wallets (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  role         text        NOT NULL UNIQUE,
  description  text        NOT NULL,
  address      text        NOT NULL,
  private_key  text        NOT NULL,
  needs_eth    text,
  needs_link   text,
  eth_balance  text        DEFAULT '0',
  link_balance text        DEFAULT '0',
  funded       boolean     DEFAULT false,
  network      text        DEFAULT 'sepolia',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Only the service role can read/write — never exposed to client
ALTER TABLE test_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON test_wallets
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_test_wallets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER test_wallets_updated_at
  BEFORE UPDATE ON test_wallets
  FOR EACH ROW EXECUTE FUNCTION update_test_wallets_updated_at();

COMMENT ON TABLE test_wallets IS 'Testnet-only wallet registry. Never use for mainnet keys.';
