-- Email Notification Triggers
-- Sends emails via Edge Function when games are matched or resolved

-- Enable the pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to send game email notification
CREATE OR REPLACE FUNCTION notify_game_email()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  payload JSONB;
  player1_address TEXT;
  player2_address TEXT;
BEGIN
  -- Get the Edge Function URL from environment or use default
  edge_function_url := current_setting('app.edge_function_url', true);
  IF edge_function_url IS NULL THEN
    edge_function_url := current_setting('supabase.url', true) || '/functions/v1/send-game-email';
  END IF;

  -- Handle game matched (status changed from 'pending' to 'matched')
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'matched' THEN
    player1_address := NEW.creator_address;
    player2_address := NEW.joiner_address;

    -- Notify creator (player 1)
    payload := jsonb_build_object(
      'type', 'matched',
      'game_id', NEW.id,
      'player_address', player1_address,
      'opponent_address', player2_address,
      'amount', NEW.amount::TEXT
    );

    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := payload
    );

    -- Notify joiner (player 2)
    payload := jsonb_build_object(
      'type', 'matched',
      'game_id', NEW.id,
      'player_address', player2_address,
      'opponent_address', player1_address,
      'amount', NEW.amount::TEXT
    );

    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := payload
    );
  END IF;

  -- Handle game resolved (status changed to 'resolved')
  IF TG_OP = 'UPDATE' AND OLD.status != 'resolved' AND NEW.status = 'resolved' THEN
    player1_address := NEW.creator_address;
    player2_address := NEW.joiner_address;

    -- Notify creator (player 1)
    payload := jsonb_build_object(
      'type', 'resolved',
      'game_id', NEW.id,
      'player_address', player1_address,
      'opponent_address', player2_address,
      'amount', NEW.amount::TEXT,
      'winner_address', NEW.winner_address,
      'player_choice', NEW.creator_choice,
      'result', NEW.result
    );

    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := payload
    );

    -- Notify joiner (player 2) if exists
    IF player2_address IS NOT NULL THEN
      payload := jsonb_build_object(
        'type', 'resolved',
        'game_id', NEW.id,
        'player_address', player2_address,
        'opponent_address', player1_address,
        'amount', NEW.amount::TEXT,
        'winner_address', NEW.winner_address,
        'player_choice', NOT NEW.creator_choice, -- Joiner has opposite choice
        'result', NEW.result
      );

      PERFORM net.http_post(
        url := edge_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
        ),
        body := payload
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for game status changes
DROP TRIGGER IF EXISTS trigger_game_email_notification ON games;
CREATE TRIGGER trigger_game_email_notification
  AFTER UPDATE ON games
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_game_email();

COMMENT ON FUNCTION notify_game_email() IS 'Sends email notifications when games are matched or resolved';
