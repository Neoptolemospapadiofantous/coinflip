-- Migration: Seed initial data
-- Description: Inserts the 5 fixed bet tiers
-- Author: CoinFlip Team
-- Date: 2025-01-01

-- ===========================================================================
-- INSERT TIER DATA
-- ===========================================================================
-- 5 fixed tiers with 95% payout (5% platform fee)
-- Amounts are in wei (18 decimals) represented as strings

INSERT INTO tiers (id, amount, amount_usd, win_amount, win_amount_usd, players_in_queue, enabled)
VALUES
  -- Tier 0: $5 bet, $9.50 win
  (
    0,
    '5000000000000000000',     -- 5 ETH/MATIC
    5,
    '9500000000000000000',     -- 9.5 ETH/MATIC (95% of $10 pot)
    9.5,
    0,
    true
  ),

  -- Tier 1: $10 bet, $19 win
  (
    1,
    '10000000000000000000',    -- 10 ETH/MATIC
    10,
    '19000000000000000000',    -- 19 ETH/MATIC (95% of $20 pot)
    19,
    0,
    true
  ),

  -- Tier 2: $25 bet, $47.50 win
  (
    2,
    '25000000000000000000',    -- 25 ETH/MATIC
    25,
    '47500000000000000000',    -- 47.5 ETH/MATIC (95% of $50 pot)
    47.5,
    0,
    true
  ),

  -- Tier 3: $50 bet, $95 win
  (
    3,
    '50000000000000000000',    -- 50 ETH/MATIC
    50,
    '95000000000000000000',    -- 95 ETH/MATIC (95% of $100 pot)
    95,
    0,
    true
  ),

  -- Tier 4: $100 bet, $190 win
  (
    4,
    '100000000000000000000',   -- 100 ETH/MATIC
    100,
    '190000000000000000000',   -- 190 ETH/MATIC (95% of $200 pot)
    190,
    0,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  amount_usd = EXCLUDED.amount_usd,
  win_amount = EXCLUDED.win_amount,
  win_amount_usd = EXCLUDED.win_amount_usd,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();

-- ===========================================================================
-- VERIFY DATA
-- ===========================================================================

DO $$
DECLARE
  tier_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tier_count FROM tiers WHERE enabled = true;

  IF tier_count = 5 THEN
    RAISE NOTICE 'Tier data seeded successfully';
    RAISE NOTICE '   - Tier 0: $5 -> $9.50';
    RAISE NOTICE '   - Tier 1: $10 -> $19.00';
    RAISE NOTICE '   - Tier 2: $25 -> $47.50';
    RAISE NOTICE '   - Tier 3: $50 -> $95.00';
    RAISE NOTICE '   - Tier 4: $100 -> $190.00';
    RAISE NOTICE 'Platform fee: 5%% of total pot';
  ELSE
    RAISE EXCEPTION 'Tier seeding failed. Expected 5 tiers, found %', tier_count;
  END IF;
END $$;
