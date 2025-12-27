-- Migration: Fix Tier Constraint
-- The contract supports tiers 0-9 (MAX_TIERS = 10), but DB constraint was 0-4

-- Drop the old constraint
ALTER TABLE games DROP CONSTRAINT IF EXISTS valid_tier;

-- Add the correct constraint (0-9)
ALTER TABLE games ADD CONSTRAINT valid_tier CHECK (tier >= 0 AND tier <= 9);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT valid_tier ON games IS 'Tier must be 0-9 (contract MAX_TIERS = 10)';
