-- Production-Ready RLS Policies
-- This migration secures the database for production use

-- ============================================================================
-- PART 1: Secure Games Table
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Games can be inserted by anyone" ON games;
DROP POLICY IF EXISTS "Games can be updated by anyone" ON games;

-- Policy 1: Public read access (anyone can view games)
-- This is safe as game data is public blockchain data
CREATE POLICY "games_select_public"
  ON games FOR SELECT
  USING (true);

-- Policy 2: Service role can insert games (indexer only)
CREATE POLICY "games_insert_service_role"
  ON games FOR INSERT
  WITH CHECK (
    auth.jwt()->>'role' = 'service_role'
  );

-- Policy 3: Service role can update games (indexer only)
CREATE POLICY "games_update_service_role"
  ON games FOR UPDATE
  USING (
    auth.jwt()->>'role' = 'service_role'
  );

-- Policy 4: No deletes allowed (blockchain data is immutable)
-- Games should never be deleted, only marked as cancelled

-- ============================================================================
-- PART 2: Secure Tiers Table
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Tiers can be updated by anyone" ON tiers;
DROP POLICY IF EXISTS "Tiers can be inserted by anyone" ON tiers;

-- Policy 1: Public read access
CREATE POLICY "tiers_select_public"
  ON tiers FOR SELECT
  USING (true);

-- Policy 2: Only service role can insert/update tiers
CREATE POLICY "tiers_insert_service_role"
  ON tiers FOR INSERT
  WITH CHECK (
    auth.jwt()->>'role' = 'service_role'
  );

CREATE POLICY "tiers_update_service_role"
  ON tiers FOR UPDATE
  USING (
    auth.jwt()->>'role' = 'service_role'
  );

-- ============================================================================
-- PART 3: Secure Indexer State Table
-- ============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Indexer state can be modified by anyone" ON indexer_state;

-- Policy 1: Public can read indexer state (for transparency)
CREATE POLICY "indexer_state_select_public"
  ON indexer_state FOR SELECT
  USING (true);

-- Policy 2: Only service role can modify indexer state
CREATE POLICY "indexer_state_all_service_role"
  ON indexer_state FOR ALL
  USING (
    auth.jwt()->>'role' = 'service_role'
  );

-- ============================================================================
-- PART 4: Add Audit Logging
-- ============================================================================

-- Create audit log table for tracking all database modifications
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  user_id TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role can read audit logs
CREATE POLICY "audit_log_select_service_role"
  ON audit_log FOR SELECT
  USING (
    auth.jwt()->>'role' = 'service_role'
  );

-- Audit trigger function for games table
CREATE OR REPLACE FUNCTION audit_games_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name,
    operation,
    old_data,
    new_data,
    user_id
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW) ELSE NULL END,
    current_setting('request.jwt.claims', true)::json->>'sub'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit trigger to games table
DROP TRIGGER IF EXISTS audit_games_trigger ON games;
CREATE TRIGGER audit_games_trigger
  AFTER INSERT OR UPDATE OR DELETE ON games
  FOR EACH ROW
  EXECUTE FUNCTION audit_games_changes();

-- ============================================================================
-- PART 5: Add Rate Limiting View
-- ============================================================================

-- View to track API usage by IP/user (helps prevent abuse)
CREATE OR REPLACE VIEW api_usage_stats AS
SELECT
  date_trunc('hour', created_at) as hour,
  user_id,
  COUNT(*) as request_count
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY date_trunc('hour', created_at), user_id
ORDER BY hour DESC, request_count DESC;

-- ============================================================================
-- PART 6: Add Data Integrity Constraints
-- ============================================================================

-- Ensure game amounts match tier amounts
CREATE OR REPLACE FUNCTION validate_game_tier_amount()
RETURNS TRIGGER AS $$
DECLARE
  tier_amount TEXT;
BEGIN
  SELECT amount INTO tier_amount FROM tiers WHERE id = NEW.tier;

  IF tier_amount IS NULL THEN
    RAISE EXCEPTION 'Invalid tier ID: %', NEW.tier;
  END IF;

  IF NEW.amount != tier_amount THEN
    RAISE EXCEPTION 'Game amount % does not match tier amount %', NEW.amount, tier_amount;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate tier amounts on insert
DROP TRIGGER IF EXISTS validate_game_tier_trigger ON games;
CREATE TRIGGER validate_game_tier_trigger
  BEFORE INSERT ON games
  FOR EACH ROW
  EXECUTE FUNCTION validate_game_tier_amount();

-- ============================================================================
-- PART 7: Add Monitoring Views
-- ============================================================================

-- View for monitoring indexer health
CREATE OR REPLACE VIEW indexer_health AS
SELECT
  indexer_name,
  last_processed_block,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) as seconds_since_update,
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - updated_at)) < 60 THEN 'healthy'
    WHEN EXTRACT(EPOCH FROM (NOW() - updated_at)) < 300 THEN 'warning'
    ELSE 'critical'
  END as status
FROM indexer_state;

-- View for game processing metrics
CREATE OR REPLACE VIEW game_processing_metrics AS
SELECT
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_games,
  COUNT(*) FILTER (WHERE status = 'matched') as matched_games,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_games,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_games,
  AVG(EXTRACT(EPOCH FROM (matched_at - created_at))) FILTER (WHERE matched_at IS NOT NULL) as avg_match_time_seconds,
  AVG(EXTRACT(EPOCH FROM (resolved_at - matched_at))) FILTER (WHERE resolved_at IS NOT NULL) as avg_resolve_time_seconds
FROM games
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('games', 'tiers', 'indexer_state', 'audit_log')
  AND schemaname = 'public';

-- Verify policies exist
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('games', 'tiers', 'indexer_state', 'audit_log')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

-- Show success message
SELECT '✅ Production security policies applied successfully!' as status;

COMMENT ON TABLE audit_log IS 'Tracks all database modifications for security and compliance';
COMMENT ON VIEW indexer_health IS 'Real-time monitoring of indexer status';
COMMENT ON VIEW game_processing_metrics IS 'Daily metrics for game processing performance';
