# Local Database Setup Guide

Run migrations locally first, then deploy to Supabase cloud when ready.

---

## 🐳 Local Setup with Docker

### Prerequisites

- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose installed (included with Docker Desktop)

### Quick Start

```bash
# 1. Install PostgreSQL client library
pnpm install

# 2. Start local PostgreSQL database
pnpm db:start

# 3. Wait for database to be ready (5-10 seconds)
# Check logs: pnpm db:logs

# 4. Run migrations locally
pnpm migrate:local

# 5. Verify tables were created
# (You can use any PostgreSQL client to connect)
```

---

## 📋 Step-by-Step Instructions

### Step 1: Start Local Database

```bash
pnpm db:start
```

**What it does:**
- Starts PostgreSQL 15 in Docker container
- Database: `coinflip`
- Username: `postgres`
- Password: `postgres`
- Port: `5432`

**Verify it's running:**
```bash
pnpm db:logs
```

You should see: `database system is ready to accept connections`

### Step 2: Run Migrations Locally

```bash
pnpm migrate:local
```

**What it does:**
- Connects to local PostgreSQL
- Runs all 4 migrations in order
- Creates tables: `tiers`, `games`, `indexer_state`, `_migrations`, `audit_log`
- Sets up indexes, triggers, and views

**Expected output:**
```
🚀 Running Migrations on Local Database...
📍 Database: coinflip
🔌 Connecting to local database...
✅ Connected!

📁 Found 4 migration files:
   - 001_initial_schema.sql
   - 002_games_table.sql
   - 003_indexer_state.sql
   - 004_secure_rls_policies.sql

⏳ Running: 001_initial_schema.sql...
   ✅ Success!

⏳ Running: 002_games_table.sql...
   ✅ Success!

⏳ Running: 003_indexer_state.sql...
   ✅ Success!

⏳ Running: 004_secure_rls_policies.sql...
   ✅ Success!

📊 Migration Summary:
   ✅ Successful: 4
   ❌ Failed: 0
   📝 Total: 4

✅ All migrations completed successfully!

🔍 Verifying database schema...

📋 Tables created:
   - _migrations
   - audit_log
   - games
   - indexer_state
   - tiers

👋 Disconnected from database
```

### Step 3: Connect to Local Database (Optional)

You can connect using any PostgreSQL client:

**Connection Details:**
```
Host: localhost
Port: 5432
Database: coinflip
Username: postgres
Password: postgres
```

**Using `psql` (if installed):**
```bash
psql -h localhost -U postgres -d coinflip
```

**Verify tables:**
```sql
\dt  -- List tables
SELECT * FROM _migrations;  -- Check migration history
SELECT * FROM tiers;  -- Check tiers table
```

---

## 🌩️ Deploy to Supabase Cloud

Once you've tested locally, deploy to cloud:

```bash
# Show migration SQL for Supabase
pnpm migrate:cloud
```

**What it does:**
- Prints all migration SQL
- Shows instructions for Supabase SQL Editor
- You copy & paste into Supabase

**Then:**
1. Go to: https://supabase.com/dashboard/project/dkthmzaumugpuhnodpgy/editor
2. Copy migration 1 SQL
3. Paste and click "Run"
4. Verify success
5. Repeat for migrations 2, 3, 4

---

## 🔧 Database Management Commands

```bash
# Start database
pnpm db:start

# Stop database
pnpm db:stop

# View logs
pnpm db:logs

# Run migrations locally
pnpm migrate:local

# Show SQL for cloud deployment
pnpm migrate:cloud

# View migration SQL (no execution)
pnpm migrations:show
```

---

## 🔄 Development Workflow

### Typical Flow

```bash
# 1. Start local database
pnpm db:start

# 2. Run migrations locally
pnpm migrate:local

# 3. Test your app locally
pnpm dev

# 4. When ready for cloud:
pnpm migrate:cloud
# Copy & paste into Supabase

# 5. Stop local database when done
pnpm db:stop
```

### Reset Local Database

If you need to start fresh:

```bash
# Stop database and remove data
pnpm db:stop

# Remove Docker volume
docker volume rm coinflip_postgres_data

# Start fresh
pnpm db:start
pnpm migrate:local
```

---

## 🧪 Testing Migrations

### Before Deploying to Cloud

1. **Test locally first:**
   ```bash
   pnpm db:start
   pnpm migrate:local
   ```

2. **Verify schema:**
   ```sql
   -- Connect with psql or any client
   \dt  -- List tables
   SELECT * FROM _migrations;  -- Check migrations ran
   ```

3. **Test data insertion:**
   ```sql
   INSERT INTO tiers (id, amount, amount_usd, win_amount, win_amount_usd)
   VALUES (0, '1000000000000000', 5, '9500000000000000', 9.50);

   SELECT * FROM tiers;
   ```

4. **If all looks good:**
   ```bash
   pnpm migrate:cloud
   # Deploy to Supabase
   ```

---

## 🐛 Troubleshooting

### "Connection refused" when running migrate:local

**Problem:** Docker container not running

**Solution:**
```bash
# Start the database
pnpm db:start

# Wait 5-10 seconds for it to start
pnpm db:logs

# Try migration again
pnpm migrate:local
```

### "Docker command not found"

**Problem:** Docker not installed

**Solution:** Install Docker Desktop from https://docs.docker.com/get-docker/

### "Port 5432 already in use"

**Problem:** Another PostgreSQL is running on port 5432

**Solution 1:** Stop other PostgreSQL
```bash
# On Ubuntu/Debian
sudo systemctl stop postgresql

# On macOS with Homebrew
brew services stop postgresql
```

**Solution 2:** Change port in `docker-compose.yml`
```yaml
ports:
  - "5433:5432"  # Use port 5433 instead
```

Then update `scripts/migrate-local.ts`:
```typescript
const LOCAL_DB_CONFIG = {
  port: 5433,  // Changed from 5432
  // ... rest of config
};
```

### Migrations fail with "already exists" errors

**Problem:** Tables already exist from previous run

**Solution:** This is usually OK - the script continues. To reset:
```bash
pnpm db:stop
docker volume rm coinflip_postgres_data
pnpm db:start
pnpm migrate:local
```

---

## 📊 What Gets Created

### Tables

1. **`tiers`** - Bet tier configuration
2. **`games`** - All game records
3. **`indexer_state`** - Blockchain sync state
4. **`_migrations`** - Migration tracking
5. **`audit_log`** - Audit trail

### Views

1. **`indexer_health`** - Indexer monitoring
2. **`game_processing_metrics`** - Game statistics
3. **`api_usage_stats`** - API usage tracking

### Functions

1. **`audit_games_changes()`** - Audit trigger
2. **`validate_game_tier_amount()`** - Data validation

### Indexes

Multiple indexes on `games` table for performance

### Triggers

- Audit logging on games table
- Tier amount validation on insert

---

## 🎯 Summary

**Local Development:**
```bash
pnpm db:start        # Start PostgreSQL
pnpm migrate:local   # Run migrations
pnpm dev             # Test app
pnpm db:stop         # Stop when done
```

**Cloud Deployment:**
```bash
pnpm migrate:cloud   # Show SQL
# Copy & paste to Supabase SQL Editor
```

**That's it!** Test locally, deploy to cloud when ready. 🚀
