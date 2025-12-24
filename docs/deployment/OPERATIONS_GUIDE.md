# CoinFlip Operations Guide

Complete guide for operating and maintaining the CoinFlip application.

**Last Updated:** December 24, 2025

---

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Development Workflow](#development-workflow)
3. [Deployment Process](#deployment-process)
4. [Monitoring & Maintenance](#monitoring--maintenance)
5. [Emergency Procedures](#emergency-procedures)
6. [Command Reference](#command-reference)

---

## Daily Operations

### Starting the Development Environment

**Clean start (recommended):**
```bash
# 1. Clean build artifacts
rm -rf .next node_modules/.cache .turbo

# 2. Start dev server
pnpm dev

# 3. Open browser
# Navigate to http://localhost:3000
```

**Quick start:**
```bash
pnpm dev
```

### Checking System Health

**Database health check:**
```bash
# Option 1: CLI tool
pnpm verify-db

# Option 2: Admin panel
# Navigate to http://localhost:3000/admin/setup
```

**Contract verification:**
```bash
# Verify production setup
tsx scripts/verify-production-setup.ts
```

### Running the Event Indexer

The event indexer syncs blockchain events to the database.

**Start indexer:**
```bash
# Production indexer (recommended)
pnpm indexer:prod

# Or manually
tsx scripts/production-indexer.ts
```

**The indexer will:**
- Listen for `GameCreated`, `GameJoined`, `GameResolved` events
- Write game data to Supabase database
- Update real-time statistics
- Handle missed events on restart

---

## Development Workflow

### 1. Making Code Changes

**Typical workflow:**
```bash
# 1. Ensure dev server is running
pnpm dev

# 2. Make code changes
# Files auto-reload with Turbopack

# 3. Check for TypeScript errors
pnpm tsc --noEmit

# 4. Run linter
pnpm lint
```

### 2. Testing Changes

**Frontend testing:**
- Connect wallet to Sepolia testnet
- Check NetworkIndicator shows "Sepolia Testnet"
- Verify tier amounts are testnet values ($0.05-$1)
- Test wallet connection/disconnection
- Test tier selection
- Check balance updates

**Smart contract testing:**
```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Test specific file
npx hardhat test test/CoinFlip.test.ts
```

### 3. Building for Production

```bash
# Full build
pnpm build

# Build output location: .next/

# Start production server locally
pnpm start
```

---

## Deployment Process

### Smart Contract Deployment

**1. Deploy to Sepolia testnet:**
```bash
# Compile first
npx hardhat compile

# Deploy
npx hardhat run scripts/deploy.ts --network sepolia

# Output will show:
# - Contract address
# - VRF Coordinator address
# - Subscription ID
```

**2. Initialize tiers (auto-detects testnet):**
```bash
npx hardhat run scripts/initialize-tiers.ts --network sepolia

# This sets testnet tier amounts:
# 0.00001, 0.00005, 0.0001, 0.0005, 0.001 ETH
```

**3. Update environment variables:**
```bash
# Add to .env.local
NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA=0x...
VRF_SUBSCRIPTION_ID=...
```

### Frontend Deployment (Vercel)

**1. Build and test locally:**
```bash
pnpm build
pnpm start
```

**2. Deploy to Vercel:**
```bash
# Via Vercel CLI
vercel

# Or push to main branch (auto-deploy)
git push origin main
```

**3. Set environment variables in Vercel:**
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA`
- `NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_AMOY`

### Database Deployment

**1. Initial setup (one-time):**
```bash
# Generate migration SQL
pnpm migrate

# Copy output and paste into Supabase SQL Editor
```

**2. Verify deployment:**
```bash
pnpm verify-db
```

**3. Start event indexer on server:**
```bash
# On production server
tsx scripts/production-indexer.ts

# Or use a process manager like PM2
pm2 start scripts/production-indexer.ts --name coinflip-indexer
```

---

## Monitoring & Maintenance

### Health Checks

**Daily checks:**
```bash
# 1. Check database connection
pnpm verify-db

# 2. Check contract deployment
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>

# 3. Check build status
pnpm build

# 4. Check for security issues
pnpm audit
```

### Log Monitoring

**Frontend logs:**
- Check browser console for errors
- Monitor Vercel deployment logs
- Check for CORS or RPC errors

**Backend logs:**
- Monitor Supabase logs
- Check event indexer output
- Watch for failed database writes

**Smart contract logs:**
- Monitor Etherscan/Polygonscan for contract events
- Check Chainlink VRF subscription status
- Verify gas usage patterns

### Database Maintenance

**Check table sizes:**
```sql
-- Run in Supabase SQL Editor
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Clean old games (optional):**
```sql
-- Archive games older than 30 days
DELETE FROM games
WHERE created_at < NOW() - INTERVAL '30 days'
AND status = 'resolved';
```

---

## Emergency Procedures

### System Down

**1. Frontend not loading:**
```bash
# Check Vercel status
# https://www.vercel-status.com/

# Redeploy if needed
vercel --prod

# Check DNS and SSL
curl -I https://your-domain.com
```

**2. Database connection failed:**
```bash
# Check Supabase status
# Navigate to Supabase dashboard

# Test connection
pnpm verify-db

# Check environment variables are set
```

**3. Contract not responding:**
```bash
# Check network status (Etherscan/Polygonscan)

# Verify contract address
npx hardhat verify --network sepolia <ADDRESS>

# Check VRF subscription has LINK
# Navigate to vrf.chain.link
```

### High Traffic Issues

**If experiencing slow performance:**

1. **Check RPC rate limits**
   - Wallet's built-in RPC may hit limits
   - Consider adding Alchemy/Infura API key

2. **Scale database connections**
   - Increase Supabase connection pool
   - Add read replicas if needed

3. **Optimize queries**
   - Add database indexes
   - Cache tier data longer
   - Reduce real-time subscription frequency

### Security Incidents

**If suspicious activity detected:**

1. **Pause contract (if needed):**
```solidity
// Owner calls emergency pause function
await contract.pause()
```

2. **Investigate:**
   - Check transaction history
   - Review recent games
   - Analyze win/loss patterns

3. **Document:**
   - Save transaction hashes
   - Export affected game data
   - Create incident report

---

## Command Reference

### Essential Commands

**Development:**
```bash
pnpm dev                 # Start dev server
pnpm build              # Build for production
pnpm start              # Start production server
pnpm lint               # Run linter
pnpm audit              # Security audit
```

**Database:**
```bash
pnpm migrate            # Run migrations
pnpm verify-db          # Verify setup
pnpm indexer:prod       # Start event indexer
pnpm db:start           # Start local PostgreSQL
pnpm db:logs            # View database logs
```

**Smart Contracts:**
```bash
npx hardhat compile                              # Compile contracts
npx hardhat test                                 # Run tests
npx hardhat run scripts/deploy.ts --network X    # Deploy
npx hardhat run scripts/initialize-tiers.ts --network X  # Initialize tiers
```

**Cleanup:**
```bash
rm -rf .next node_modules/.cache .turbo   # Clean build
pkill -9 -f "next dev"                    # Kill dev servers
lsof -ti:3000 | xargs kill -9             # Kill port 3000
```

### Network-Specific Commands

**Sepolia (Testnet):**
```bash
# Deploy to Sepolia
npx hardhat run scripts/deploy.ts --network sepolia

# Initialize with testnet tiers (auto-detected)
npx hardhat run scripts/initialize-tiers.ts --network sepolia

# Verify contract
npx hardhat verify --network sepolia <ADDRESS>
```

**Polygon Amoy (Testnet):**
```bash
# Deploy to Amoy
npx hardhat run scripts/deploy.ts --network amoy

# Initialize tiers
npx hardhat run scripts/initialize-tiers.ts --network amoy
```

**Polygon Mainnet (Production):**
```bash
# Deploy to mainnet
npx hardhat run scripts/deploy.ts --network polygon

# Initialize with production tiers (auto-detected)
npx hardhat run scripts/initialize-tiers.ts --network polygon

# ⚠️ CAUTION: Real money involved!
```

### Debugging Commands

**Check what's running:**
```bash
# List all node processes
ps aux | grep node

# Check ports in use
lsof -i :3000
lsof -i :3001
```

**View logs:**
```bash
# View dev server output
# (check terminal where `pnpm dev` is running)

# View indexer logs
# (check terminal where indexer is running)

# View system logs
journalctl -u coinflip-indexer  # If using systemd
```

**Network diagnostics:**
```bash
# Test RPC endpoint
curl -X POST https://rpc.sepolia.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check contract
cast call <CONTRACT_ADDRESS> "getTier(uint256)" 0 --rpc-url https://rpc.sepolia.org
```

---

## Best Practices

### Development

1. **Always test on testnet first** - Never deploy to mainnet without testing
2. **Use version control** - Commit changes frequently with clear messages
3. **Clean builds** - Run `rm -rf .next` before production builds
4. **Type safety** - Run `pnpm tsc --noEmit` before deploying
5. **Security audits** - Run `pnpm audit` regularly

### Database

1. **Backup regularly** - Use Supabase automated backups
2. **Index queries** - Add indexes for frequently queried columns
3. **Monitor size** - Keep eye on database growth
4. **Use transactions** - For multi-step operations
5. **Validate data** - Check data integrity regularly

### Smart Contracts

1. **Audit before mainnet** - Professional audit required
2. **Test thoroughly** - 100% test coverage target
3. **Gas optimization** - Minimize transaction costs
4. **Emergency procedures** - Have pause mechanism
5. **Monitor VRF** - Keep LINK balance sufficient

### Operations

1. **Document changes** - Update docs when modifying code
2. **Monitor errors** - Set up error tracking (Sentry, etc.)
3. **Plan maintenance** - Schedule downtime for major updates
4. **Have rollback plan** - Know how to revert deployments
5. **Keep secrets safe** - Never commit private keys

---

## Troubleshooting Quick Reference

| Problem | Quick Fix |
|---------|-----------|
| Port already in use | `pkill -9 -f "next dev"` |
| Build errors | `rm -rf .next && pnpm build` |
| Balance not loading | Disconnect/reconnect wallet + refresh |
| Transaction failing | Check network, gas, and contract address |
| Database connection failed | Check `.env.local` and Supabase status |
| VRF not responding | Check LINK balance at vrf.chain.link |
| High gas costs | Switch to testnet or wait for lower gas |

---

**For more details, see:**
- [README.md](./README.md) - Project overview
- [QUICK_START.md](./QUICK_START.md) - Fast setup guide
- [TESTNET_CONVERTER.md](./TESTNET_CONVERTER.md) - Tier scaling details
- [docs/](./docs/) - Complete documentation
