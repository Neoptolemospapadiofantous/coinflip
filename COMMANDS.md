# CoinFlip - Development Commands

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

## Database (Supabase)

```bash
# Push migrations to remote database
npx supabase db push

# Pull remote database schema
npx supabase db pull

# Create a new migration
npx supabase migration new <migration_name>

# List migrations
npx supabase migration list

# Dump database schema
npx supabase db dump --schema public

# Reset local database (destructive!)
npx supabase db reset
```

## Smart Contracts (Hardhat)

```bash
# Compile contracts
npx hardhat compile

# Run contract tests
npx hardhat test

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.ts --network sepolia

# Deploy to Polygon mainnet
npx hardhat run scripts/deploy.ts --network polygon

# Initialize tiers after deployment
npx hardhat run scripts/initialize-tiers.ts --network sepolia
```

## Event Indexer

```bash
# Run indexer in development mode
npm run indexer:dev

# Run indexer in production mode
npm run indexer:prod

# Run indexer once (single pass)
npx ts-node scripts/event-indexer.ts
```

## Game Maintenance Scripts

```bash
# Sync database with blockchain state (fixes stale games)
npx tsx scripts/sync-stale-games.ts

# Check for expired games (dry run - doesn't cancel)
npx tsx scripts/cancel-expired-games.ts --dry-run

# Cancel all expired games
npx tsx scripts/cancel-expired-games.ts

# Cancel a specific game by ID
npx tsx scripts/cancel-expired-games.ts --game-id=0
```

## Type Checking & Linting

```bash
# TypeScript type check
npx tsc --noEmit

# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run contract tests only
npx hardhat test

# Run specific test file
npx hardhat test tests/contracts/CoinFlip.test.ts
```

## Docker

```bash
# Start local Postgres database
docker-compose up -d postgres

# Stop all containers
docker-compose down

# View logs
docker-compose logs -f
```

## Process Management

```bash
# Stop all Node.js processes (development)
pkill -f "next-server"
pkill -f "node dist/"

# Check running processes
ps aux | grep -E "(next|node)" | grep -v grep

# Kill process on specific port (e.g., 3000)
lsof -ti:3000 | xargs kill -9
```

## Environment Setup

Required environment variables in `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Blockchain RPC
NEXT_PUBLIC_ALCHEMY_API_KEY=
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=

# Contract Addresses
NEXT_PUBLIC_COINFLIP_ADDRESS_SEPOLIA=
NEXT_PUBLIC_COINFLIP_ADDRESS_POLYGON=
```

## Useful URLs

- **Local Dev**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Sepolia Etherscan**: https://sepolia.etherscan.io
- **Polygonscan**: https://polygonscan.com

---

## Recent Changes (Realtime Optimization)

The following changes were made to optimize the realtime experience:

### Files Modified:
1. `lib/queries/cache-config.ts` - Disabled redundant polling
2. `hooks/usePendingTransactions.ts` - Removed redundant polling, realtime handles updates
3. `hooks/useCreatedGameTracking.ts` - Reduced timeout from 30s to 15s
4. `lib/constants.ts` - Updated GAME_SEARCH_TIMEOUT_MS

### Migration Added:
- `supabase/migrations/036_realtime_performance_indexes.sql`

### To Apply Migration:
```bash
npx supabase db push
```

### New Database Indexes:
- `idx_games_tx_hash_active` - Fast game discovery
- `idx_games_tx_hash` - Full tx_hash lookups
- `idx_games_creator_active` - Creator's active games
- `idx_games_joiner_active` - Joiner's active games
- `idx_activity_feed_created` - Activity feed queries
