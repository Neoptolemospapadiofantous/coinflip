-- Migration: Enable Row Level Security (RLS)
-- Description: Enables RLS and creates security policies for all tables
-- Author: CoinFlip Team
-- Date: 2025-01-01

-- ===========================================================================
-- ENABLE ROW LEVEL SECURITY
-- ===========================================================================

ALTER TABLE tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- TIERS TABLE POLICIES
-- ===========================================================================

-- Allow everyone to read tier information
CREATE POLICY "Tiers are publicly readable"
  ON tiers
  FOR SELECT
  USING (true);

-- Only service role can modify tiers
CREATE POLICY "Only service role can modify tiers"
  ON tiers
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ===========================================================================
-- GAMES TABLE POLICIES
-- ===========================================================================

-- Allow everyone to read game information (public ledger)
CREATE POLICY "Games are publicly readable"
  ON games
  FOR SELECT
  USING (true);

-- Only allow event indexer (service role) to insert games
CREATE POLICY "Only service role can insert games"
  ON games
  FOR INSERT
  WITH CHECK (false);

-- Only allow event indexer to update games
CREATE POLICY "Only service role can update games"
  ON games
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- No deletes allowed
CREATE POLICY "No one can delete games"
  ON games
  FOR DELETE
  USING (false);

-- ===========================================================================
-- QUEUE TABLE POLICIES
-- ===========================================================================

-- Allow everyone to read queue (for displaying active players)
CREATE POLICY "Queue is publicly readable"
  ON queue
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert their own queue entries
-- Note: In production, you'd want to verify wallet signatures
CREATE POLICY "Users can join queue"
  ON queue
  FOR INSERT
  WITH CHECK (true);  -- Replace with auth check in production

-- Allow users to update their own queue entries
CREATE POLICY "Users can update their queue entries"
  ON queue
  FOR UPDATE
  USING (player_address = current_setting('app.current_user', true))
  WITH CHECK (player_address = current_setting('app.current_user', true));

-- Allow users to delete their own queue entries
CREATE POLICY "Users can leave queue"
  ON queue
  FOR DELETE
  USING (player_address = current_setting('app.current_user', true));

-- Allow service role full access for matchmaking
CREATE POLICY "Service role has full queue access"
  ON queue
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ===========================================================================
-- ANALYTICS TABLE POLICIES
-- ===========================================================================

-- Allow everyone to read analytics
CREATE POLICY "Analytics are publicly readable"
  ON analytics
  FOR SELECT
  USING (true);

-- Only service role can modify analytics
CREATE POLICY "Only service role can modify analytics"
  ON analytics
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ===========================================================================
-- PLAYER STATS TABLE POLICIES
-- ===========================================================================

-- Allow everyone to read player stats (leaderboards)
CREATE POLICY "Player stats are publicly readable"
  ON player_stats
  FOR SELECT
  USING (true);

-- Only service role can modify stats
CREATE POLICY "Only service role can modify player stats"
  ON player_stats
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ===========================================================================
-- HELPER FUNCTIONS
-- ===========================================================================

-- Function to set current user context (for RLS policies)
-- Call this from your app with the wallet address
CREATE OR REPLACE FUNCTION set_current_user(user_address TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.current_user', user_address, false);
END;
$$;

COMMENT ON FUNCTION set_current_user IS 'Sets current user context for RLS policies';

-- ===========================================================================
-- SUCCESS
-- ===========================================================================

DO $$
BEGIN
  RAISE NOTICE 'Row Level Security enabled successfully';
  RAISE NOTICE '   - RLS enabled on all tables';
  RAISE NOTICE '   - Public read access for all tables';
  RAISE NOTICE '   - Service role can modify all data';
  RAISE NOTICE '   - Users can manage their own queue entries';
  RAISE NOTICE 'SECURITY NOTE:';
  RAISE NOTICE '   In production, implement proper authentication';
  RAISE NOTICE '   and wallet signature verification before allowing';
  RAISE NOTICE '   users to modify queue entries.';
END $$;
