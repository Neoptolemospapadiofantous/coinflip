-- Migration 028: Database Integrity Enforcement (Phase 1)
-- Implements critical data integrity rules for the games table:
-- 1. State machine enforcement (valid status transitions only)
-- 2. Field constraints by game status
-- 3. Ethereum address format validation
-- 4. Payout validation against fee configuration

-- ============================================
-- 1. ETHEREUM ADDRESS VALIDATION FUNCTION
-- ============================================

-- Function to validate Ethereum addresses (0x + 40 hex chars)
CREATE OR REPLACE FUNCTION is_valid_eth_address(addr TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- NULL addresses are valid (for optional fields)
  IF addr IS NULL THEN
    RETURN TRUE;
  END IF;
  -- Must be 0x followed by exactly 40 hex characters (lowercase)
  RETURN addr ~* '^0x[a-f0-9]{40}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION is_valid_eth_address IS 'Validates that a string is a valid Ethereum address format (0x + 40 hex chars)';

-- ============================================
-- 2. STATE MACHINE ENFORCEMENT TRIGGER
-- ============================================

-- This trigger enforces valid state transitions only:
-- pending → matched (game joined)
-- pending → cancelled (creator cancelled)
-- matched → resolved (VRF callback received)
--
-- All other transitions are BLOCKED

CREATE OR REPLACE FUNCTION enforce_game_state_machine()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions TEXT[][] := ARRAY[
    ARRAY['pending', 'matched'],
    ARRAY['pending', 'cancelled'],
    ARRAY['matched', 'resolved']
  ];
  transition_valid BOOLEAN := FALSE;
  i INTEGER;
BEGIN
  -- Same status is always valid (allows field updates without status change)
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Check if transition is in the valid list
  FOR i IN 1..array_length(valid_transitions, 1) LOOP
    IF OLD.status = valid_transitions[i][1] AND NEW.status = valid_transitions[i][2] THEN
      transition_valid := TRUE;
      EXIT;
    END IF;
  END LOOP;

  IF NOT transition_valid THEN
    RAISE EXCEPTION 'Invalid game state transition: "%" → "%". Valid transitions: pending→matched, pending→cancelled, matched→resolved',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_game_state_machine IS 'Enforces valid game state transitions to prevent data corruption';

-- Create the trigger (drop first if exists to allow re-running)
DROP TRIGGER IF EXISTS enforce_game_state_machine_trigger ON games;

CREATE TRIGGER enforce_game_state_machine_trigger
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION enforce_game_state_machine();

-- ============================================
-- 3. FIELD CONSTRAINTS BY STATUS
-- ============================================

-- These constraints ensure that fields are properly set based on game status:
-- - pending: must have creator info, must NOT have joiner/winner
-- - matched: must have both creator AND joiner, must NOT have winner yet
-- - resolved: must have all players AND winner AND result

-- Drop existing constraints if they exist (for idempotent migration)
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_pending_fields_check;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_matched_fields_check;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_resolved_fields_check;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_winner_is_player_check;

-- Pending games: creator fields required, no joiner/winner yet
ALTER TABLE games ADD CONSTRAINT games_pending_fields_check CHECK (
  status != 'pending' OR (
    creator_address IS NOT NULL AND
    creator_choice IS NOT NULL AND
    joiner_address IS NULL AND
    winner_address IS NULL AND
    coin_result IS NULL AND
    payout IS NULL
  )
);

-- Matched games: both players required, no winner yet
ALTER TABLE games ADD CONSTRAINT games_matched_fields_check CHECK (
  status != 'matched' OR (
    creator_address IS NOT NULL AND
    joiner_address IS NOT NULL AND
    creator_address != joiner_address AND
    winner_address IS NULL AND
    coin_result IS NULL AND
    payout IS NULL
  )
);

-- Resolved games: all result fields required
ALTER TABLE games ADD CONSTRAINT games_resolved_fields_check CHECK (
  status != 'resolved' OR (
    creator_address IS NOT NULL AND
    joiner_address IS NOT NULL AND
    winner_address IS NOT NULL AND
    coin_result IS NOT NULL AND
    payout IS NOT NULL
  )
);

-- Winner must be either creator or joiner
ALTER TABLE games ADD CONSTRAINT games_winner_is_player_check CHECK (
  winner_address IS NULL OR
  winner_address = creator_address OR
  winner_address = joiner_address
);

-- ============================================
-- 4. ADDRESS FORMAT VALIDATION
-- ============================================

-- Drop existing constraints if they exist
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_creator_address_format;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_joiner_address_format;
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_winner_address_format;

-- Validate all address fields
ALTER TABLE games ADD CONSTRAINT games_creator_address_format
  CHECK (is_valid_eth_address(creator_address));

ALTER TABLE games ADD CONSTRAINT games_joiner_address_format
  CHECK (is_valid_eth_address(joiner_address));

ALTER TABLE games ADD CONSTRAINT games_winner_address_format
  CHECK (is_valid_eth_address(winner_address));

-- ============================================
-- 5. PAYOUT VALIDATION FUNCTION
-- ============================================

-- This function validates that payout is calculated correctly
-- Payout should be: (amount * 2) - fee
-- Where fee = (amount * 2) * (fee_basis_points / 10000)

CREATE OR REPLACE FUNCTION validate_game_payout(
  game_amount TEXT,
  game_payout TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  amount_num NUMERIC;
  payout_num NUMERIC;
  fee_bps INTEGER;
  expected_payout NUMERIC;
  tolerance NUMERIC := 1; -- Allow 1 wei tolerance for rounding
BEGIN
  -- Get current fee from contract_config
  SELECT fee_basis_points INTO fee_bps
  FROM contract_config
  WHERE id = 'current';

  -- Default to 500 (5%) if not configured
  IF fee_bps IS NULL THEN
    fee_bps := 500;
  END IF;

  -- Convert amounts
  amount_num := game_amount::NUMERIC;
  payout_num := game_payout::NUMERIC;

  -- Calculate expected payout: (amount * 2) * (1 - fee_bps/10000)
  expected_payout := (amount_num * 2) * (1 - fee_bps::NUMERIC / 10000);

  -- Allow small tolerance for rounding differences
  RETURN ABS(payout_num - expected_payout) <= tolerance;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION validate_game_payout IS 'Validates that game payout matches expected calculation based on fee configuration';

-- Note: We create the validation function but don't add it as a CHECK constraint
-- because it depends on external table (contract_config). Instead, we can use it
-- in the indexer or application layer for validation.

-- ============================================
-- 6. AUDIT LOGGING TABLE (for Phase 2)
-- ============================================

-- Create audit table structure now (trigger will be added in Phase 2)
CREATE TABLE IF NOT EXISTS game_state_audit (
  id BIGSERIAL PRIMARY KEY,
  game_id BIGINT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  changed_by TEXT DEFAULT current_user,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  session_user_addr TEXT,  -- For tracking which wallet triggered the change
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_game_state_audit_game_id ON game_state_audit(game_id);
CREATE INDEX IF NOT EXISTS idx_game_state_audit_changed_at ON game_state_audit(changed_at DESC);

COMMENT ON TABLE game_state_audit IS 'Audit log for game state transitions (Phase 2)';

-- ============================================
-- 7. HELPER VIEW FOR MONITORING INTEGRITY
-- ============================================

CREATE OR REPLACE VIEW game_integrity_status AS
SELECT
  id,
  status,
  CASE
    -- Check pending constraints
    WHEN status = 'pending' AND (
      creator_address IS NULL OR
      creator_choice IS NULL OR
      joiner_address IS NOT NULL OR
      winner_address IS NOT NULL
    ) THEN 'INVALID_PENDING_FIELDS'

    -- Check matched constraints
    WHEN status = 'matched' AND (
      creator_address IS NULL OR
      joiner_address IS NULL OR
      creator_address = joiner_address OR
      winner_address IS NOT NULL
    ) THEN 'INVALID_MATCHED_FIELDS'

    -- Check resolved constraints
    WHEN status = 'resolved' AND (
      creator_address IS NULL OR
      joiner_address IS NULL OR
      winner_address IS NULL OR
      coin_result IS NULL OR
      payout IS NULL
    ) THEN 'INVALID_RESOLVED_FIELDS'

    -- Check winner is a player
    WHEN winner_address IS NOT NULL AND
         winner_address != creator_address AND
         winner_address != joiner_address
    THEN 'WINNER_NOT_A_PLAYER'

    -- Check address formats
    WHEN NOT is_valid_eth_address(creator_address) THEN 'INVALID_CREATOR_ADDRESS'
    WHEN NOT is_valid_eth_address(joiner_address) THEN 'INVALID_JOINER_ADDRESS'
    WHEN NOT is_valid_eth_address(winner_address) THEN 'INVALID_WINNER_ADDRESS'

    ELSE 'VALID'
  END as integrity_status,
  creator_address,
  joiner_address,
  winner_address,
  created_at
FROM games;

COMMENT ON VIEW game_integrity_status IS 'Monitoring view to check data integrity across all games';

-- Query to find any integrity violations:
-- SELECT * FROM game_integrity_status WHERE integrity_status != 'VALID';

-- ============================================
-- 8. RECORD MIGRATION
-- ============================================
INSERT INTO _migrations (version, filename)
VALUES (28, '028_database_integrity_enforcement.sql')
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- POST-MIGRATION NOTES
-- ============================================
--
-- After running this migration, the following is now enforced:
--
-- 1. State Machine: Only valid transitions are allowed:
--    - pending → matched (when joiner joins)
--    - pending → cancelled (when creator cancels)
--    - matched → resolved (when VRF resolves)
--    Any other transition will raise an exception.
--
-- 2. Field Constraints:
--    - pending games MUST have creator info, MUST NOT have joiner/winner
--    - matched games MUST have both players, MUST NOT have winner yet
--    - resolved games MUST have all result fields filled
--    - winner MUST be either creator or joiner
--
-- 3. Address Validation:
--    - All addresses must match Ethereum format (0x + 40 hex chars)
--
-- 4. Payout Validation:
--    - Function available for use, not enforced as constraint
--    - Use: SELECT validate_game_payout(amount, payout) FROM games
--
-- To check for existing integrity issues:
-- SELECT * FROM game_integrity_status WHERE integrity_status != 'VALID';
