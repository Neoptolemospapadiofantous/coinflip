-- Migration 031: Fix RLS Security Vulnerabilities
-- Description: Fixes overly permissive RLS policies that allowed any user to access any data
--
-- CRITICAL SECURITY FIX:
-- - user_game_notifications: Was USING (true), now checks wallet address
-- - pending_transactions: Was USING (true), now checks wallet address
-- - user_preferences: Ensures proper address-based access
-- - activity_feed: Restricts INSERT to service_role only
--
-- Authentication Strategy:
-- This migration supports two authentication methods:
-- 1. Header-based: Frontend passes x-wallet-address header (current)
-- 2. JWT-based: After JWT integration, uses auth.jwt()->>'wallet_address'
--
-- The get_caller_address() function abstracts this, allowing easy migration.

-- ============================================
-- 1. HELPER FUNCTION: Get authenticated wallet address
-- ============================================

-- This function returns the caller's wallet address from various sources
-- Priority: 1. JWT wallet_address claim, 2. JWT sub claim, 3. x-wallet-address header
CREATE OR REPLACE FUNCTION get_caller_address()
RETURNS TEXT AS $$
DECLARE
  jwt_wallet TEXT;
  jwt_sub TEXT;
  header_wallet TEXT;
BEGIN
  -- Try JWT wallet_address claim first (after JWT integration)
  BEGIN
    jwt_wallet := auth.jwt()->>'wallet_address';
  EXCEPTION WHEN OTHERS THEN
    jwt_wallet := NULL;
  END;

  IF jwt_wallet IS NOT NULL AND jwt_wallet != '' THEN
    RETURN lower(jwt_wallet);
  END IF;

  -- Try JWT sub claim (standard JWT subject)
  BEGIN
    jwt_sub := auth.jwt()->>'sub';
  EXCEPTION WHEN OTHERS THEN
    jwt_sub := NULL;
  END;

  IF jwt_sub IS NOT NULL AND jwt_sub != '' AND jwt_sub ~ '^0x[a-fA-F0-9]{40}$' THEN
    RETURN lower(jwt_sub);
  END IF;

  -- Fall back to x-wallet-address header
  BEGIN
    header_wallet := current_setting('request.headers', true)::json->>'x-wallet-address';
  EXCEPTION WHEN OTHERS THEN
    header_wallet := NULL;
  END;

  IF header_wallet IS NOT NULL AND header_wallet ~ '^0x[a-fA-F0-9]{40}$' THEN
    RETURN lower(header_wallet);
  END IF;

  -- No valid wallet address found
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper to check if caller is service role
CREATE OR REPLACE FUNCTION is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.role() = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_caller_address() IS 'Returns the authenticated wallet address from JWT or header';
COMMENT ON FUNCTION is_service_role() IS 'Returns true if caller is using service_role';

-- ============================================
-- 2. FIX: user_game_notifications RLS
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own notifications" ON user_game_notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON user_game_notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON user_game_notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON user_game_notifications;
DROP POLICY IF EXISTS "user_game_notifications_select" ON user_game_notifications;
DROP POLICY IF EXISTS "user_game_notifications_insert" ON user_game_notifications;
DROP POLICY IF EXISTS "user_game_notifications_update" ON user_game_notifications;

-- SELECT: Users can only view their own notifications
CREATE POLICY "user_game_notifications_select"
  ON user_game_notifications FOR SELECT
  USING (
    is_service_role()
    OR lower(user_address) = get_caller_address()
  );

-- INSERT: Users can only insert notifications for themselves
CREATE POLICY "user_game_notifications_insert"
  ON user_game_notifications FOR INSERT
  WITH CHECK (
    is_service_role()
    OR lower(user_address) = get_caller_address()
  );

-- UPDATE: Users can only update their own notifications
CREATE POLICY "user_game_notifications_update"
  ON user_game_notifications FOR UPDATE
  USING (
    is_service_role()
    OR lower(user_address) = get_caller_address()
  );

-- No DELETE policy - notifications are cleaned up by scheduled function

-- ============================================
-- 3. FIX: pending_transactions RLS
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own pending transactions" ON pending_transactions;
DROP POLICY IF EXISTS "Users can insert own pending transactions" ON pending_transactions;
DROP POLICY IF EXISTS "Users can update own pending transactions" ON pending_transactions;
DROP POLICY IF EXISTS "Users can delete own pending transactions" ON pending_transactions;
DROP POLICY IF EXISTS "pending_transactions_select" ON pending_transactions;
DROP POLICY IF EXISTS "pending_transactions_insert" ON pending_transactions;
DROP POLICY IF EXISTS "pending_transactions_update" ON pending_transactions;
DROP POLICY IF EXISTS "pending_transactions_delete" ON pending_transactions;

-- SELECT: Users can only view their own pending transactions
CREATE POLICY "pending_transactions_select"
  ON pending_transactions FOR SELECT
  USING (
    is_service_role()
    OR lower(user_address) = get_caller_address()
  );

-- INSERT: Users can only create pending transactions for themselves
CREATE POLICY "pending_transactions_insert"
  ON pending_transactions FOR INSERT
  WITH CHECK (
    is_service_role()
    OR lower(user_address) = get_caller_address()
  );

-- UPDATE: Users can only update their own pending transactions
CREATE POLICY "pending_transactions_update"
  ON pending_transactions FOR UPDATE
  USING (
    is_service_role()
    OR lower(user_address) = get_caller_address()
  );

-- DELETE: Users can only delete their own pending transactions
CREATE POLICY "pending_transactions_delete"
  ON pending_transactions FOR DELETE
  USING (
    is_service_role()
    OR lower(user_address) = get_caller_address()
  );

-- ============================================
-- 4. FIX: user_preferences RLS
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can upsert own preferences" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences_select" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences_update" ON user_preferences;

-- SELECT: Users can only view their own preferences
CREATE POLICY "user_preferences_select"
  ON user_preferences FOR SELECT
  USING (
    is_service_role()
    OR lower(user_address) = get_caller_address()
  );

-- INSERT: Users can only create preferences for themselves
CREATE POLICY "user_preferences_insert"
  ON user_preferences FOR INSERT
  WITH CHECK (
    is_service_role()
    OR lower(user_address) = get_caller_address()
  );

-- UPDATE: Users can only update their own preferences
CREATE POLICY "user_preferences_update"
  ON user_preferences FOR UPDATE
  USING (
    is_service_role()
    OR lower(user_address) = get_caller_address()
  );

-- ============================================
-- 5. FIX: activity_feed RLS
-- ============================================

-- Activity feed is public for reading (it's a social feed)
-- But INSERT should be restricted to service_role (populated by triggers)

DROP POLICY IF EXISTS "Activity feed is public" ON activity_feed;
DROP POLICY IF EXISTS "Activity feed insert by service" ON activity_feed;
DROP POLICY IF EXISTS "activity_feed_select" ON activity_feed;
DROP POLICY IF EXISTS "activity_feed_insert" ON activity_feed;

-- SELECT: Everyone can read the activity feed (it's public game data)
CREATE POLICY "activity_feed_select"
  ON activity_feed FOR SELECT
  USING (true);

-- INSERT: Only service role can insert (via triggers)
CREATE POLICY "activity_feed_insert"
  ON activity_feed FOR INSERT
  WITH CHECK (is_service_role());

-- No UPDATE/DELETE - activity feed is append-only

-- ============================================
-- 6. RESTRICT: Direct games table access
-- ============================================

-- The games table contains creator_choice which must be hidden for pending games
-- We keep the existing public SELECT policy but add a note that frontend
-- should use games_public view instead

-- Note: We don't modify games policies here as they're needed for backward compatibility
-- Frontend code should be updated to use games_public view (from migration 029)

-- ============================================
-- 7. GRANT: Ensure functions are accessible
-- ============================================

GRANT EXECUTE ON FUNCTION get_caller_address() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_service_role() TO anon, authenticated;

-- ============================================
-- 8. VERIFY: Check RLS is enabled on all tables
-- ============================================

-- Ensure RLS is enabled (should already be, but double-check)
ALTER TABLE user_game_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. RECORD MIGRATION
-- ============================================

INSERT INTO _migrations (version, filename)
VALUES (31, '031_fix_rls_security.sql')
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES (run manually to verify)
-- ============================================

-- Check all policies:
-- SELECT tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Test get_caller_address():
-- SET request.headers = '{"x-wallet-address": "0x1234567890123456789012345678901234567890"}';
-- SELECT get_caller_address();

COMMENT ON FUNCTION get_caller_address IS
'Returns the authenticated wallet address. Checks (in order):
1. JWT wallet_address claim (for custom JWT integration)
2. JWT sub claim (if it looks like an ETH address)
3. x-wallet-address header (for header-based auth)
Returns NULL if no valid address found.';
