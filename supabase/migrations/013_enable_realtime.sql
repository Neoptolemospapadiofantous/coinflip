-- Enable realtime for games table
-- This allows WebSocket subscriptions to receive INSERT/UPDATE/DELETE events

-- Add games table to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE games;

-- Also add indexer_state for monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE indexer_state;
