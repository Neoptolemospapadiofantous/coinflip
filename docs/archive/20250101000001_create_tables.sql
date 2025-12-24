-- Migration: Create core tables for CoinFlip game
-- Description: Creates tiers, games, and queue tables
-- Author: CoinFlip Team
-- Date: 2025-01-01

-- ===========================================================================
-- TIERS TABLE
-- ===========================================================================
-- Stores the fixed bet tiers ($5, $10, $25, $50, $100)

CREATE TABLE IF NOT EXISTS tiers (
  id INTEGER PRIMARY KEY,
  amount TEXT NOT NULL,                    -- Amount in wei as string
  amount_usd INTEGER NOT NULL,             -- Amount in USD (5, 10, 25, 50, 100)
  win_amount TEXT NOT NULL,                -- Win amount in wei as string (95% of pot)
  win_amount_usd NUMERIC NOT NULL,         -- Win amount in USD
  players_in_queue INTEGER DEFAULT 0,      -- Count of players waiting
  enabled BOOLEAN DEFAULT true,            -- Whether tier is active
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE tiers IS 'Fixed bet tiers for coin flip games';
COMMENT ON COLUMN tiers.amount IS 'Bet amount in wei (18 decimals)';
COMMENT ON COLUMN tiers.win_amount IS 'Payout amount in wei after 5% fee';

-- ===========================================================================
-- GAMES TABLE
-- ===========================================================================
-- Stores all coin flip games (created, matched, and resolved)

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,                     -- Game ID from smart contract
  creator TEXT NOT NULL,                   -- Creator wallet address
  joiner TEXT,                             -- Joiner wallet address (null until matched)
  tier INTEGER NOT NULL REFERENCES tiers(id),
  amount TEXT NOT NULL,                    -- Bet amount in wei
  creator_choice BOOLEAN NOT NULL,         -- Creator's choice (false=heads, true=tails)
  joiner_choice BOOLEAN,                   -- Joiner's choice
  result BOOLEAN,                          -- VRF result (false=heads, true=tails)
  winner TEXT,                             -- Winner wallet address
  status TEXT NOT NULL DEFAULT 'created',  -- created, matched, pending_vrf, resolved, cancelled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  matched_at TIMESTAMP WITH TIME ZONE,     -- When joiner joined
  resolved_at TIMESTAMP WITH TIME ZONE,    -- When VRF resolved
  tx_hash TEXT NOT NULL,                   -- Creation transaction hash
  vrf_request_id TEXT,                     -- Chainlink VRF request ID
  block_number BIGINT,                     -- Block number of creation
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE games IS 'All coin flip games from smart contract';
COMMENT ON COLUMN games.status IS 'Game lifecycle: created → matched → pending_vrf → resolved/cancelled';
COMMENT ON COLUMN games.result IS 'Coin flip result from Chainlink VRF';

-- ===========================================================================
-- QUEUE TABLE
-- ===========================================================================
-- Manages matchmaking queue for instant games

CREATE TABLE IF NOT EXISTS queue (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  game_id TEXT NOT NULL REFERENCES games(id),
  tier INTEGER NOT NULL REFERENCES tiers(id),
  player_address TEXT NOT NULL,           -- Player wallet address
  choice BOOLEAN NOT NULL,                -- Player's coin choice
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- Queue entry expiration
  matched BOOLEAN DEFAULT false,          -- Whether player was matched
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE queue IS 'Matchmaking queue for instant game mode';
COMMENT ON COLUMN queue.expires_at IS 'Queue entries expire after 5 minutes';

-- ===========================================================================
-- ANALYTICS TABLE (Optional)
-- ===========================================================================
-- Stores aggregated statistics for dashboard

CREATE TABLE IF NOT EXISTS analytics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_games INTEGER DEFAULT 0,
  total_volume TEXT DEFAULT '0',           -- Total volume in wei
  total_volume_usd NUMERIC DEFAULT 0,
  unique_players INTEGER DEFAULT 0,
  games_by_tier JSONB DEFAULT '{}',        -- Count per tier
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE analytics IS 'Daily aggregated game statistics';

-- ===========================================================================
-- PLAYER STATS TABLE (Optional)
-- ===========================================================================
-- Stores per-player statistics

CREATE TABLE IF NOT EXISTS player_stats (
  player_address TEXT PRIMARY KEY,
  total_games INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_volume TEXT DEFAULT '0',           -- Total wagered in wei
  total_volume_usd NUMERIC DEFAULT 0,
  total_winnings TEXT DEFAULT '0',         -- Total won in wei
  total_winnings_usd NUMERIC DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,              -- Percentage
  favorite_tier INTEGER,                   -- Most played tier
  first_game_at TIMESTAMP WITH TIME ZONE,
  last_game_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE player_stats IS 'Aggregated statistics per player';

-- ===========================================================================
-- SUCCESS
-- ===========================================================================

DO $$
BEGIN
  RAISE NOTICE 'Tables created successfully';
  RAISE NOTICE '   - tiers';
  RAISE NOTICE '   - games';
  RAISE NOTICE '   - queue';
  RAISE NOTICE '   - analytics';
  RAISE NOTICE '   - player_stats';
END $$;
