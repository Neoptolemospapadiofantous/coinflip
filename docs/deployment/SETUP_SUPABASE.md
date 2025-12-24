# Setting Up Supabase Database

The app currently uses **mock data** for development. Follow these steps to connect to a real Supabase database.

## Current Status

✅ **Mock Data Active** - The app works with static tier data
⏳ **Supabase Setup Needed** - Database tables need to be created

## Quick Setup

### 1. Create Supabase Tables

Go to your Supabase project SQL editor and run:

```sql
-- Create tiers table
CREATE TABLE tiers (
  id INTEGER PRIMARY KEY,
  amount TEXT NOT NULL,
  amount_usd INTEGER NOT NULL,
  win_amount TEXT NOT NULL,
  win_amount_usd NUMERIC NOT NULL,
  players_in_queue INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert tier data
INSERT INTO tiers (id, amount, amount_usd, win_amount, win_amount_usd, players_in_queue, enabled)
VALUES
  (0, '5000000000000000000', 5, '9500000000000000000', 9.5, 0, true),
  (1, '10000000000000000000', 10, '19000000000000000000', 19, 0, true),
  (2, '25000000000000000000', 25, '47500000000000000000', 47.5, 0, true),
  (3, '50000000000000000000', 50, '95000000000000000000', 95, 0, true),
  (4, '100000000000000000000', 100, '190000000000000000000', 190, 0, true);

-- Create games table
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  creator TEXT NOT NULL,
  joiner TEXT,
  tier INTEGER NOT NULL REFERENCES tiers(id),
  amount TEXT NOT NULL,
  creator_choice BOOLEAN NOT NULL,
  joiner_choice BOOLEAN,
  result BOOLEAN,
  winner TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  matched_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  tx_hash TEXT NOT NULL,
  vrf_request_id TEXT
);

-- Create queue table
CREATE TABLE queue (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  game_id TEXT NOT NULL REFERENCES games(id),
  tier INTEGER NOT NULL REFERENCES tiers(id),
  player_address TEXT NOT NULL,
  choice BOOLEAN NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes
CREATE INDEX idx_games_creator ON games(creator);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_tier ON games(tier);
CREATE INDEX idx_queue_tier ON queue(tier);
CREATE INDEX idx_queue_expires ON queue(expires_at);

-- Enable Row Level Security (RLS)
ALTER TABLE tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (read-only for now)
CREATE POLICY "Tiers are viewable by everyone" ON tiers
  FOR SELECT USING (true);

CREATE POLICY "Games are viewable by everyone" ON games
  FOR SELECT USING (true);

CREATE POLICY "Queue is viewable by everyone" ON queue
  FOR SELECT USING (true);
```

### 2. Enable Realtime

In Supabase Dashboard:
1. Go to **Database → Replication**
2. Enable realtime for tables: `games`, `queue`, `tiers`

### 3. Switch to Real Data

In `hooks/useTiers.ts`, change:

```typescript
const USE_MOCK_DATA = true; // ← Change to false
```

### 4. Restart Dev Server

```bash
pnpm dev
```

## Environment Variables

Make sure these are set in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://dkthmzaumugpuhnodpgy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_GtCZfCnrhKD9BBHZjkasyA_kQ8F76BS
```

## Testing

After setup, verify:

1. Visit `/play` page
2. Check console - should say "Fetching tiers from Supabase"
3. Tier selector should show 5 tiers ($5, $10, $25, $50, $100)
4. No errors in console

## Troubleshooting

### "Error fetching tiers"
- Check Supabase URL and key in `.env.local`
- Verify tables are created in SQL editor
- Check RLS policies allow SELECT

### "relation 'tiers' does not exist"
- Run the SQL schema creation script above
- Refresh Supabase dashboard

### Still seeing mock data
- Change `USE_MOCK_DATA = false` in `hooks/useTiers.ts`
- Clear browser cache and restart dev server

## What's Next

After Supabase is working:

1. **Event Indexer** - See `doc/03_backend_database_architecture.md`
2. **Queue System** - Implement matchmaking
3. **Real-time Subscriptions** - Listen for game updates
4. **Smart Contract Events** - Index blockchain data

## Documentation Reference

Full database architecture: `doc/03_backend_database_architecture.md`
