-- Migration: Security Hardening
-- Fixes: RLS on tiers/contract_config, JWT role checks, FK constraints, audit logging

-- =============================================================
-- 1. ENABLE RLS ON TIERS TABLE
-- =============================================================

ALTER TABLE tiers ENABLE ROW LEVEL SECURITY;

-- Allow public read access to tiers
CREATE POLICY "tiers_select_public" ON tiers
  FOR SELECT USING (true);

-- Only service_role can modify tiers (using proper auth.role() function)
CREATE POLICY "tiers_insert_service_role" ON tiers
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "tiers_update_service_role" ON tiers
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "tiers_delete_service_role" ON tiers
  FOR DELETE USING (auth.role() = 'service_role');

-- =============================================================
-- 2. ENABLE RLS ON CONTRACT_CONFIG TABLE
-- =============================================================

ALTER TABLE contract_config ENABLE ROW LEVEL SECURITY;

-- Allow public read access to contract config
CREATE POLICY "contract_config_select_public" ON contract_config
  FOR SELECT USING (true);

-- Only service_role can modify contract config
CREATE POLICY "contract_config_insert_service_role" ON contract_config
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "contract_config_update_service_role" ON contract_config
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "contract_config_delete_service_role" ON contract_config
  FOR DELETE USING (auth.role() = 'service_role');

-- =============================================================
-- 3. FIX JWT ROLE CHECKS ON GAMES TABLE (use auth.role())
-- =============================================================

-- Drop old policies that use JWT claims
DROP POLICY IF EXISTS "games_insert_service_role" ON games;
DROP POLICY IF EXISTS "games_update_service_role" ON games;

-- Create new policies using proper auth.role() function
CREATE POLICY "games_insert_service_role" ON games
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "games_update_service_role" ON games
  FOR UPDATE USING (auth.role() = 'service_role');

-- =============================================================
-- 4. FIX INDEXER_STATE RLS POLICIES
-- =============================================================

DROP POLICY IF EXISTS "indexer_state_all_service_role" ON indexer_state;

CREATE POLICY "indexer_state_select_public" ON indexer_state
  FOR SELECT USING (true);

CREATE POLICY "indexer_state_insert_service_role" ON indexer_state
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "indexer_state_update_service_role" ON indexer_state
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "indexer_state_delete_service_role" ON indexer_state
  FOR DELETE USING (auth.role() = 'service_role');

-- =============================================================
-- 5. FIX AUDIT_LOG RLS POLICIES
-- =============================================================

DROP POLICY IF EXISTS "audit_log_select_service_role" ON audit_log;

-- Audit logs should be readable by service role only
CREATE POLICY "audit_log_select_service_role" ON audit_log
  FOR SELECT USING (auth.role() = 'service_role');

-- Only service role can insert audit logs
CREATE POLICY "audit_log_insert_service_role" ON audit_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Audit logs should never be updated or deleted (immutable)
-- No UPDATE or DELETE policies = deny by default

-- =============================================================
-- 6. ADD AUDIT TRIGGERS TO TIERS AND CONTRACT_CONFIG
-- =============================================================

-- Reuse existing audit function for tiers
CREATE TRIGGER audit_tiers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tiers
  FOR EACH ROW EXECUTE FUNCTION audit_games_changes();

-- Reuse existing audit function for contract_config
CREATE TRIGGER audit_contract_config_trigger
  AFTER INSERT OR UPDATE OR DELETE ON contract_config
  FOR EACH ROW EXECUTE FUNCTION audit_games_changes();

-- =============================================================
-- 7. ADD FOREIGN KEY CONSTRAINT (games -> tiers)
-- =============================================================

-- Add FK constraint with ON DELETE RESTRICT to prevent orphaned games
-- Note: This may fail if there are existing games with invalid tier IDs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_games_tier' AND table_name = 'games'
  ) THEN
    ALTER TABLE games
      ADD CONSTRAINT fk_games_tier
      FOREIGN KEY (tier) REFERENCES tiers(id)
      ON DELETE RESTRICT ON UPDATE RESTRICT;
  END IF;
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'FK constraint failed - orphaned games exist with invalid tier IDs';
END $$;

-- =============================================================
-- 8. ADD INDEXES FOR SECURITY-CRITICAL QUERIES
-- =============================================================

-- Index on winner_address for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_games_winner_address ON games(winner_address)
  WHERE winner_address IS NOT NULL;

-- Composite index for player game lookups
CREATE INDEX IF NOT EXISTS idx_games_creator_status_created
  ON games(creator_address, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_games_joiner_status_created
  ON games(joiner_address, status, created_at DESC)
  WHERE joiner_address IS NOT NULL;

-- =============================================================
-- 9. REVOKE PUBLIC ACCESS TO SENSITIVE VIEWS
-- =============================================================

-- api_usage_stats should not be publicly accessible
REVOKE SELECT ON api_usage_stats FROM anon;

-- Grant comments
COMMENT ON POLICY "tiers_select_public" ON tiers IS 'Allow public read access to tier information';
COMMENT ON POLICY "games_insert_service_role" ON games IS 'Only indexer service can insert games';
COMMENT ON POLICY "audit_log_insert_service_role" ON audit_log IS 'Audit logs are append-only via service role';
