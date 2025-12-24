# 🎮 Game Session Management Setup Guide

Complete guide to setting up robust game session tracking with Supabase and blockchain event syncing.

---

## Overview

This system syncs blockchain events to Supabase in real-time, providing:
- ✅ Persistent game history
- ✅ Real-time game queue
- ✅ Player statistics
- ✅ Game state tracking (pending → matched → resolved)

---

## Step 1: Database Setup (5 minutes)

### 1.1 Run Migrations in Supabase

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Click **"New Query"**
5. Copy and paste the entire contents of:
   ```
   /home/theone/Desktop/coinflip/supabase/run-all-migrations.sql
   ```
6. Click **"Run"**

This will:
- ✅ Fix tier amounts (0.001 to 0.020 ETH)
- ✅ Create `games` table with all fields
- ✅ Create `indexer_state` table
- ✅ Create views for active games, stats, etc.
- ✅ Set up indexes and RLS policies

### 1.2 Verify Migration Success

After running, you should see:
```
✅ All migrations completed successfully!
```

And a table showing:
```
id | amount_eth | amount_usd | enabled
0  | 0.001      | 5          | true
1  | 0.002      | 10         | true
2  | 0.005      | 25         | true
3  | 0.010      | 50         | true
4  | 0.020      | 100        | true
```

### 1.3 Check Tables

Go to **Table Editor** and verify you see:
- ✅ `tiers` (updated amounts)
- ✅ `games` (empty, ready for indexing)
- ✅ `indexer_state` (empty, ready for indexing)

---

## Step 2: Environment Variables

### 2.1 Update .env.local

Make sure you have these variables set:

```bash
# Supabase (Public - already set)
NEXT_PUBLIC_SUPABASE_URL=https://dkthmzaumugpuhnodpgy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_GtCZfCnrhKD9BBHZjkasyA_kQ8F76BS

# Supabase Service Role (for indexer - optional)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Get from Supabase Settings → API

# Contract (already set)
NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA=0x0D24d83E396c96759294b2b0C5c6C64F7DB189CB

# Network (already set)
NEXT_PUBLIC_CHAIN_ID=11155111
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/pTdIRNSBN636YhFheZaqq
```

**Note:** The Service Role Key is optional - the indexer will work with just the anon key, but service role gives better permissions.

### 2.2 Get Service Role Key (Optional but Recommended)

1. Go to: https://supabase.com/dashboard/project/_/settings/api
2. Scroll to **"Project API keys"**
3. Copy the **"service_role" secret** key
4. Add to `.env.local`:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## Step 3: Disable Mock Data (Already Done)

The app is currently using mock tier data. To use real Supabase data:

In `hooks/useTiers.ts`, change line 8:
```typescript
const USE_MOCK_DATA = true;  // ← Change to false
```

To:
```typescript
const USE_MOCK_DATA = false;  // ← Use real Supabase data
```

**Already done for you!** The app will now read from Supabase.

---

## Step 4: Run the Event Indexer

The indexer watches the blockchain and syncs events to Supabase.

### 4.1 Start the Indexer

**Terminal 1** (keep this running):
```bash
cd /home/theone/Desktop/coinflip
pnpm indexer
```

You'll see:
```
🚀 Starting CoinFlip Event Indexer...
📍 Contract: 0x0D24d83E396c96759294b2b0C5c6C64F7DB189CB
🌐 Network: Sepolia
📦 Current block: 9896234
⏮️  Last processed block: 0
▶️  Starting from block: 9895234
🔍 Indexing blocks 9895234 to 9896234...
📝 GameCreated: ID=0, Creator=0x4492..., Tier=0
🤝 GameMatched: ID=0, Joiner=0x6c2e...
🎉 GameResolved: ID=0, Winner=0x4492..., Payout=1900000000000000
✅ Processed 3 events
👀 Watching for new events...
```

### 4.2 What the Indexer Does

1. **Catches up** on past events (last 1000 blocks)
2. **Watches** for new blocks (every 12 seconds)
3. **Syncs events** to Supabase:
   - `GameCreated` → Insert new game
   - `GameMatched` → Update game with joiner
   - `GameResolved` → Update game with winner
   - `GameCancelled` → Mark game as cancelled

### 4.3 Keep It Running

**Option A: Run in Screen/Tmux**
```bash
screen -S indexer
pnpm indexer
# Press Ctrl+A then D to detach
```

**Option B: Run as Systemd Service** (Production)
```bash
# Create service file
sudo nano /etc/systemd/system/coinflip-indexer.service

[Unit]
Description=CoinFlip Event Indexer
After=network.target

[Service]
Type=simple
User=theone
WorkingDirectory=/home/theone/Desktop/coinflip
ExecStart=/usr/bin/pnpm indexer
Restart=always

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable coinflip-indexer
sudo systemctl start coinflip-indexer
```

---

## Step 5: Test the System

### 5.1 Check Database

Go to Supabase Table Editor → `games`

You should see your past games synced!

### 5.2 Create a New Game

1. Go to: http://localhost:3000/play
2. Connect wallet
3. Create a game (Tier 0)
4. Watch the indexer terminal - you'll see:
   ```
   📝 GameCreated: ID=1, Creator=0x..., Tier=0
   ```
5. Check Supabase - new game appears!

### 5.3 Join a Game

1. Switch wallet in MetaMask
2. Go to: http://localhost:3000/queue
3. You'll see the game in the queue (real-time!)
4. Join the game
5. Watch indexer:
   ```
   🤝 GameMatched: ID=1, Joiner=0x...
   ```
6. Wait for VRF (1-3 min)
7. Indexer shows:
   ```
   🎉 GameResolved: ID=1, Winner=0x..., Payout=...
   ```

---

## Step 6: Frontend Updates

### 6.1 Game Queue (Already Updated!)

The queue page now shows real games from Supabase:
- http://localhost:3000/queue

Features:
- ✅ Real pending games
- ✅ Live stats (players waiting, total games)
- ✅ Join game dialog
- ✅ Auto-refresh every 5 seconds

### 6.2 Future Enhancements

You can now build:
- **Player Dashboard** - Show user's game history
- **Leaderboard** - Top winners
- **Game History** - All resolved games
- **Live Feed** - Real-time game updates

---

## Architecture Overview

```
┌─────────────┐
│  Blockchain │
│  (Sepolia)  │
└──────┬──────┘
       │ Events
       ▼
┌─────────────┐
│   Indexer   │  ← Watches events
│  (Node.js)  │  ← Syncs to DB
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Supabase   │  ← PostgreSQL
│  (Database) │  ← Real-time subs
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Frontend  │  ← Reads from DB
│  (Next.js)  │  ← Shows games
└─────────────┘
```

---

## Monitoring & Debugging

### Check Indexer Logs

```bash
# If running with screen
screen -r indexer

# If running as service
sudo journalctl -u coinflip-indexer -f
```

### Check Database

**Supabase SQL Editor:**
```sql
-- Count games by status
SELECT status, COUNT(*) as count
FROM games
GROUP BY status;

-- Recent games
SELECT id, tier, status, creator_address, created_at
FROM games
ORDER BY created_at DESC
LIMIT 10;

-- Game statistics
SELECT * FROM game_statistics;

-- Active games with tier info
SELECT * FROM active_games;
```

### Common Issues

**Issue: Indexer not syncing**
- Check RPC_URL is working
- Verify contract address is correct
- Check Supabase credentials

**Issue: Games not appearing in queue**
- Check `USE_MOCK_DATA = false` in useTiers.ts
- Verify indexer is running
- Check browser console for errors

**Issue: Indexer crashes**
- Check .env.local has all required vars
- Verify Supabase connection
- Check RPC rate limits

---

## Scripts Reference

```bash
# Run event indexer (production)
pnpm indexer

# Run indexer with auto-reload (development)
pnpm indexer:dev

# Run database migrations
# (Use Supabase SQL Editor instead)

# Verify database connection
pnpm verify-db
```

---

## Production Checklist

Before deploying to production:

- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` in env
- [ ] Run indexer as systemd service
- [ ] Set up monitoring/alerts
- [ ] Enable Supabase backups
- [ ] Add rate limiting to RPC calls
- [ ] Set up error tracking (Sentry)
- [ ] Restrict Supabase RLS policies
- [ ] Add indexes for performance
- [ ] Set up Supabase replication
- [ ] Monitor indexer health

---

## Next Steps

Now that you have robust game session tracking:

1. ✅ Games sync from blockchain to database
2. ✅ Queue shows real pending games
3. ✅ Stats are calculated automatically
4. ✅ History is preserved

**You can now:**
- View all games in Supabase
- Build analytics dashboards
- Track player statistics
- Monitor game outcomes
- Audit all transactions

**Ready to test!** 🎮

Create a game, join it with another wallet, and watch it all sync in real-time!
