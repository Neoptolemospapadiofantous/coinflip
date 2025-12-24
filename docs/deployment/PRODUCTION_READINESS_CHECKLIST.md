# ✅ Production Readiness Checklist

Complete these steps to make your CoinFlip game production-ready.

---

## Status: 🟡 In Progress

**Current State:**
- ✅ Smart contract deployed to Sepolia: `0x0D24d83E396c96759294b2b0C5c6C64F7DB189CB`
- ✅ All 5 tiers initialized on-chain
- ✅ Frontend working with wallet integration
- ✅ Game lifecycle tested (create, join, VRF resolution)
- ✅ Production indexer code written with error handling
- ✅ Security migration created (RLS policies)
- ✅ Environment validation implemented
- ⚠️ **Service role key not configured**
- ⚠️ **Database migrations not run**
- ⚠️ **Production indexer not tested**

---

## Step 1: Configure Supabase Service Role Key 🔐

**Why:** The production indexer needs the service role key to write blockchain events to your database securely. The anon key is read-only and won't work.

### Action Required:

1. **Get your service role key:**
   - Go to: https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/settings/api
   - Scroll to **Project API keys** section
   - Find the **`service_role`** key (NOT the anon/public key)
   - It should start with `eyJh...` (JWT format)
   - Click the eye icon to reveal it
   - Copy the full key

2. **Update `.env.local`:**

   Open `.env.local` and replace line 44:

   ```bash
   # BEFORE:
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

   # AFTER:
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Your actual key
   ```

3. **Verify it works:**
   ```bash
   pnpm tsx scripts/verify-production-setup.ts
   ```

   You should see:
   - ✅ `SUPABASE_SERVICE_ROLE_KEY: Set`
   - ✅ `SERVICE_ROLE_KEY Format: Valid JWT format`
   - ✅ `Database Connection: Successfully connected`

---

## Step 2: Run Database Migrations 🗄️

**Why:** The migrations set up secure RLS policies that restrict write access to only the indexer (service role), preventing unauthorized data modifications.

### Action Required:

1. **Open Supabase SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/editor

2. **Run migrations in order:**

   **Migration 1:** Initial Schema
   ```bash
   # Open: supabase/migrations/001_initial_schema.sql
   # Copy entire contents and run in SQL Editor
   ```

   **Migration 2:** Games Table
   ```bash
   # Open: supabase/migrations/002_games_table.sql
   # Copy entire contents and run in SQL Editor
   ```

   **Migration 3:** Indexer State
   ```bash
   # Open: supabase/migrations/003_indexer_state.sql
   # Copy entire contents and run in SQL Editor
   ```

   **Migration 4:** Secure RLS Policies ⚠️ **CRITICAL FOR PRODUCTION**
   ```bash
   # Open: supabase/migrations/004_secure_rls_policies.sql
   # Copy entire contents and run in SQL Editor
   ```

3. **Verify migrations succeeded:**

   Run this in SQL Editor:
   ```sql
   -- Check tables exist
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('games', 'tiers', 'indexer_state', 'audit_log');

   -- Check RLS is enabled
   SELECT schemaname, tablename, rowsecurity
   FROM pg_tables
   WHERE tablename IN ('games', 'tiers', 'indexer_state', 'audit_log');

   -- Check policies exist
   SELECT tablename, policyname
   FROM pg_policies
   WHERE tablename IN ('games', 'tiers', 'indexer_state');
   ```

   You should see:
   - 4 tables returned
   - All tables have `rowsecurity = true`
   - Multiple policies for each table

4. **Run verification script:**
   ```bash
   pnpm tsx scripts/verify-production-setup.ts
   ```

   Expected output:
   - ✅ All tables exist and accessible
   - ✅ Indexer state initialized or ready

---

## Step 3: Test Production Indexer 🔄

**Why:** The indexer syncs blockchain events to your database in real-time, providing a queryable history of all games.

### Action Required:

1. **Start the production indexer:**
   ```bash
   pnpm indexer:prod
   ```

   Expected output:
   ```
   ✅ Environment variables validated
   📍 Environment: development
   📍 Chain ID: 11155111
   📍 Contract: 0x0D24d83E396c96759294b2b0C5c6C64F7DB189CB

   🚀 Production Indexer Starting...
   🏥 Health check server listening on http://localhost:3001

   🔍 Indexing blocks 9895332 to 9895432...
   ✅ Processed X events

   👀 Watching for new events...
   ```

2. **In a new terminal, test the health check:**
   ```bash
   curl http://localhost:3001/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "uptime": 60,
     "lastBlock": "9895432",
     "eventsProcessed": 5,
     "errors": 0,
     "failedEvents": 0,
     "secondsSinceLastSync": 12,
     "isPaused": false
   }
   ```

3. **Check database for synced events:**

   In Supabase SQL Editor:
   ```sql
   -- Check all games
   SELECT id, tier, amount, status, creator_address, created_at
   FROM games
   ORDER BY created_at DESC
   LIMIT 10;

   -- Check indexer state
   SELECT * FROM indexer_state;

   -- Check audit log
   SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;
   ```

   You should see your existing games synced from the blockchain.

4. **Keep indexer running** for next step

---

## Step 4: Test Full Game Lifecycle End-to-End 🎮

**Why:** Verify that the entire system works together: frontend → blockchain → indexer → database.

### Action Required:

1. **Create a new game:**
   - Open http://localhost:3000/play
   - Connect Wallet 1
   - Select a tier
   - Choose Heads/Tails
   - Click "Create Game"
   - Approve transaction in MetaMask

2. **Watch the indexer logs:**

   You should see:
   ```
   📥 GameCreated event detected
      Game ID: #123
      Creator: 0x4492...
      Tier: 1
      Amount: 0.001 ETH
   ✅ Synced to database
   ```

3. **Verify in database:**
   ```sql
   SELECT * FROM games WHERE id = 123;
   ```

   Should show:
   - Status: `pending`
   - Creator address populated
   - Transaction hash present

4. **Join the game:**
   - Open http://localhost:3000/queue in a new browser/wallet
   - Connect Wallet 2
   - Click "Join Game" on your pending game
   - Choose Heads/Tails
   - Approve transaction

5. **Watch indexer sync GameMatched:**
   ```
   📥 GameMatched event detected
      Game ID: #123
      Joiner: 0x6c2e...
   ✅ Updated in database
   ```

6. **Wait for VRF resolution (1-3 minutes):**

   Indexer will show:
   ```
   📥 GameResolved event detected
      Game ID: #123
      Winner: 0x4492...
      Random: 12345...
   ✅ Game finalized in database
   ```

7. **Final verification:**
   ```sql
   SELECT id, status, winner_address, random_number, payout
   FROM games
   WHERE id = 123;
   ```

   Should show:
   - Status: `resolved`
   - Winner address populated
   - Random number from VRF
   - Payout amount

8. **Check the frontend:**
   - Go to http://localhost:3000/history
   - Your game should appear with complete details
   - No "using mock data" warnings

---

## Step 5: Security Verification 🔒

**Why:** Ensure unauthorized users cannot modify your database.

### Action Required:

1. **Test that anon key CANNOT write:**

   Create a test script:
   ```typescript
   // test-security.ts
   import { createClient } from '@supabase/supabase-js';

   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!  // Using anon key
   );

   // This should FAIL with RLS policy error
   const { data, error } = await supabase.from('games').insert({
     id: 999999,
     tx_hash: 'test',
     tier: 1,
     amount: '1000000000000000',
     creator_address: '0xTest',
     creator_choice: true,
     status: 'pending'
   });

   console.log('Error (expected):', error);
   console.log('Data (should be null):', data);
   ```

   Run:
   ```bash
   pnpm tsx test-security.ts
   ```

   Expected: **Error saying "new row violates row-level security policy"**

2. **Verify audit log is tracking changes:**
   ```sql
   SELECT table_name, operation, created_at
   FROM audit_log
   ORDER BY created_at DESC
   LIMIT 20;
   ```

   Should show all INSERT/UPDATE operations from indexer.

3. **Check monitoring views:**
   ```sql
   -- Indexer health
   SELECT * FROM indexer_health;

   -- Game metrics
   SELECT * FROM game_processing_metrics;
   ```

---

## Step 6: Performance Testing 📊

**Why:** Ensure the system can handle load and doesn't have bottlenecks.

### Action Required:

1. **Check database indexes:**
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'games';
   ```

   Should show indexes on:
   - `id` (primary key)
   - `status`
   - `creator_address`
   - `joiner_address`

2. **Monitor indexer performance:**

   In indexer logs, check:
   - Events processing < 1 second
   - No rate limit errors
   - Health check responding < 100ms

3. **Test query performance:**
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM active_games
   WHERE status = 'pending'
   ORDER BY created_at DESC;
   ```

   Execution time should be < 10ms

---

## Step 7: Deployment Preparation 🚀

**Why:** Get ready to deploy to production infrastructure.

### Action Required:

1. **Create production environment file:**
   ```bash
   cp .env.local .env.production
   ```

   Update for production:
   ```bash
   NODE_ENV=production
   NEXT_PUBLIC_CHAIN_ID=137  # Polygon mainnet
   NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_POLYGON=0x...  # Deploy to mainnet first
   POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
   ```

2. **Review deployment guide:**
   - Read `PRODUCTION_DEPLOY.md`
   - Choose deployment platform (Vercel, VPS, Docker)
   - Set up monitoring (UptimeRobot, Sentry)

3. **Set up alerting:**
   - Configure health check monitoring
   - Set up Slack/email alerts
   - Test alert flow

---

## Checklist Summary

- [ ] **Service role key configured** in `.env.local`
- [ ] **Verification script passes** all checks
- [ ] **All 4 migrations run** in Supabase
- [ ] **RLS policies active** and verified
- [ ] **Indexer running** and syncing events
- [ ] **Health check responding** at `:3001/health`
- [ ] **Full game lifecycle tested** (create → join → resolve)
- [ ] **Database syncing** all events correctly
- [ ] **Security tested** (anon key cannot write)
- [ ] **Audit log tracking** all changes
- [ ] **Performance acceptable** (queries < 10ms)
- [ ] **Monitoring views working**
- [ ] **Production environment prepared**

---

## Next Steps After Checklist Complete

1. **Deploy smart contract to Polygon mainnet**
2. **Deploy frontend to Vercel**
3. **Deploy indexer to VPS/Docker**
4. **Set up production monitoring**
5. **Test with real funds** (small amounts first!)
6. **Launch! 🎉**

---

## Support

If you encounter issues:

1. Check the verification script: `pnpm tsx scripts/verify-production-setup.ts`
2. Review indexer logs for errors
3. Check Supabase logs in dashboard
4. Verify health check endpoint
5. Review `PRODUCTION_DEPLOY.md` for troubleshooting

---

**Last Updated:** 2025-12-23
**Status:** Ready for Step 1 (Configure service role key)
