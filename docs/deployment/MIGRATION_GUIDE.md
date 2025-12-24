# Database Migration Guide

This guide explains how to run database migrations both locally and in production.

---

## Quick Start

### Option 1: Print Migrations (Recommended for First Time)

This prints all migration SQL so you can review before running:

```bash
pnpm migrations:print
```

Copy the output and run it in Supabase SQL Editor.

### Option 2: Direct Execution (If You Have Service Role Key)

```bash
pnpm migrations:run
```

**Note:** This requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

---

## Step-by-Step Instructions

### 1. Get Your Service Role Key

1. Go to: https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/settings/api
2. Scroll to **"Project API keys"**
3. Find the **`service_role`** key (NOT the anon key)
4. Click the eye icon to reveal it
5. Copy the full key (starts with `eyJ...`)

### 2. Update .env.local

```bash
# Open .env.local and update this line:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Your actual key
```

**⚠️ CRITICAL:** This is your admin key. Never commit it to git!

### 3. Run Migrations

#### Method A: Print & Copy (Safest)

```bash
# Print all migration SQL
pnpm migrations:print

# This will output all SQL to your terminal
# Copy and paste into Supabase SQL Editor
```

#### Method B: Direct Execution

```bash
# Run migrations automatically
pnpm migrations:run
```

---

## Manual Execution in Supabase

If automatic execution doesn't work, run manually:

### 1. Open Supabase SQL Editor

https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/editor

### 2. Run Migrations in Order

Copy and paste each file's contents, then click **"Run"**:

#### Migration 1: Initial Schema
```bash
# File: supabase/migrations/001_initial_schema.sql
# Creates: tiers table, _migrations table
```

**What it does:**
- Creates `tiers` table for bet tiers
- Creates `_migrations` table to track migrations
- Records this migration

**Verification:**
```sql
SELECT * FROM _migrations;
-- Should show: version 1, filename 001_initial_schema.sql

SELECT * FROM tiers;
-- Should be empty (will be populated later)
```

#### Migration 2: Games Table
```bash
# File: supabase/migrations/002_games_table.sql
# Creates: games table with indexes
```

**What it does:**
- Creates `games` table for all coinflip games
- Adds indexes for performance
- Sets up composite indexes

**Verification:**
```sql
SELECT * FROM games;
-- Should be empty (no games yet)

-- Check indexes exist
SELECT indexname FROM pg_indexes
WHERE tablename = 'games';
```

#### Migration 3: Indexer State
```bash
# File: supabase/migrations/003_indexer_state.sql
# Creates: indexer_state table
```

**What it does:**
- Creates `indexer_state` table
- Tracks last processed blockchain block
- Used by production indexer

**Verification:**
```sql
SELECT * FROM indexer_state;
-- Should be empty (indexer will populate)
```

#### Migration 4: Security Policies
```bash
# File: supabase/migrations/004_secure_rls_policies.sql
# Creates: RLS policies, audit log, monitoring views
```

**What it does:**
- Enables Row Level Security (RLS)
- Creates security policies
- Sets up audit logging
- Creates monitoring views

**Verification:**
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('games', 'tiers', 'indexer_state');
-- All should show rowsecurity = true

-- Check policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
-- Should show multiple policies

-- Check audit log exists
SELECT * FROM audit_log LIMIT 1;

-- Check monitoring views
SELECT * FROM indexer_health;
SELECT * FROM game_processing_metrics;
```

---

## Verification Checklist

After running all migrations:

### 1. Check Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';
```

**Expected tables:**
- `tiers`
- `games`
- `indexer_state`
- `_migrations`
- `audit_log`

### 2. Check RLS is Enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('games', 'tiers', 'indexer_state', 'audit_log');
```

**Expected:** All should have `rowsecurity = true`

### 3. Check Policies Exist

```sql
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public';
```

**Expected:** 8+ policies

### 4. Check Migrations Recorded

```sql
SELECT * FROM _migrations ORDER BY version;
```

**Expected:** 4 rows (one for each migration)

### 5. Check Views Exist

```sql
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public';
```

**Expected views:**
- `indexer_health`
- `game_processing_metrics`
- `api_usage_stats`

---

## Troubleshooting

### Error: "Service role key invalid"

**Solution:** Make sure you copied the `service_role` key, not the `anon` key.

```bash
# The key should start with: eyJh...
# It should be much longer than the anon key
```

### Error: "Table already exists"

**Solution:** Some migrations may have run partially. Check what exists:

```sql
-- Check what tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Check migration history
SELECT * FROM _migrations;
```

Then run only the migrations that haven't completed.

### Error: "Permission denied"

**Solution:** Make sure you're using the service role key, not the anon key.

```sql
-- Test your permissions
SELECT current_user, session_user;
```

### Error: "Function does not exist"

**Solution:** Some functions may not exist yet. Run migrations in order:
1. First: 001_initial_schema.sql
2. Then: 002_games_table.sql
3. Then: 003_indexer_state.sql
4. Finally: 004_secure_rls_policies.sql

---

## Rolling Back Migrations

If you need to undo migrations:

### Drop All Tables (Fresh Start)

```sql
-- WARNING: This deletes ALL data!
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS indexer_state CASCADE;
DROP TABLE IF EXISTS tiers CASCADE;
DROP TABLE IF EXISTS _migrations CASCADE;

-- Drop views
DROP VIEW IF EXISTS indexer_health;
DROP VIEW IF EXISTS game_processing_metrics;
DROP VIEW IF EXISTS api_usage_stats;

-- Drop functions
DROP FUNCTION IF EXISTS audit_games_changes();
DROP FUNCTION IF EXISTS validate_game_tier_amount();
```

Then re-run all migrations from the beginning.

---

## After Migrations

### Initialize Tiers

After migrations are complete, you need to initialize the tier data:

```bash
# This will be done by the indexer automatically
# Or you can insert manually:
```

```sql
INSERT INTO tiers (id, amount, amount_usd, win_amount, win_amount_usd, enabled) VALUES
  (0, '1000000000000000', 5, '9500000000000000', 9.50, true),      -- $5
  (1, '2000000000000000', 10, '19000000000000000', 19.00, true),   -- $10
  (2, '5000000000000000', 25, '47500000000000000', 47.50, true),   -- $25
  (3, '10000000000000000', 50, '95000000000000000', 95.00, true),  -- $50
  (4, '20000000000000000', 100, '190000000000000000', 190.00, true); -- $100
```

### Start the Indexer

```bash
# Start production indexer
pnpm indexer:prod
```

The indexer will:
- Sync blockchain events
- Populate the games table
- Update indexer_state
- Create audit log entries

---

## Production Deployment

For production deployment:

1. ✅ Run all migrations in Supabase SQL Editor
2. ✅ Verify all tables and policies exist
3. ✅ Update `.env.local` with service role key
4. ✅ Run `pnpm tsx scripts/verify-production-setup.ts`
5. ✅ Start production indexer
6. ✅ Monitor indexer health
7. ✅ Deploy frontend to Vercel

---

## Monitoring

After migrations, monitor using these queries:

### Check Indexer Health
```sql
SELECT * FROM indexer_health;
```

### Check Game Stats
```sql
SELECT * FROM game_processing_metrics;
```

### Check Recent Audit Logs
```sql
SELECT * FROM audit_log
ORDER BY created_at DESC
LIMIT 10;
```

### Check API Usage
```sql
SELECT * FROM api_usage_stats
ORDER BY hour DESC
LIMIT 24;
```

---

## Security Notes

⚠️ **IMPORTANT:**

1. **Never commit service role key** to git
2. **Service role key = admin access** - guard it carefully
3. **Rotate keys quarterly** for security
4. **Monitor audit logs** for suspicious activity
5. **RLS policies protect data** - don't disable them

---

## Need Help?

- **Documentation:** See `SECURITY.md` and `SECURITY_AUDIT.md`
- **Verification:** Run `pnpm tsx scripts/verify-production-setup.ts`
- **Support:** Check migration SQL for comments

---

**Status:** Ready to run migrations! 🚀
