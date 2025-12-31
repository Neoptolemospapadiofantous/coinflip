-- Migration 024: Scheduled Cleanup
-- Sets up periodic cleanup of old data to prevent table bloat

-- ============================================================================
-- COMPREHENSIVE CLEANUP FUNCTION
-- Combines all cleanup operations into a single function
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
DECLARE
  deleted_notifications INT;
  expired_transactions INT;
  deleted_transactions INT;
BEGIN
  -- 1. Delete notifications for games older than 7 days
  DELETE FROM user_game_notifications
  WHERE game_id IN (
    SELECT id FROM games
    WHERE created_at < NOW() - INTERVAL '7 days'
  );
  GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

  -- 2. Expire pending transactions older than 10 minutes
  UPDATE pending_transactions
  SET status = 'expired', error_message = 'Transaction timed out'
  WHERE status IN ('pending', 'submitted')
    AND created_at < NOW() - INTERVAL '10 minutes';
  GET DIAGNOSTICS expired_transactions = ROW_COUNT;

  -- 3. Delete transactions older than 24 hours
  DELETE FROM pending_transactions
  WHERE created_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted_transactions = ROW_COUNT;

  -- Log cleanup results (visible in Supabase logs)
  RAISE NOTICE 'Cleanup complete: % notifications deleted, % transactions expired, % transactions deleted',
    deleted_notifications, expired_transactions, deleted_transactions;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEX FOR EXPIRED GAME DETECTION
-- Helps find pending games that are past the 5-minute auto-cancel threshold
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_games_pending_created_at
ON games(created_at)
WHERE status = 'pending';

-- ============================================================================
-- NOTE ON SCHEDULING
-- ============================================================================
-- Supabase supports pg_cron for scheduled tasks, but it requires the
-- pg_cron extension which may need to be enabled in the dashboard.
--
-- To schedule cleanup to run every hour:
--
-- 1. Enable pg_cron in Supabase Dashboard > Database > Extensions
-- 2. Run this SQL:
--    SELECT cron.schedule('cleanup-old-data', '0 * * * *', 'SELECT cleanup_old_data()');
--
-- Alternatively, use Supabase Edge Functions or an external cron service
-- to call the cleanup function periodically via RPC.
-- ============================================================================

COMMENT ON FUNCTION cleanup_old_data() IS
  'Cleans up old notifications (>7 days), expired pending transactions, and old transaction records (>24h)';

-- ============================================================================
-- RECORD MIGRATION
-- ============================================================================

INSERT INTO _migrations (version, filename)
VALUES (24, '024_scheduled_cleanup.sql')
ON CONFLICT (version) DO NOTHING;
