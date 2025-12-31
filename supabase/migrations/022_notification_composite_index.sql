-- Migration: Add composite index for notification queries
-- Optimizes queries that filter by user_address AND game_id together

-- Drop existing single-column indexes (composite index covers these queries)
DROP INDEX IF EXISTS idx_user_game_notifications_user;
DROP INDEX IF EXISTS idx_user_game_notifications_game;

-- Create composite index for efficient lookups (user_address, game_id)
-- This covers:
-- 1. .eq('user_address', ...).eq('game_id', ...) - exact match
-- 2. .eq('user_address', ...).in('game_id', [...]) - user with multiple games
-- 3. .eq('user_address', ...) - just user (prefix of composite)
CREATE INDEX idx_user_game_notifications_user_game
  ON user_game_notifications(user_address, game_id);

-- Add index on updated_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_user_game_notifications_updated
  ON user_game_notifications(updated_at);
