-- Fix tier amounts in Supabase to match Sepolia deployment
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Update tier amounts to match contract (0.001, 0.002, 0.005, 0.010, 0.020 ETH)
UPDATE tiers SET
  amount = '1000000000000000',        -- 0.001 ETH in wei
  amount_usd = 5,
  win_amount = '1900000000000000',    -- 0.0019 ETH in wei (95% of 0.002 ETH pot)
  win_amount_usd = 9.5,
  enabled = true
WHERE id = 0;

UPDATE tiers SET
  amount = '2000000000000000',        -- 0.002 ETH in wei
  amount_usd = 10,
  win_amount = '3800000000000000',    -- 0.0038 ETH in wei (95% of 0.004 ETH pot)
  win_amount_usd = 19,
  enabled = true
WHERE id = 1;

UPDATE tiers SET
  amount = '5000000000000000',        -- 0.005 ETH in wei
  amount_usd = 25,
  win_amount = '9500000000000000',    -- 0.0095 ETH in wei (95% of 0.010 ETH pot)
  win_amount_usd = 47.5,
  enabled = true
WHERE id = 2;

UPDATE tiers SET
  amount = '10000000000000000',       -- 0.010 ETH in wei
  amount_usd = 50,
  win_amount = '19000000000000000',   -- 0.019 ETH in wei (95% of 0.020 ETH pot)
  win_amount_usd = 95,
  enabled = true
WHERE id = 3;

UPDATE tiers SET
  amount = '20000000000000000',       -- 0.020 ETH in wei
  amount_usd = 100,
  win_amount = '38000000000000000',   -- 0.038 ETH in wei (95% of 0.040 ETH pot)
  win_amount_usd = 190,
  enabled = true
WHERE id = 4;

-- Verify the update
SELECT
  id,
  amount,
  CAST(amount AS NUMERIC) / 1000000000000000000 AS amount_eth,
  amount_usd,
  win_amount,
  CAST(win_amount AS NUMERIC) / 1000000000000000000 AS win_amount_eth,
  win_amount_usd,
  enabled
FROM tiers
ORDER BY id;
