# Database Migrations Guide

This guide explains how to manage database migrations for the CoinFlip project using Supabase PostgreSQL.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Migration File Structure](#migration-file-structure)
- [Running Migrations](#running-migrations)
- [Creating New Migrations](#creating-new-migrations)
- [Migration Tracking](#migration-tracking)
- [Troubleshooting](#troubleshooting)

## Overview

The CoinFlip project uses a migration-based approach to manage database schema changes. Migrations are SQL files that are executed in order to build and update the database schema.

### Why Migrations?

- **Version Control**: Track database schema changes over time
- **Reproducibility**: Easily replicate the database structure across environments
- **Safety**: Review schema changes before applying them
- **Documentation**: Migration files serve as documentation of schema evolution

### Current Migrations

The project includes 5 initial migrations that set up the complete database:

1. **20250101000001_create_tables.sql** - Creates all core tables
2. **20250101000002_create_indexes.sql** - Adds performance indexes
3. **20250101000003_enable_rls.sql** - Enables Row Level Security
4. **20250101000004_seed_data.sql** - Seeds initial tier data
5. **20250101000005_create_functions.sql** - Creates helper functions and triggers

## Quick Start

### Prerequisites

1. Supabase project created
2. Environment variables configured in `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### Run Migration Script

```bash
pnpm migrate
```

This will:
- Load all migration files from `supabase/migrations/`
- Check which migrations have already been executed
- Display pending migrations
- Provide SQL to copy-paste into Supabase SQL Editor

## Migration File Structure

### Naming Convention

Migration files follow this naming pattern:

```
YYYYMMDDHHMMSS_description.sql
```

Examples:
- `20250101000001_create_tables.sql`
- `20250101000002_create_indexes.sql`
- `20250315120000_add_user_roles.sql`

**Important**: Files are executed in alphabetical order, so the timestamp prefix ensures chronological execution.

### File Template

Each migration file should include:

```sql
-- Migration: [Title]
-- Description: [What this migration does]
-- Author: [Your name or team]
-- Date: [YYYY-MM-DD]

-- ===========================================================================
-- [SECTION NAME]
-- ===========================================================================

-- Your SQL statements here

-- ===========================================================================
-- SUCCESS MESSAGE
-- ===========================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully';
  RAISE NOTICE '   - Detail about what was changed';
END $$;
```

## Running Migrations

### Option 1: Using the Migration Script (Recommended)

1. Run the migration script:
   ```bash
   pnpm migrate
   ```

2. The script will output pending migrations and SQL to execute

3. Copy the SQL output

4. Go to your Supabase Dashboard → SQL Editor

5. Paste and execute the SQL

6. Verify the migration with:
   ```bash
   pnpm verify-db
   ```

### Option 2: Manual Execution

1. Navigate to your Supabase Dashboard

2. Go to: **SQL Editor**

3. Create a new query

4. Copy the contents of each migration file in order

5. Execute each migration

6. Verify with `pnpm verify-db`

### First-Time Setup

For a fresh database, execute all migrations in order:

```bash
# 1. Run migration script to see pending migrations
pnpm migrate

# 2. Copy the SQL output from the terminal

# 3. Execute in Supabase SQL Editor

# 4. Verify everything is set up correctly
pnpm verify-db
```

## Creating New Migrations

### Step 1: Generate Migration File

Create a new file in `supabase/migrations/` with the correct naming:

```bash
# Example: Adding a new column
touch supabase/migrations/20250315120000_add_user_preferences.sql
```

### Step 2: Write the Migration

```sql
-- Migration: Add user preferences
-- Description: Adds preferences column to store user settings
-- Author: CoinFlip Team
-- Date: 2025-03-15

-- ===========================================================================
-- ALTER TABLES
-- ===========================================================================

ALTER TABLE player_stats
ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN player_stats.preferences IS 'User preferences stored as JSON';

-- ===========================================================================
-- CREATE INDEX
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_player_stats_preferences
  ON player_stats USING GIN (preferences);

-- ===========================================================================
-- SUCCESS
-- ===========================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ User preferences column added successfully';
END $$;
```

### Step 3: Test the Migration

1. Run `pnpm migrate` to see if it's detected
2. Execute the SQL in Supabase
3. Verify with `pnpm verify-db`

### Best Practices

1. **Idempotent Migrations**: Use `IF NOT EXISTS` or `IF EXISTS` clauses
   ```sql
   CREATE TABLE IF NOT EXISTS my_table (...);
   ALTER TABLE my_table ADD COLUMN IF NOT EXISTS my_column TEXT;
   ```

2. **One Purpose Per Migration**: Each migration should have a single, clear purpose

3. **Include Rollback Instructions**: Add comments explaining how to reverse the migration
   ```sql
   -- Rollback: DROP TABLE my_table;
   ```

4. **Add Comments**: Use PostgreSQL comments for documentation
   ```sql
   COMMENT ON TABLE my_table IS 'Stores user preferences';
   COMMENT ON COLUMN my_table.my_column IS 'User display name';
   ```

5. **Test Before Committing**: Always test migrations on a development database first

## Migration Tracking

### How It Works

The migration system uses a `_migrations` table to track executed migrations:

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  version TEXT PRIMARY KEY,           -- Migration version (timestamp prefix)
  filename TEXT NOT NULL,             -- Full filename
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Checking Migration Status

Run the migration script to see status:

```bash
pnpm migrate
```

Output example:
```
Found 5 migration files
2 migrations already executed

3 pending migrations:
  - 20250101000003_enable_rls.sql
  - 20250101000004_seed_data.sql
  - 20250101000005_create_functions.sql
```

### Manual Status Check

Query the migrations table in Supabase SQL Editor:

```sql
SELECT * FROM _migrations ORDER BY version;
```

## Troubleshooting

### Migration Script Can't Connect

**Error**: "Supabase credentials not found in environment variables"

**Solution**:
1. Check `.env.local` exists and has correct values
2. Restart your terminal/IDE to reload environment variables
3. Verify credentials in Supabase Dashboard → Settings → API

### Table Already Exists

**Error**: "relation already exists"

**Cause**: Migration was partially executed or run twice

**Solutions**:
1. Use `CREATE TABLE IF NOT EXISTS` in migrations
2. Manually insert the migration record:
   ```sql
   INSERT INTO _migrations (version, filename)
   VALUES ('20250101000001', '20250101000001_create_tables.sql');
   ```

### RLS Policies Prevent Access

**Error**: "new row violates row-level security policy"

**Cause**: Your user doesn't have permissions

**Solutions**:
1. Use the service_role key for backend operations
2. Update RLS policies in migration 003
3. Use `set_current_user()` function before queries:
   ```typescript
   await supabase.rpc('set_current_user', { user_address: '0x...' });
   ```

### Migration File Not Detected

**Cause**: Incorrect filename or location

**Solutions**:
1. Ensure file is in `supabase/migrations/` directory
2. Verify filename starts with timestamp: `YYYYMMDDHHMMSS_`
3. Ensure file ends with `.sql`
4. Check file is not in a subdirectory

### Function or Trigger Errors

**Error**: "function does not exist" or "trigger does not exist"

**Cause**: Migrations executed out of order

**Solution**:
1. Drop the problematic objects
2. Re-run migrations in correct order
3. Always execute migrations sequentially by filename

### Cannot Execute DDL via Client

**Note**: This is expected behavior!

The Supabase JavaScript client cannot execute DDL statements (CREATE, ALTER, DROP) for security reasons.

**Correct Approach**:
1. Run `pnpm migrate` to see pending migrations
2. Copy the SQL output
3. Execute in Supabase SQL Editor manually

### Verifying Migration Success

After running migrations, verify with:

```bash
pnpm verify-db
```

This checks:
- Database connection
- All required tables exist
- Tables have correct structure
- Seed data is present
- Realtime is enabled

## Advanced Topics

### Environment-Specific Migrations

For different environments (dev, staging, production):

```sql
-- Only run in production
DO $$
BEGIN
  IF current_database() = 'production_db' THEN
    -- Production-only changes
  END IF;
END $$;
```

### Data Migrations

For migrating existing data:

```sql
-- Migration: Migrate old data format to new format
UPDATE player_stats
SET preferences = jsonb_build_object(
  'theme', 'dark',
  'notifications', true
)
WHERE preferences IS NULL;
```

### Conditional Migrations

Skip sections if already applied:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'player_stats' AND column_name = 'preferences'
  ) THEN
    ALTER TABLE player_stats ADD COLUMN preferences JSONB;
  END IF;
END $$;
```

## Next Steps

After running migrations:

1. **Verify Database**:
   ```bash
   pnpm verify-db
   ```

2. **Start Development**:
   ```bash
   pnpm dev
   ```

3. **Monitor Realtime**:
   - Check Supabase Dashboard → Database → Replication
   - Ensure Realtime is enabled for required tables

4. **Test the Application**:
   - Visit http://localhost:3000
   - Check that tiers load correctly
   - Verify mock data toggle works

## Related Documentation

- [DATABASE_VERIFICATION.md](./DATABASE_VERIFICATION.md) - Database health checks
- [SETUP_SUPABASE.md](./SETUP_SUPABASE.md) - Initial Supabase setup
- [README.md](./README.md) - Project overview

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify environment variables are correct
3. Review Supabase Dashboard → Logs for errors
4. Check PostgreSQL error messages in SQL Editor
5. Ensure migrations are executed in correct order

---

## Real Coinflip Testing Requirements

### Overview

The database migrations provide the backend infrastructure, but for a REAL coinflip test with actual blockchain transactions, you need:

1. **Smart Contract Deployed** - The CoinFlip.sol contract on Mumbai testnet
2. **Chainlink VRF Configured** - For provably fair randomness
3. **Contract Address Updated** - In your environment variables
4. **Test Funds** - Mumbai MATIC for gas fees
5. **LINK Tokens** - For VRF requests

### Current Status

✅ **Completed:**
- Database schema migrated
- Frontend UI implemented (tier selection, game flow)
- Contract ABIs defined in `lib/contracts/abi.ts`
- Wagmi hooks configured in `hooks/useContract.ts`
- Database verification script

❌ **Still Needed for Real Testing:**
- Smart contract deployment (see below)
- Chainlink VRF subscription
- Contract address configuration
- End-to-end testing

---

## Smart Contract Deployment Checklist

### Step 1: Write the Smart Contract

The contract specification is in `doc/01_smart_contract_architecture.md`. You need to:

1. **Create the contract file**:
   ```bash
   mkdir -p contracts
   touch contracts/CoinFlip.sol
   ```

2. **Implement core features** (from doc/01):
   - Game creation with tier selection
   - Player matching (join game)
   - Chainlink VRF integration for randomness
   - Automatic winner payout
   - Cancel timeout games
   - Emergency pause functionality

3. **Install Hardhat/Foundry** for contract development:
   ```bash
   # Option 1: Hardhat
   pnpm add -D hardhat @nomicfoundation/hardhat-toolbox

   # Option 2: Foundry (recommended for gas optimization)
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

### Step 2: Set Up Chainlink VRF Subscription

Before deploying, you need a VRF subscription:

1. **Get Mumbai MATIC**:
   - Visit [Polygon Faucet](https://faucet.polygon.technology/)
   - Request testnet MATIC to your wallet
   - Wait for confirmation

2. **Get Mumbai LINK tokens**:
   - Visit [Chainlink Faucet](https://faucets.chain.link/mumbai)
   - Request testnet LINK tokens
   - Or swap MATIC for LINK on [Uniswap Mumbai](https://app.uniswap.org)

3. **Create VRF Subscription**:
   - Go to [Chainlink VRF](https://vrf.chain.link/)
   - Connect your wallet (Mumbai network)
   - Click "Create Subscription"
   - Fund it with 5+ LINK tokens
   - Note your **Subscription ID**

4. **Get VRF Configuration**:
   ```
   Mumbai VRF Coordinator: 0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed
   Mumbai Key Hash: 0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f
   LINK Token (Mumbai): 0x326C977E6efc84E512bB9C30f76E30c160eD06FB
   ```

### Step 3: Deploy the Contract

1. **Configure deployment script**:
   ```javascript
   // scripts/deploy.js (Hardhat)
   const subscriptionId = "YOUR_VRF_SUBSCRIPTION_ID";
   const vrfCoordinator = "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed";
   const keyHash = "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f";

   const CoinFlip = await ethers.deployContract("CoinFlip", [
     subscriptionId,
     vrfCoordinator,
     keyHash
   ]);

   await CoinFlip.waitForDeployment();
   console.log("CoinFlip deployed to:", await CoinFlip.getAddress());
   ```

2. **Deploy to Mumbai**:
   ```bash
   # Hardhat
   npx hardhat run scripts/deploy.js --network mumbai

   # Foundry
   forge create --rpc-url $MUMBAI_RPC_URL \
     --private-key $PRIVATE_KEY \
     --constructor-args $SUBSCRIPTION_ID $VRF_COORDINATOR $KEY_HASH \
     contracts/CoinFlip.sol:CoinFlip
   ```

3. **Add contract as VRF consumer**:
   - Go back to [Chainlink VRF](https://vrf.chain.link/)
   - Open your subscription
   - Click "Add Consumer"
   - Enter your deployed contract address
   - Confirm transaction

### Step 4: Update Environment Variables

1. **Update `.env.local`**:
   ```bash
   # Replace this line:
   NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_MUMBAI=0x...

   # With your actual deployed address:
   NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_MUMBAI=0xYourDeployedContractAddress
   ```

2. **Verify the address is loaded**:
   ```bash
   pnpm dev
   # Check browser console - should show real address, not 0x000...
   ```

### Step 5: Initialize Contract Tiers

After deployment, you need to initialize the bet tiers:

1. **Using Hardhat console**:
   ```javascript
   const contract = await ethers.getContractAt("CoinFlip", "YOUR_CONTRACT_ADDRESS");

   // Set tier amounts (in wei)
   await contract.setTier(0, ethers.parseEther("0.001")); // ~$5 worth of MATIC
   await contract.setTier(1, ethers.parseEther("0.002")); // ~$10
   await contract.setTier(2, ethers.parseEther("0.005")); // ~$25
   await contract.setTier(3, ethers.parseEther("0.010")); // ~$50
   await contract.setTier(4, ethers.parseEther("0.020")); // ~$100
   ```

2. **Or using Polygonscan**:
   - Go to [Mumbai Polygonscan](https://mumbai.polygonscan.com)
   - Search for your contract address
   - Go to "Contract" → "Write Contract"
   - Connect your wallet
   - Call `setTier()` for each tier

---

## Testing the Real Coinflip

### End-to-End Test Checklist

Once everything is deployed:

**Test 1: Single Player Flow**
- [ ] Connect wallet to app (Mumbai network)
- [ ] Select a tier (e.g., Tier 0 - $5)
- [ ] Choose Heads or Tails
- [ ] Click "Create Game"
- [ ] Approve transaction in MetaMask
- [ ] Verify `GameCreated` event in Polygonscan
- [ ] Check database - should see new game in `games` table
- [ ] Game should show "Waiting for opponent"

**Test 2: Two Player Complete Game**
- [ ] Create game with Player 1
- [ ] Open app in incognito/different browser
- [ ] Connect Player 2 wallet
- [ ] Player 2 joins the same game
- [ ] Verify `GameJoined` event
- [ ] Contract requests VRF randomness
- [ ] Wait for VRF callback (~1-2 minutes)
- [ ] Verify `GameResolved` event
- [ ] Winner receives payout automatically
- [ ] Check database - game status updated to "resolved"
- [ ] Verify winner and result in database

**Test 3: Cancel Game**
- [ ] Create game with Player 1
- [ ] Wait for timeout period
- [ ] Call `cancelGame()` function
- [ ] Verify refund received
- [ ] Check database - game status "cancelled"

**Test 4: Real-time Updates**
- [ ] Create game in one browser
- [ ] Open game list in another browser
- [ ] Verify game appears in real-time
- [ ] Join game from second browser
- [ ] Verify both browsers update with result

### Monitoring Tools

**Blockchain:**
- [Mumbai Polygonscan](https://mumbai.polygonscan.com) - View transactions
- [Chainlink VRF Dashboard](https://vrf.chain.link/) - Monitor VRF requests

**Database:**
- Supabase Dashboard → Table Editor
- Supabase Dashboard → Realtime → Inspector

**Frontend:**
- Browser DevTools → Console
- Browser DevTools → Network tab
- React Query DevTools (if enabled)

### Common Issues During Testing

**"Insufficient funds" error:**
- Get more Mumbai MATIC from faucet
- Check you have enough for gas + bet amount

**Transaction pending forever:**
- Mumbai testnet can be slow
- Check Polygonscan for transaction status
- May need to speed up with higher gas

**VRF not fulfilling:**
- Verify LINK balance in subscription
- Check contract is added as consumer
- Wait up to 5 minutes for testnet

**Game not appearing in database:**
- Verify event indexer is running (see below)
- Check Supabase logs for errors
- Manually query: `SELECT * FROM games ORDER BY created_at DESC`

---

## Event Indexer Setup

For the database to sync with blockchain events, you need an event indexer:

### Option 1: Simple Script (Development)

Create `scripts/index-events.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { polygonMumbai } from 'viem/chains';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Need service role for inserts
);

const publicClient = createPublicClient({
  chain: polygonMumbai,
  transport: http()
});

async function indexGameCreated() {
  const logs = await publicClient.getLogs({
    address: process.env.NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_MUMBAI as `0x${string}`,
    event: parseAbiItem('event GameCreated(uint256 indexed gameId, address indexed creator, uint8 tier, uint256 amount, bool choice)'),
    fromBlock: 'earliest'
  });

  for (const log of logs) {
    // Insert into database
    await supabase.from('games').upsert({
      game_id: log.args.gameId?.toString(),
      creator_address: log.args.creator,
      tier_id: log.args.tier,
      amount: log.args.amount?.toString(),
      creator_choice: log.args.choice,
      status: 'waiting',
      created_at: new Date().toISOString()
    });
  }
}

// Run continuously
setInterval(indexGameCreated, 10000); // Every 10 seconds
```

Run with:
```bash
pnpm tsx scripts/index-events.ts
```

### Option 2: The Graph (Production)

For production, use [The Graph](https://thegraph.com/) to index events reliably.

---

## Next Steps After Testing

Once you've successfully tested the coinflip:

1. **Optimize gas costs** - Review contract for gas savings
2. **Security audit** - Get professional audit before mainnet
3. **Add more tests** - Unit tests, integration tests
4. **UI improvements** - Polish the user experience
5. **Deploy to Polygon mainnet** - Only after thorough testing
6. **Set up monitoring** - Production monitoring and alerts

See `doc/04_security_testing_audit.md` for security best practices.
