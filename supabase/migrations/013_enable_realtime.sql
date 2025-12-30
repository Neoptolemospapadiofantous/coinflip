-- Enable realtime for games table
-- This allows WebSocket subscriptions to receive INSERT/UPDATE/DELETE events

-- Add games table to supabase_realtime publication (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE games;
  END IF;
END $$;

-- Also add indexer_state for monitoring (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'indexer_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE indexer_state;
  END IF;
END $$;
