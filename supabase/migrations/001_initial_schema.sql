-- Migration 001: Initial Schema Setup
-- Description: Creates core tables for the CoinFlip application
-- Tables: tiers, games, queue, _migrations
--
-- Run this migration first before any other migrations.

-- ===========================================================================
-- TIERS TABLE
-- ===========================================================================
-- Stores the fixed bet tiers for coinflip games

CREATE TABLE IF NOT EXISTS tiers (
  id INTEGER PRIMARY KEY,
  amount TEXT NOT NULL,                    -- Amount in wei as string (for precision)
  amount_usd INTEGER NOT NULL,             -- Amount in USD (5, 10, 25, 50, 100)
  win_amount TEXT NOT NULL,                -- Win amount in wei as string (95% of pot)
  win_amount_usd NUMERIC NOT NULL,         -- Win amount in USD
  players_in_queue INTEGER DEFAULT 0,      -- Count of players waiting
  enabled BOOLEAN DEFAULT true,            -- Whether tier is active
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add table comments
COMMENT ON TABLE tiers IS 'Fixed bet tiers for coin flip games';
COMMENT ON COLUMN tiers.amount IS 'Bet amount in wei (18 decimals) as string';
COMMENT ON COLUMN tiers.win_amount IS 'Payout amount in wei after 5% fee';

-- ===========================================================================
-- MIGRATIONS TABLE
-- ===========================================================================
-- Tracks executed migrations

CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE _migrations IS 'Tracks database migration history';

-- Record this migration
INSERT INTO _migrations (version, filename)
VALUES (1, '001_initial_schema.sql')
ON CONFLICT (version) DO NOTHING;
