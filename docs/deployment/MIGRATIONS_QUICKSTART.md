# 🚀 Database Migrations - Quick Start

**Two ways to run migrations: Local Review → Supabase Execution**

---

## Option 1: View Migrations Locally (Recommended First Step)

This lets you review all the SQL before running it:

```bash
# Show all migration SQL in your terminal
pnpm migrations:show
```

**What it does:**
- ✅ Reads all migration files
- ✅ Displays SQL in order
- ✅ No service role key needed
- ✅ Safe to run anytime

**Output:** All 4 migrations printed to terminal for review

---

## Option 2: Copy to Supabase (Execute Migrations)

### Step 1: Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/editor

### Step 2: Run Each Migration

Copy & paste each migration SQL and click **"Run"**:

#### ✅ Migration 1: Initial Schema
- Creates `tiers` table
- Creates `_migrations` tracking table
- **Status:** Ready to run

#### ✅ Migration 2: Games Table
- Creates `games` table
- Adds indexes for performance
- Enables RLS (Row Level Security)
- **Status:** Ready to run

#### ✅ Migration 3: Indexer State
- Creates `indexer_state` table
- Tracks blockchain sync progress
- **Status:** Ready to run

#### ✅ Migration 4: Security Policies
- Creates audit logging
- Sets up RLS policies
- Creates monitoring views
- **Status:** Ready to run

---

## Quick Commands

```bash
# 1. View all migrations (NO service key needed)
pnpm migrations:show

# 2. Print migrations (requires service key)
pnpm migrations:print

# 3. Auto-run migrations (requires service key)
pnpm migrations:run

# 4. Verify after running
pnpm tsx scripts/verify-production-setup.ts
```

---

## Current Status

✅ Your `.env.local` has:
- NEXT_PUBLIC_SUPABASE_URL: `https://dkthmzaumugpuhnodpgy.supabase.co`
- NEXT_PUBLIC_SUPABASE_ANON_KEY: ✓ (set)

⚠️ Need to add:
- SUPABASE_SERVICE_ROLE_KEY: (get from Supabase dashboard)

**Get service key from:**
https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/settings/api

Look for: **"service_role"** key (NOT the anon key)

---

## Recommended Workflow

### 1. Review Locally First

```bash
# See what will be executed
pnpm migrations:show > migrations-review.sql

# Review the file
cat migrations-review.sql
```

### 2. Execute in Supabase

1. Open Supabase SQL Editor
2. Copy migration 1 SQL
3. Paste and click "Run"
4. Verify success
5. Repeat for migrations 2, 3, 4

### 3. Verify Setup

```bash
# Update .env.local with service role key first
# Then run verification

pnpm tsx scripts/verify-production-setup.ts
```

---

## After Migrations

### Initialize Tiers (Optional - can be done by indexer)

```sql
INSERT INTO tiers (id, amount, amount_usd, win_amount, win_amount_usd, enabled) VALUES
  (0, '1000000000000000', 5, '9500000000000000', 9.50, true),
  (1, '2000000000000000', 10, '19000000000000000', 19.00, true),
  (2, '5000000000000000', 25, '47500000000000000', 47.50, true),
  (3, '10000000000000000', 50, '95000000000000000', 95.00, true),
  (4, '20000000000000000', 100, '190000000000000000', 190.00, true);
```

### Start Production Indexer

```bash
pnpm indexer:prod
```

---

## Troubleshooting

### "Service role key invalid"
- Make sure you copied the `service_role` key (NOT `anon` key)
- Key should start with `eyJ...`

### "Table already exists"
- Some migrations may have run
- Check: `SELECT * FROM _migrations;`
- Skip already-completed migrations

### Want to start fresh?
```sql
-- WARNING: Deletes all data!
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS indexer_state CASCADE;
DROP TABLE IF EXISTS tiers CASCADE;
DROP TABLE IF EXISTS _migrations CASCADE;
```

---

## Summary

**Local:** `pnpm migrations:show` → Review SQL
**Supabase:** Copy & paste → Execute
**Verify:** `pnpm tsx scripts/verify-production-setup.ts`

✅ Ready to migrate! 🚀
