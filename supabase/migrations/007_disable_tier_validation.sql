-- Temporarily disable tier validation for historical data import
-- The contract had different tier amounts historically

DROP TRIGGER IF EXISTS validate_game_tier_trigger ON games;
