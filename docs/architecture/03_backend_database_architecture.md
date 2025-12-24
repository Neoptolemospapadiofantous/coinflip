# Backend & Database Architecture
## Complete Specification for Supabase + Event Indexing

---

## Document Purpose

This document provides everything needed to build the backend infrastructure:
- Complete Supabase setup and configuration
- Database schema with indexes
- Event indexing patterns
- Queue matching algorithms
- Real-time subscriptions
- Edge Functions for game logic
- Security rules and RLS policies

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Event Indexing](#3-event-indexing)
4. [Queue System](#4-queue-system)
5. [Real-Time Subscriptions](#5-real-time-subscriptions)
6. [Edge Functions](#6-edge-functions)
7. [Security & RLS](#7-security--rls)
8. [API Design](#8-api-design)
9. [Performance Optimization](#9-performance-optimization)
10. [Monitoring & Observability](#10-monitoring--observability)

---

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────┐
│           BLOCKCHAIN LAYER                      │
│  Smart Contract + VRF + Events                  │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Events
                  ↓
┌─────────────────────────────────────────────────┐
│           EVENT INDEXER                         │
│  Listens to blockchain events                   │
│  Normalizes data                                │
│  Writes to Supabase                            │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Writes
                  ↓
┌─────────────────────────────────────────────────┐
│           SUPABASE LAYER                        │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │  PostgreSQL  │  │ Edge Functions│            │
│  │  Database    │  │  (Queue Logic)│            │
│  └──────────────┘  └──────────────┘            │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │   Auth       │  │  Real-time   │            │
│  │   (SIWE)     │  │  Subscriptions│           │
│  └──────────────┘  └──────────────┘            │
└─────────────────┬───────────────────────────────┘
                  │
                  │ GraphQL / REST
                  ↓
┌─────────────────────────────────────────────────┐
│           FRONTEND                              │
│  React + wagmi + Real-time Updates             │
└─────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
WRITE PATH (Blockchain → Database):
1. User creates game on smart contract
2. Contract emits GameCreated event
3. Event indexer catches event
4. Data normalized and written to Supabase
5. Real-time subscriptions push to clients

READ PATH (Database → Frontend):
1. Frontend queries Supabase via REST/GraphQL
2. Data returned with proper joins
3. Real-time updates via WebSocket
4. Optimistic UI updates where possible
```

### 1.3 What Supabase Does vs. Doesn't Do

```
✅ SUPABASE HANDLES:
├── Game discovery (public game listings)
├── Queue matchmaking (off-chain coordination)
├── User profiles and statistics
├── Game history and analytics
├── Real-time notifications
└── Read-heavy operations

❌ SUPABASE NEVER:
├── Holds user funds
├── Decides game outcomes
├── Generates randomness
├── Signs transactions
├── Has write access to wallets
└── Can override on-chain state
```

---

## 2. Database Schema

### 2.1 Complete SQL Schema

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  -- Identity
  wallet_address TEXT PRIMARY KEY,
  ens_name TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  
  -- Statistics
  total_games INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_games > 0 THEN (total_wins::DECIMAL / total_games * 100)
      ELSE 0
    END
  ) STORED,
  
  -- Financial
  total_wagered NUMERIC(20,0) DEFAULT 0,
  total_won NUMERIC(20,0) DEFAULT 0,
  net_profit NUMERIC(20,0) GENERATED ALWAYS AS (total_won - total_wagered) STORED,
  
  -- Streaks
  current_streak INTEGER DEFAULT 0,
  longest_win_streak INTEGER DEFAULT 0,
  longest_loss_streak INTEGER DEFAULT 0,
  
  -- Preferences (optional)
  notifications_enabled BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE
);

-- Indexes for users
CREATE INDEX idx_users_last_seen ON users(last_seen DESC);
CREATE INDEX idx_users_win_rate ON users(win_rate DESC NULLS LAST);
CREATE INDEX idx_users_total_games ON users(total_games DESC);

-- ============================================
-- TIERS TABLE
-- ============================================
CREATE TABLE tiers (
  id INTEGER PRIMARY KEY,
  
  -- Configuration
  amount NUMERIC(20,0) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  min_balance NUMERIC(20,0) DEFAULT 0,
  
  -- Display
  label TEXT NOT NULL, -- "$5", "$10", etc.
  description TEXT,
  
  -- Statistics
  total_games BIGINT DEFAULT 0,
  total_volume NUMERIC(30,0) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize tiers
INSERT INTO tiers (id, amount, label, min_balance) VALUES
  (0, 5000000, '$5', 10000000),
  (1, 10000000, '$10', 20000000),
  (2, 25000000, '$25', 50000000),
  (3, 50000000, '$50', 100000000),
  (4, 100000000, '$100', 200000000);

-- ============================================
-- GAMES TABLE
-- ============================================
CREATE TABLE games (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,
  
  -- On-chain reference (UNIQUE to prevent duplicate indexing)
  onchain_id BIGINT UNIQUE NOT NULL,
  
  -- Game configuration
  tier INTEGER NOT NULL REFERENCES tiers(id),
  bet_amount NUMERIC(20,0) NOT NULL,
  
  -- Players
  player_a TEXT NOT NULL REFERENCES users(wallet_address),
  player_b TEXT REFERENCES users(wallet_address),
  choice_a BOOLEAN NOT NULL, -- false = heads, true = tails
  
  -- State
  state TEXT NOT NULL DEFAULT 'OPEN',
  
  -- Results
  coin_result BOOLEAN, -- false = heads, true = tails
  winner TEXT REFERENCES users(wallet_address),
  loser TEXT REFERENCES users(wallet_address),
  
  -- Blockchain references
  tx_create TEXT NOT NULL,
  tx_join TEXT,
  tx_resolve TEXT,
  
  -- VRF tracking
  vrf_request_id TEXT,
  vrf_random_seed TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_state CHECK (
    state IN ('OPEN', 'LOCKED', 'RESOLVED', 'CANCELLED')
  ),
  CONSTRAINT valid_players CHECK (
    player_a IS NOT NULL AND
    (state = 'OPEN' OR player_b IS NOT NULL)
  ),
  CONSTRAINT valid_resolution CHECK (
    (state = 'RESOLVED' AND winner IS NOT NULL) OR
    (state != 'RESOLVED')
  )
);

-- Critical indexes for games
CREATE INDEX idx_games_state ON games(state) WHERE state = 'OPEN';
CREATE INDEX idx_games_tier_state ON games(tier, state) WHERE state = 'OPEN';
CREATE INDEX idx_games_player_a ON games(player_a, created_at DESC);
CREATE INDEX idx_games_player_b ON games(player_b, created_at DESC);
CREATE INDEX idx_games_created_at ON games(created_at DESC);
CREATE INDEX idx_games_resolved_at ON games(resolved_at DESC) WHERE state = 'RESOLVED';
CREATE INDEX idx_games_onchain_id ON games(onchain_id);

-- ============================================
-- QUEUES TABLE
-- ============================================
CREATE TABLE queues (
  id BIGSERIAL PRIMARY KEY,
  
  -- Player
  wallet TEXT NOT NULL REFERENCES users(wallet_address),
  
  -- Queue parameters
  tier INTEGER NOT NULL REFERENCES tiers(id),
  choice BOOLEAN NOT NULL, -- false = heads, true = tails
  
  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
  
  -- One entry per wallet per tier
  CONSTRAINT one_queue_per_wallet_tier UNIQUE (wallet, tier)
);

-- Indexes for efficient matching
CREATE INDEX idx_queues_tier_joined ON queues(tier, joined_at);
CREATE INDEX idx_queues_expires ON queues(expires_at) WHERE expires_at > NOW();

-- Auto-cleanup expired queue entries
CREATE OR REPLACE FUNCTION cleanup_expired_queues()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM queues WHERE expires_at < NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_queues
  AFTER INSERT ON queues
  EXECUTE FUNCTION cleanup_expired_queues();

-- ============================================
-- MATCHES TABLE (Temporary)
-- ============================================
CREATE TABLE matches (
  id BIGSERIAL PRIMARY KEY,
  
  -- Matched players
  tier INTEGER NOT NULL,
  player_a TEXT NOT NULL,
  player_b TEXT NOT NULL,
  choice_a BOOLEAN NOT NULL,
  choice_b BOOLEAN NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'PENDING', -- PENDING, CONFIRMED, EXPIRED
  
  -- References
  game_id BIGINT REFERENCES games(onchain_id),
  
  -- Timestamps
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '60 seconds'),
  confirmed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT different_players CHECK (player_a != player_b),
  CONSTRAINT valid_status CHECK (status IN ('PENDING', 'CONFIRMED', 'EXPIRED'))
);

CREATE INDEX idx_matches_status ON matches(status, expires_at);

-- ============================================
-- EVENTS TABLE (Audit Log)
-- ============================================
CREATE TABLE blockchain_events (
  id BIGSERIAL PRIMARY KEY,
  
  -- Event details
  event_name TEXT NOT NULL, -- GameCreated, GameJoined, etc.
  contract_address TEXT NOT NULL,
  
  -- Blockchain reference
  block_number BIGINT NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  
  -- Event data (JSONB for flexibility)
  event_data JSONB NOT NULL,
  
  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  
  -- Timestamp
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate processing
  CONSTRAINT unique_event UNIQUE (transaction_hash, log_index)
);

CREATE INDEX idx_events_processed ON blockchain_events(processed, indexed_at);
CREATE INDEX idx_events_block ON blockchain_events(block_number DESC);
CREATE INDEX idx_events_tx ON blockchain_events(transaction_hash);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update user statistics after game resolution
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.state = 'RESOLVED' AND OLD.state != 'RESOLVED' THEN
    -- Update winner stats
    UPDATE users SET
      total_games = total_games + 1,
      total_wins = total_wins + 1,
      total_won = total_won + (NEW.bet_amount * 2 * 0.98), -- After 2% fee
      current_streak = CASE 
        WHEN current_streak >= 0 THEN current_streak + 1
        ELSE 1
      END,
      longest_win_streak = GREATEST(
        longest_win_streak,
        CASE WHEN current_streak >= 0 THEN current_streak + 1 ELSE 1 END
      )
    WHERE wallet_address = NEW.winner;
    
    -- Update loser stats
    UPDATE users SET
      total_games = total_games + 1,
      total_losses = total_losses + 1,
      total_wagered = total_wagered + NEW.bet_amount,
      current_streak = CASE 
        WHEN current_streak <= 0 THEN current_streak - 1
        ELSE -1
      END,
      longest_loss_streak = GREATEST(
        longest_loss_streak,
        CASE WHEN current_streak <= 0 THEN ABS(current_streak - 1) ELSE 1 END
      )
    WHERE wallet_address = NEW.loser;
    
    -- Update tier statistics
    UPDATE tiers SET
      total_games = total_games + 1,
      total_volume = total_volume + (NEW.bet_amount * 2)
    WHERE id = NEW.tier;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stats
  AFTER UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_user_stats();

-- Auto-create user on first reference
CREATE OR REPLACE FUNCTION ensure_user_exists()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (wallet_address)
  VALUES (NEW.wallet_address)
  ON CONFLICT (wallet_address) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_user_player_a
  BEFORE INSERT ON games
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_exists();
```

### 2.2 Database Views

```sql
-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Open games with tier information
CREATE VIEW v_open_games AS
SELECT 
  g.id,
  g.onchain_id,
  g.tier,
  t.label as tier_label,
  g.bet_amount,
  g.player_a,
  g.choice_a,
  g.created_at,
  EXTRACT(EPOCH FROM (NOW() - g.created_at)) as age_seconds
FROM games g
JOIN tiers t ON g.tier = t.id
WHERE g.state = 'OPEN'
ORDER BY g.created_at DESC;

-- User game history with outcomes
CREATE VIEW v_user_game_history AS
SELECT 
  g.id,
  g.onchain_id,
  g.tier,
  t.label as tier_label,
  g.bet_amount,
  g.state,
  g.player_a,
  g.player_b,
  g.winner,
  g.coin_result,
  g.created_at,
  g.resolved_at,
  CASE 
    WHEN g.player_a = u.wallet_address THEN 'player_a'
    WHEN g.player_b = u.wallet_address THEN 'player_b'
  END as user_role,
  CASE 
    WHEN g.winner = u.wallet_address THEN 'WIN'
    WHEN g.state = 'RESOLVED' AND g.winner != u.wallet_address THEN 'LOSS'
    WHEN g.state = 'CANCELLED' THEN 'CANCELLED'
    ELSE 'PENDING'
  END as outcome
FROM games g
JOIN tiers t ON g.tier = t.id
CROSS JOIN users u
WHERE g.player_a = u.wallet_address OR g.player_b = u.wallet_address
ORDER BY g.created_at DESC;

-- Leaderboard by win rate
CREATE VIEW v_leaderboard_winrate AS
SELECT 
  wallet_address,
  ens_name,
  total_games,
  total_wins,
  win_rate,
  RANK() OVER (ORDER BY win_rate DESC, total_games DESC) as rank
FROM users
WHERE total_games >= 10 -- Minimum games for ranking
ORDER BY rank;

-- Leaderboard by volume
CREATE VIEW v_leaderboard_volume AS
SELECT 
  wallet_address,
  ens_name,
  total_wagered,
  total_won,
  net_profit,
  RANK() OVER (ORDER BY total_wagered DESC) as rank
FROM users
WHERE total_wagered > 0
ORDER BY rank;

-- Daily statistics
CREATE VIEW v_daily_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as games_played,
  COUNT(DISTINCT player_a) + COUNT(DISTINCT player_b) as unique_players,
  SUM(bet_amount * 2) as total_volume,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) as avg_duration_seconds
FROM games
WHERE state = 'RESOLVED'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 3. Event Indexing

### 3.1 Event Indexer Architecture

```typescript
// indexer/main.ts
import { createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';
import { COINFLIP_ABI, COINFLIP_ADDRESS } from './contracts';

const publicClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.RPC_URL)
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Service role key
);

// Track last processed block
let lastProcessedBlock = 0;

async function initializeIndexer() {
  // Get last processed block from database
  const { data } = await supabase
    .from('blockchain_events')
    .select('block_number')
    .order('block_number', { ascending: false })
    .limit(1)
    .single();
  
  lastProcessedBlock = data?.block_number || 0;
  console.log(`Starting from block ${lastProcessedBlock}`);
}

async function indexEvents() {
  const currentBlock = await publicClient.getBlockNumber();
  
  if (currentBlock <= lastProcessedBlock) {
    return; // No new blocks
  }
  
  // Fetch events in batches
  const fromBlock = BigInt(lastProcessedBlock + 1);
  const toBlock = BigInt(Math.min(
    Number(currentBlock),
    lastProcessedBlock + 1000 // Process max 1000 blocks at a time
  ));
  
  console.log(`Processing blocks ${fromBlock} to ${toBlock}`);
  
  // Get all events
  const events = await publicClient.getContractEvents({
    address: COINFLIP_ADDRESS,
    abi: COINFLIP_ABI,
    fromBlock,
    toBlock
  });
  
  // Process each event
  for (const event of events) {
    await processEvent(event);
  }
  
  lastProcessedBlock = Number(toBlock);
}

async function processEvent(event: any) {
  const { eventName, args, blockNumber, transactionHash, logIndex } = event;
  
  // Store raw event first
  const { error: insertError } = await supabase
    .from('blockchain_events')
    .insert({
      event_name: eventName,
      contract_address: COINFLIP_ADDRESS,
      block_number: Number(blockNumber),
      transaction_hash: transactionHash,
      log_index: logIndex,
      event_data: args,
      processed: false
    });
  
  if (insertError) {
    if (insertError.code === '23505') {
      // Duplicate event, already processed
      return;
    }
    throw insertError;
  }
  
  // Process event based on type
  switch (eventName) {
    case 'GameCreated':
      await handleGameCreated(args, transactionHash);
      break;
    case 'GameJoined':
      await handleGameJoined(args, transactionHash);
      break;
    case 'GameResolved':
      await handleGameResolved(args, transactionHash);
      break;
    case 'GameCancelled':
      await handleGameCancelled(args, transactionHash);
      break;
  }
  
  // Mark as processed
  await supabase
    .from('blockchain_events')
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq('transaction_hash', transactionHash)
    .eq('log_index', logIndex);
}

async function handleGameCreated(args: any, txHash: string) {
  const { gameId, creator, tier, amount, choice } = args;
  
  await supabase.from('games').insert({
    onchain_id: Number(gameId),
    tier: Number(tier),
    bet_amount: amount.toString(),
    player_a: creator.toLowerCase(),
    choice_a: choice,
    state: 'OPEN',
    tx_create: txHash
  });
}

async function handleGameJoined(args: any, txHash: string) {
  const { gameId, joiner } = args;
  
  await supabase
    .from('games')
    .update({
      player_b: joiner.toLowerCase(),
      state: 'LOCKED',
      joined_at: new Date().toISOString(),
      tx_join: txHash
    })
    .eq('onchain_id', Number(gameId));
}

async function handleGameResolved(args: any, txHash: string) {
  const { gameId, winner, loser, coinResult } = args;
  
  await supabase
    .from('games')
    .update({
      winner: winner.toLowerCase(),
      loser: loser.toLowerCase(),
      coin_result: coinResult,
      state: 'RESOLVED',
      resolved_at: new Date().toISOString(),
      tx_resolve: txHash
    })
    .eq('onchain_id', Number(gameId));
}

async function handleGameCancelled(args: any, txHash: string) {
  const { gameId } = args;
  
  await supabase
    .from('games')
    .update({
      state: 'CANCELLED',
      cancelled_at: new Date().toISOString()
    })
    .eq('onchain_id', Number(gameId));
}

// Main loop
async function main() {
  await initializeIndexer();
  
  // Poll for new events every 5 seconds
  setInterval(async () => {
    try {
      await indexEvents();
    } catch (error) {
      console.error('Indexing error:', error);
    }
  }, 5000);
}

main();
```

### 3.2 Alternative: The Graph

```graphql
# subgraph/schema.graphql
type Game @entity {
  id: ID!
  onchainId: BigInt!
  tier: Tier!
  betAmount: BigInt!
  
  playerA: User!
  playerB: User
  choiceA: Boolean!
  
  state: GameState!
  
  coinResult: Boolean
  winner: User
  loser: User
  
  txCreate: Bytes!
  txJoin: Bytes
  txResolve: Bytes
  
  createdAt: BigInt!
  joinedAt: BigInt
  resolvedAt: BigInt
}

enum GameState {
  OPEN
  LOCKED
  RESOLVED
  CANCELLED
}

type User @entity {
  id: ID! # wallet address
  totalGames: Int!
  totalWins: Int!
  totalLosses: Int!
  totalWagered: BigInt!
  totalWon: BigInt!
  
  gamesAsPlayerA: [Game!]! @derivedFrom(field: "playerA")
  gamesAsPlayerB: [Game!]! @derivedFrom(field: "playerB")
}

type Tier @entity {
  id: ID!
  amount: BigInt!
  totalGames: BigInt!
  totalVolume: BigInt!
  
  games: [Game!]! @derivedFrom(field: "tier")
}
```

---

## 4. Queue System

### 4.1 Queue Matching Algorithm

```typescript
// supabase/functions/match-queue/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Get all pending queue entries grouped by tier
  const { data: queueEntries, error } = await supabase
    .from('queues')
    .select('*')
    .gte('expires_at', new Date().toISOString())
    .order('tier, joined_at');
  
  if (error || !queueEntries) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }
  
  // Group by tier
  const tierQueues = new Map<number, any[]>();
  for (const entry of queueEntries) {
    if (!tierQueues.has(entry.tier)) {
      tierQueues.set(entry.tier, []);
    }
    tierQueues.get(entry.tier)!.push(entry);
  }
  
  const matches = [];
  
  // Match players in each tier (FIFO)
  for (const [tier, entries] of tierQueues) {
    while (entries.length >= 2) {
      const playerA = entries.shift()!;
      const playerB = entries.shift()!;
      
      // Ensure different wallets
      if (playerA.wallet === playerB.wallet) {
        entries.unshift(playerB); // Put back
        continue;
      }
      
      // Create match
      const match = {
        tier,
        player_a: playerA.wallet,
        player_b: playerB.wallet,
        choice_a: playerA.choice,
        choice_b: playerB.choice,
        status: 'PENDING'
      };
      
      // Insert match
      await supabase.from('matches').insert(match);
      
      // Remove from queue
      await supabase
        .from('queues')
        .delete()
        .in('id', [playerA.id, playerB.id]);
      
      matches.push(match);
      
      // Notify players via real-time
      await supabase
        .from('notifications')
        .insert([
          { wallet: playerA.wallet, type: 'match_found', data: match },
          { wallet: playerB.wallet, type: 'match_found', data: match }
        ]);
    }
  }
  
  return new Response(
    JSON.stringify({ matches_created: matches.length }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

### 4.2 Queue API Functions

```typescript
// Client-side queue functions
export async function joinQueue(
  wallet: string,
  tier: number,
  choice: boolean
) {
  const { error } = await supabase
    .from('queues')
    .insert({
      wallet,
      tier,
      choice,
      joined_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    });
  
  if (error) throw error;
}

export async function leaveQueue(wallet: string) {
  await supabase
    .from('queues')
    .delete()
    .eq('wallet', wallet);
}

export async function getQueueStatus(tier: number) {
  const { data, error } = await supabase
    .from('queues')
    .select('count')
    .eq('tier', tier)
    .gte('expires_at', new Date().toISOString())
    .single();
  
  return data?.count || 0;
}
```

---

## 5. Real-Time Subscriptions

### 5.1 Frontend Subscription Patterns

```typescript
// hooks/useGameUpdates.ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useGameStore } from '@/store/gameStore';

export function useGameUpdates(gameId: number) {
  useEffect(() => {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        (payload) => {
          const updatedGame = payload.new;
          
          // Update local state
          useGameStore.getState().updateGame(updatedGame);
          
          // Show notifications
          if (updatedGame.state === 'RESOLVED') {
            showResultNotification(updatedGame);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);
}

// hooks/useMatchNotifications.ts
export function useMatchNotifications(wallet: string) {
  useEffect(() => {
    const channel = supabase
      .channel(`matches:${wallet}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `player_a=eq.${wallet}`
        },
        (payload) => {
          showMatchFoundNotification(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `player_b=eq.${wallet}`
        },
        (payload) => {
          showMatchFoundNotification(payload.new);
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [wallet]);
}
```

---

## 6. Edge Functions

### 6.1 Cron Jobs (Queue Matching)

```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Run queue matching every 5 seconds
// Configured in supabase dashboard: */5 * * * * *
```

---

## 7. Security & RLS

### 7.1 Row Level Security Policies

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;

-- Users can read all user data
CREATE POLICY "Users are publicly readable"
  ON users FOR SELECT
  USING (true);

-- Users can update only their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = wallet_address);

-- Games are publicly readable
CREATE POLICY "Games are publicly readable"
  ON games FOR SELECT
  USING (true);

-- Only service role can insert/update games (from indexer)
CREATE POLICY "Only service can modify games"
  ON games FOR ALL
  USING (auth.role() = 'service_role');

-- Users can insert their own queue entries
CREATE POLICY "Users can join queue"
  ON queues FOR INSERT
  WITH CHECK (auth.uid() = wallet);

-- Users can delete only their own queue entries
CREATE POLICY "Users can leave queue"
  ON queues FOR DELETE
  USING (auth.uid() = wallet);

-- Users can read queue status
CREATE POLICY "Queue is readable"
  ON queues FOR SELECT
  USING (true);
```

---

## 8. API Design

### 8.1 REST Endpoints

```typescript
// Public endpoints (no auth required)
GET  /api/tiers              // Get all active tiers
GET  /api/games/open         // Get open games
GET  /api/games/:id          // Get game details
GET  /api/leaderboard        // Get leaderboard
GET  /api/stats/daily        // Get daily stats

// Authenticated endpoints (wallet required)
GET  /api/user/:wallet       // Get user profile
GET  /api/games/user/:wallet // Get user's games
POST /api/queue/join         // Join matchmaking queue
POST /api/queue/leave        // Leave queue
GET  /api/queue/status/:tier // Get queue status
```

### 8.2 Example API Implementation

```typescript
// api/games/open.ts
export async function getOpenGames(tier?: number) {
  let query = supabase
    .from('v_open_games')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (tier !== undefined) {
    query = query.eq('tier', tier);
  }
  
  const { data, error } = await query.limit(50);
  
  if (error) throw error;
  return data;
}
```

---

## 9. Performance Optimization

### 9.1 Database Indexes

```sql
-- Already created in schema, but worth highlighting:

-- Critical for game discovery
CREATE INDEX idx_games_tier_state ON games(tier, state) WHERE state = 'OPEN';

-- Critical for user history
CREATE INDEX idx_games_player_a ON games(player_a, created_at DESC);
CREATE INDEX idx_games_player_b ON games(player_b, created_at DESC);

-- Critical for queue matching
CREATE INDEX idx_queues_tier_joined ON queues(tier, joined_at);
```

### 9.2 Caching Strategy

```typescript
// React Query caching config
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,     // 30 seconds
      cacheTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

// Specific cache times
export function useTiers() {
  return useQuery({
    queryKey: ['tiers'],
    queryFn: fetchTiers,
    staleTime: 5 * 60 * 1000 // Tiers change rarely
  });
}

export function useOpenGames(tier: number) {
  return useQuery({
    queryKey: ['openGames', tier],
    queryFn: () => fetchOpenGames(tier),
    staleTime: 10 * 1000,      // Refresh often
    refetchInterval: 10 * 1000  // Poll every 10s
  });
}
```

---

## 10. Monitoring & Observability

### 10.1 Key Metrics to Track

```typescript
// Database metrics
const metrics = {
  // Performance
  queryLatency: 'avg response time per endpoint',
  indexUsage: 'index hit rate',
  connectionPool: 'active/idle connections',
  
  // Business
  dailyActiveUsers: 'unique wallets per day',
  gamesPerDay: 'total games created',
  averageMatchTime: 'queue → game start',
  
  // Health
  indexerLag: 'current block - last indexed block',
  queueSize: 'entries per tier',
  errorRate: 'failed transactions / total'
};
```

### 10.2 Health Check Endpoint

```typescript
// api/health.ts
export async function healthCheck() {
  const checks = {
    database: await checkDatabase(),
    indexer: await checkIndexer(),
    queues: await checkQueues()
  };
  
  const healthy = Object.values(checks).every(c => c.status === 'ok');
  
  return {
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  };
}

async function checkDatabase() {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('count')
      .limit(1);
    
    return { status: error ? 'error' : 'ok' };
  } catch {
    return { status: 'error' };
  }
}
```

---

## Conclusion

This backend architecture provides:

✅ **Complete database schema** with proper indexes and constraints  
✅ **Real-time event indexing** from blockchain to database  
✅ **Efficient queue matching** with FIFO fairness  
✅ **Real-time subscriptions** for live updates  
✅ **Row-level security** to protect user data  
✅ **Performance optimizations** with caching and indexes  
✅ **Monitoring and observability** for production readiness

**Next Steps:**
1. Set up Supabase project
2. Run SQL migrations
3. Deploy event indexer
4. Configure Edge Functions
5. Test queue matching logic
6. Set up monitoring dashboards

