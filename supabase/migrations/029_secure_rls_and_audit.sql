-- Migration 029: Secure RLS Policies and Audit Logging (Phase 2)
--
-- Security improvements:
-- 1. Hide creator_choice from opponents in pending games
-- 2. Create secure view for frontend queries
-- 3. Activate audit logging trigger for game state changes
-- 4. Add RLS to activity_feed and user_preferences

-- ============================================
-- 1. SECURE GAMES VIEW (Hide creator_choice)
-- ============================================

-- The problem: Current RLS allows anyone to see creator_choice in pending games
-- This allows opponents to cheat by seeing the creator's choice before joining
--
-- Solution: Create a secure view that hides creator_choice unless:
-- - The viewer is the creator
-- - The game is no longer pending (matched/resolved/cancelled)
-- - The request is from service_role (indexer)

DROP VIEW IF EXISTS games_public CASCADE;

CREATE OR REPLACE VIEW games_public AS
SELECT
  id,
  tx_hash,
  tier,
  amount,
  creator_address,
  -- Hide creator_choice for pending games unless viewer is the creator
  CASE
    WHEN status != 'pending' THEN creator_choice
    WHEN current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN creator_choice
    WHEN current_setting('request.jwt.claims', true)::json->>'sub' = creator_address THEN creator_choice
    ELSE NULL
  END as creator_choice,
  joiner_address,
  joiner_choice,
  status,
  winner_address,
  random_number,
  payout,
  coin_result,
  block_number,
  matched_tx_hash,
  matched_block_number,
  resolved_tx_hash,
  resolved_block_number,
  cancelled_tx_hash,
  cancelled_block_number,
  created_at,
  matched_at,
  resolved_at,
  cancelled_at,
  updated_at
FROM games;

COMMENT ON VIEW games_public IS 'Secure view that hides creator_choice for pending games from non-creators';

-- Grant access to the view
GRANT SELECT ON games_public TO anon, authenticated;

-- ============================================
-- 2. SECURE ACTIVITY FEED RLS
-- ============================================

-- Enable RLS on activity_feed if not already enabled
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "activity_feed_select_public" ON activity_feed;
DROP POLICY IF EXISTS "activity_feed_insert_service_role" ON activity_feed;
DROP POLICY IF EXISTS "activity_feed_delete_service_role" ON activity_feed;

-- Public can read activity feed (it's public activity)
CREATE POLICY "activity_feed_select_public"
  ON activity_feed FOR SELECT
  USING (true);

-- Only service role can insert (via trigger)
CREATE POLICY "activity_feed_insert_service_role"
  ON activity_feed FOR INSERT
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_user = 'postgres'  -- Allow triggers
  );

-- Only service role can delete (cleanup)
CREATE POLICY "activity_feed_delete_service_role"
  ON activity_feed FOR DELETE
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_user = 'postgres'  -- Allow triggers
  );

-- ============================================
-- 3. SECURE USER PREFERENCES RLS
-- ============================================

-- Enable RLS on user_preferences if not already enabled
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "user_preferences_select_own" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert_own" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences_update_own" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences_all_service_role" ON user_preferences;

-- Users can only read their own preferences
CREATE POLICY "user_preferences_select_own"
  ON user_preferences FOR SELECT
  USING (
    user_address = lower(current_setting('request.jwt.claims', true)::json->>'sub')
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Users can insert their own preferences
CREATE POLICY "user_preferences_insert_own"
  ON user_preferences FOR INSERT
  WITH CHECK (
    user_address = lower(current_setting('request.jwt.claims', true)::json->>'sub')
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Users can update their own preferences
CREATE POLICY "user_preferences_update_own"
  ON user_preferences FOR UPDATE
  USING (
    user_address = lower(current_setting('request.jwt.claims', true)::json->>'sub')
    OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- ============================================
-- 4. ACTIVATE GAME STATE AUDIT LOGGING
-- ============================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS log_game_state_changes_trigger ON games;

-- Create the audit logging function
CREATE OR REPLACE FUNCTION log_game_state_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log state changes (not every update)
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO game_state_audit (
      game_id,
      old_status,
      new_status,
      changed_by,
      session_user_addr,
      details
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      current_user,
      current_setting('request.jwt.claims', true)::json->>'sub',
      jsonb_build_object(
        'old_winner', OLD.winner_address,
        'new_winner', NEW.winner_address,
        'old_joiner', OLD.joiner_address,
        'new_joiner', NEW.joiner_address,
        'old_payout', OLD.payout,
        'new_payout', NEW.payout,
        'trigger_time', NOW()
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER log_game_state_changes_trigger
  AFTER UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION log_game_state_change();

-- Enable RLS on game_state_audit
ALTER TABLE game_state_audit ENABLE ROW LEVEL SECURITY;

-- Only service role can read audit logs
CREATE POLICY "game_state_audit_select_service_role"
  ON game_state_audit FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Only allow inserts from triggers (postgres user)
CREATE POLICY "game_state_audit_insert_trigger"
  ON game_state_audit FOR INSERT
  WITH CHECK (current_user = 'postgres');

-- ============================================
-- 5. SECURE INDEXER STATE RLS
-- ============================================

-- Public can read (already exists), but verify service role for updates
DROP POLICY IF EXISTS "indexer_state_update_service_role" ON indexer_state;

CREATE POLICY "indexer_state_update_service_role"
  ON indexer_state FOR UPDATE
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- ============================================
-- 6. HELPER FUNCTION: Get Current User Address
-- ============================================

-- Function to safely get the current user's wallet address from JWT
CREATE OR REPLACE FUNCTION get_current_user_address()
RETURNS TEXT AS $$
BEGIN
  RETURN lower(current_setting('request.jwt.claims', true)::json->>'sub');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_user_address IS 'Safely extracts the current user wallet address from JWT claims';

-- ============================================
-- 7. CREATE SECURE ACTIVE GAMES VIEW
-- ============================================

-- Replaces the old active_games view with secure version
DROP VIEW IF EXISTS active_games CASCADE;

CREATE OR REPLACE VIEW active_games AS
SELECT
  g.id,
  g.tx_hash,
  g.tier,
  t.amount_usd,
  t.win_amount_usd,
  g.amount,
  g.creator_address,
  -- Hide creator_choice for pending games
  CASE
    WHEN g.status != 'pending' THEN g.creator_choice
    WHEN current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN g.creator_choice
    WHEN current_setting('request.jwt.claims', true)::json->>'sub' = g.creator_address THEN g.creator_choice
    ELSE NULL
  END as creator_choice,
  g.joiner_address,
  g.status,
  g.created_at,
  g.matched_at,
  CASE
    WHEN g.status = 'pending' THEN EXTRACT(EPOCH FROM (NOW() - g.created_at))
    WHEN g.status = 'matched' THEN EXTRACT(EPOCH FROM (NOW() - g.matched_at))
    ELSE 0
  END as time_waiting_seconds
FROM games g
JOIN tiers t ON g.tier = t.id
WHERE g.status IN ('pending', 'matched')
ORDER BY g.created_at DESC;

COMMENT ON VIEW active_games IS 'Secure view of active games that hides creator_choice from opponents';

GRANT SELECT ON active_games TO anon, authenticated;

-- ============================================
-- 8. MONITORING VIEW FOR AUDIT LOGS
-- ============================================

CREATE OR REPLACE VIEW game_state_audit_summary AS
SELECT
  DATE(changed_at) as date,
  old_status,
  new_status,
  COUNT(*) as transition_count
FROM game_state_audit
WHERE changed_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(changed_at), old_status, new_status
ORDER BY date DESC, transition_count DESC;

COMMENT ON VIEW game_state_audit_summary IS 'Summary of game state transitions for monitoring';

-- ============================================
-- 9. RECORD MIGRATION
-- ============================================

INSERT INTO _migrations (version, filename)
VALUES (29, '029_secure_rls_and_audit.sql')
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('games', 'activity_feed', 'user_preferences', 'game_state_audit', 'indexer_state')
  AND schemaname = 'public';

-- Verify policies
SELECT
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('games', 'activity_feed', 'user_preferences', 'game_state_audit')
ORDER BY tablename, policyname;

-- ============================================
-- POST-MIGRATION NOTES
-- ============================================
--
-- IMPORTANT: Frontend should now use these views:
-- - games_public: Instead of querying games table directly
-- - active_games: For showing active games (hides creator_choice)
--
-- The creator_choice is hidden when:
-- 1. Game is pending AND
-- 2. Viewer is NOT the creator AND
-- 3. Viewer is NOT service_role
--
-- Audit logs are now being recorded for all game state changes.
-- To view audit logs (requires service_role):
-- SELECT * FROM game_state_audit ORDER BY changed_at DESC LIMIT 100;
--
-- To see audit summary:
-- SELECT * FROM game_state_audit_summary;
