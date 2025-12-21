# Database Verification System

The CoinFlip app includes a comprehensive database verification system to check if Supabase is configured correctly before running in production.

## Quick Start

### Option 1: Command Line (Recommended for CI/CD)

```bash
# Run database health check
pnpm verify-db

# Or use the alias
pnpm check-db
```

**Example Output:**
```
═══════════════════════════════════════════════════════════
  CoinFlip Database Verification
═══════════════════════════════════════════════════════════

🔍 Running database health check...
  Connection: ✅ Successfully connected to Supabase
  Tiers table: ✅ Table 'tiers' exists and is accessible
  Games table: ✅ Table 'games' exists and is accessible
  Queue table: ✅ Table 'queue' exists and is accessible
  Tiers data: ✅ Found 5 tiers configured
  Realtime: ✅ Realtime is enabled and working

📊 Overall Status: ✅ READY

═══════════════════════════════════════════════════════════
  ✅ DATABASE READY
═══════════════════════════════════════════════════════════
```

### Option 2: Web Interface (Visual)

Visit: **http://localhost:3000/admin/setup**

The setup page provides:
- Real-time health status
- Detailed error messages
- Visual status indicators
- Next steps guidance
- Refresh button to re-run checks

## What Gets Checked

### 1. Connection ✅
- Environment variables configured
- Valid Supabase URL and key
- Network connectivity
- Authentication working

### 2. Tables ✅
- `tiers` table exists
- `games` table exists
- `queue` table exists
- All tables accessible
- Row counts available

### 3. Data ✅
- Tiers table has 5 entries ($5, $10, $25, $50, $100)
- All tiers are enabled
- Amounts configured correctly

### 4. Realtime ✅
- Realtime subscriptions enabled
- Can connect to realtime channels
- Tables configured for realtime updates

## Using in CI/CD Pipelines

### GitHub Actions Example

```yaml
name: Database Health Check

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify-database:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install pnpm
        uses: pnpm/action-setup@v2

      - name: Install dependencies
        run: pnpm install

      - name: Verify Database
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: pnpm verify-db
```

### Vercel/Netlify Pre-Deploy Hook

Add to your deployment configuration:

```json
{
  "build": {
    "command": "pnpm verify-db && pnpm build"
  }
}
```

This ensures the database is properly configured before deploying.

## Exit Codes

The `verify-db` script uses standard exit codes:

- **0** - All checks passed, database ready
- **1** - One or more checks failed, setup required

Use in shell scripts:

```bash
#!/bin/bash

if pnpm verify-db; then
  echo "Database ready, starting app..."
  pnpm start
else
  echo "Database not configured, see SETUP_SUPABASE.md"
  exit 1
fi
```

## Integration with Your App

### Automatic Check on Startup

Add to your app initialization:

```typescript
// lib/startup.ts
import { quickHealthCheck } from '@/lib/dbHealthCheck';

export async function checkDatabaseOnStartup() {
  const isReady = await quickHealthCheck();

  if (!isReady) {
    console.warn('⚠️  Database not ready - using mock data');
    return false;
  }

  console.log('✅ Database ready - using real data');
  return true;
}
```

### Auto-Switch Between Mock and Real Data

```typescript
// hooks/useTiers.ts
const USE_MOCK_DATA = !(await quickHealthCheck());
```

## Error Handling

The verification system provides detailed error messages:

### Connection Errors

```
❌ CONNECTION:
   Status: ❌ Failed
   Message: Supabase connection failed: Invalid API key

⚠️  ACTION REQUIRED:
   1. Check your .env.local file:
      - NEXT_PUBLIC_SUPABASE_URL
      - NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Missing Tables

```
❌ TABLES:
   tiers: ❌ Table 'tiers' does not exist

⚠️  ACTION REQUIRED:
   2. Run the SQL schema in Supabase:
      See SETUP_SUPABASE.md for complete SQL
```

### Missing Data

```
❌ DATA:
   Tiers: ❌ Tiers table is empty - run the setup SQL

⚠️  ACTION REQUIRED:
   3. Insert tier data:
      Run the INSERT statements from SETUP_SUPABASE.md
```

### Realtime Not Enabled

```
❌ REALTIME:
   Status: ❌ Not enabled
   Message: Realtime connection timeout

⚠️  ACTION REQUIRED:
   4. Enable Realtime in Supabase:
      Dashboard → Database → Replication
      Enable for: tiers, games, queue
```

## Troubleshooting

### Script Hangs on "Running health check"

**Cause:** Network timeout or incorrect Supabase URL

**Fix:**
1. Check internet connection
2. Verify `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
3. Try accessing Supabase dashboard directly

### "Module not found" Error

**Cause:** Missing dependencies

**Fix:**
```bash
pnpm install
```

### Realtime Check Always Fails

**Cause:** Realtime not enabled in Supabase

**Fix:**
1. Go to Supabase Dashboard
2. Navigate to Database → Replication
3. Enable realtime for: `tiers`, `games`, `queue`

### Works Locally but Fails in CI

**Cause:** Environment variables not set in CI

**Fix:**
- Set `NEXT_PUBLIC_SUPABASE_URL` in CI secrets
- Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` in CI secrets

## Best Practices

### Before Deployment

```bash
# Always run before deploying
pnpm verify-db

# If passed, proceed with build
pnpm build

# If failed, fix issues first
```

### In Development

```bash
# Quick check during development
pnpm check-db

# Or use the web interface
# http://localhost:3000/admin/setup
```

### In Production

```bash
# Run as health check endpoint
# /api/health can call quickHealthCheck()
```

## API Reference

### `runDatabaseHealthCheck()`

Runs comprehensive health checks on all database components.

**Returns:** `Promise<DatabaseHealth>`

```typescript
{
  connection: { success: boolean, message: string },
  tables: {
    tiers: { success: boolean, message: string },
    games: { success: boolean, message: string },
    queue: { success: boolean, message: string }
  },
  data: {
    tiersCount: { success: boolean, message: string }
  },
  realtime: { success: boolean, message: string },
  overall: boolean
}
```

### `quickHealthCheck()`

Fast check - only connection and tiers table.

**Returns:** `Promise<boolean>`

```typescript
const isReady = await quickHealthCheck();
if (isReady) {
  // Use real data
} else {
  // Use mock data
}
```

## Next Steps

After all checks pass:

1. ✅ Switch to real data: `USE_MOCK_DATA = false` in `hooks/useTiers.ts`
2. ✅ Restart dev server: `pnpm dev`
3. ✅ Test tier selection on `/play` page
4. ✅ Verify data loads from Supabase (check network tab)

## Related Documentation

- **Setup Guide:** `SETUP_SUPABASE.md`
- **Database Schema:** `doc/03_backend_database_architecture.md`
- **Frontend Integration:** `doc/02_frontend_architecture.md`
