-- Add coin_result column to games table
-- This stores the actual coin flip result (true = tails, false = heads)

ALTER TABLE games
ADD COLUMN IF NOT EXISTS coin_result boolean;

-- Add comment
COMMENT ON COLUMN games.coin_result IS 'The actual coin flip result (true = tails, false = heads)';
