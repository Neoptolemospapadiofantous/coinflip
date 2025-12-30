-- Enable realtime for pending_transactions table

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'pending_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pending_transactions;
  END IF;
END $$;

-- Also add user_preferences for realtime sync across devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_preferences'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_preferences;
  END IF;
END $$;
