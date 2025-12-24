# CoinFlip Testing Guide

**Quick reference for testing the complete coinflip functionality**

---

## Prerequisites Summary

Before you can test a real coinflip, ensure you have:

- [x] **Database**: Supabase migrations completed (`pnpm migrate`)
- [x] **Frontend**: UI working locally (`pnpm dev`)
- [x] **Smart Contract**: CoinFlip.sol deployed to Amoy (0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae)
- [x] **Contract Address**: Updated in `.env.local`
- [x] **VRF Subscription**: Created and funded with LINK
- [ ] **Test Funds**: Amoy MATIC in your wallet
- [ ] **Event Indexer**: Running to sync blockchain → database

---

## Current Status Check

### What's Ready ✅

```bash
# Check database
pnpm verify-db
# Should show: ✓ All tables exist, ✓ Tiers loaded

# Check frontend
pnpm dev
# Visit http://localhost:3000/play
# Should show: Tier selector, game creation flow
```

### What's Ready ✅

The **smart contract** is deployed! Check your `.env.local`:

```bash
cat .env.local | grep CONTRACT_ADDRESS
# Should show: NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_AMOY=0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae
```

Contract is live on Amoy testnet and ready for testing!

---

## Deployment Quick Start

**Note:** Contract is already deployed to Amoy testnet at `0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae`

If you need to redeploy:

### Step 1: Deploy Smart Contract (15-20 min)

**Option A: Use Hardhat**

```bash
# Install Hardhat
pnpm add -D hardhat @nomicfoundation/hardhat-toolbox
pnpm hardhat init

# Create contract
# - Copy contract code from doc/01_smart_contract_architecture.md
# - Save to contracts/CoinFlip.sol

# Deploy to Amoy testnet (Mumbai was shut down in April 2024)
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/deploy.ts --network amoy
# Note the deployed address
```

**Option B: Use Foundry (faster)**

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Create contract
mkdir contracts
# Copy contract from doc/01_smart_contract_architecture.md

# Deploy to Amoy testnet
forge create --rpc-url https://rpc-amoy.polygon.technology \
  --private-key $PRIVATE_KEY \
  --constructor-args $VRF_SUBSCRIPTION_ID 0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2 0x3f631d5ec60a0ce16203bcd4badc1676330eba9ebee3e150977eba41db53a5ae $YOUR_FEE_RECIPIENT \
  contracts/CoinFlip.sol:CoinFlip
```

### Step 2: Set Up Chainlink VRF (10 min)

1. **Get testnet tokens**:
   - MATIC: https://faucet.polygon.technology/ (select Amoy)
   - LINK: https://faucets.chain.link/polygon-amoy

2. **Create VRF subscription**:
   - Visit: https://vrf.chain.link/
   - Switch to Polygon Amoy network (Chain ID: 80002)
   - Create subscription, fund with 5 LINK
   - Add your contract as consumer

3. **VRF Config** (Amoy testnet):
   ```
   Coordinator: 0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2
   Key Hash: 0x3f631d5ec60a0ce16203bcd4badc1676330eba9ebee3e150977eba41db53a5ae
   ```

### Step 3: Update Environment (2 min)

```bash
# Edit .env.local
NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_AMOY=0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae

# Restart dev server
pnpm dev
```

### Step 4: Initialize Tiers (5 min)

Connect to your contract and set tier amounts:

```javascript
// Using Hardhat console or Polygonscan
await contract.setTier(0, ethers.parseEther("0.001")); // $5
await contract.setTier(1, ethers.parseEther("0.002")); // $10
await contract.setTier(2, ethers.parseEther("0.005")); // $25
await contract.setTier(3, ethers.parseEther("0.010")); // $50
await contract.setTier(4, ethers.parseEther("0.020")); // $100
```

---

## Testing Scenarios

### Test 1: Create a Game

**Goal**: Verify game creation flow works end-to-end

1. Open http://localhost:3000/play
2. Connect wallet (ensure you're on Amoy network - Chain ID 80002)
3. Select Tier 0 ($5)
4. Choose Heads or Tails
5. Click "Create Game"
6. Approve MetaMask transaction

**Expected Results**:
- ✅ Transaction succeeds
- ✅ See "Waiting for opponent" message
- ✅ Transaction appears on [Amoy Polygonscan](https://amoy.polygonscan.com)
- ✅ Game appears in database: `SELECT * FROM games`

**Debug if fails**:
```bash
# Check contract address loaded correctly
console.log(getCoinFlipAddress(80002))

# Check wallet has MATIC
# Check you're on Amoy network (chain ID 80002)
# Check transaction in Polygonscan for revert reason
```

---

### Test 2: Complete Two-Player Game

**Goal**: Full game from creation → join → VRF → resolution

**Setup**: Use two different wallets (or browser profiles)

**Player 1**:
1. Create game (Tier 0, Heads)
2. Note the game ID from transaction
3. Leave browser open

**Player 2** (incognito/different browser):
1. Connect different wallet
2. Find game in queue (or join by ID)
3. Join game (choose Tails)
4. Approve transaction

**System (Automatic)**:
5. Contract requests VRF randomness
6. Wait 1-2 minutes for Chainlink callback
7. VRF resolves game
8. Winner receives payout

**Expected Results**:
- ✅ Game moves from "waiting" → "active" → "resolved"
- ✅ Winner receives ~1.9x bet amount (after 5% fee)
- ✅ Loser balance decreases by bet amount
- ✅ Database updated with winner and result
- ✅ Both browsers show result (if real-time enabled)

**Verify**:
```bash
# Check game in database
SELECT * FROM games WHERE game_id = 'YOUR_GAME_ID';

# Check VRF request fulfilled
# Visit Chainlink VRF dashboard
# Should show request with status "Fulfilled"

# Check winner received funds
# View winner address on Polygonscan
```

---

### Test 3: Cancel Timeout Game

**Goal**: Verify refund mechanism works

1. Create game (Player 1)
2. Don't join (no Player 2)
3. Wait for timeout period (check contract)
4. Call `cancelGame(gameId)` function
5. Verify refund received

**Expected Results**:
- ✅ Transaction succeeds
- ✅ Player 1 receives full refund
- ✅ Game status → "cancelled" in database

---

### Test 4: Real-time Updates

**Goal**: Verify Supabase real-time works

**Setup**: Two browser windows, same or different wallets

1. Window A: Go to games list page
2. Window B: Create a new game
3. Window A: Should see game appear instantly

**Expected Results**:
- ✅ New games appear without refresh
- ✅ Game status updates appear instantly
- ✅ Both windows stay in sync

**Debug if fails**:
- Check Supabase Realtime is enabled
- Check browser console for errors
- Verify Supabase client connection

---

## Monitoring During Tests

### Blockchain

**Amoy Polygonscan**: https://amoy.polygonscan.com

Monitor:
- Your wallet transactions
- Contract interactions at 0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae
- Event logs (GameCreated, GameJoined, GameResolved)
- Gas usage

**Chainlink VRF Dashboard**: https://vrf.chain.link/

Monitor:
- VRF requests
- LINK balance in subscription
- Request fulfillment status

### Database

**Supabase Dashboard**:

Check:
- Table Editor → `games` table
- Realtime → Inspector (see live updates)
- Logs → Edge Functions (if using)

Query games:
```sql
-- Recent games
SELECT * FROM games ORDER BY created_at DESC LIMIT 10;

-- Active games waiting for opponent
SELECT * FROM games WHERE status = 'waiting';

-- Resolved games with winners
SELECT * FROM games WHERE status = 'resolved';
```

### Frontend

**Browser DevTools**:

- **Console**: Check for errors
- **Network**: Monitor API calls to Supabase
- **Application → Local Storage**: Check wagmi cache
- **React Query DevTools**: Monitor query state

---

## Troubleshooting Guide

### "Transaction Failed" in MetaMask

**Possible causes**:
- Insufficient MATIC for gas
- Wrong network selected
- Contract function reverted

**Debug**:
1. Check you're on Amoy (chain ID 80002)
2. Check MATIC balance > 0.01
3. View transaction on Amoy Polygonscan → check revert reason
4. Try increasing gas limit manually

---

### Game Not Appearing in Database

**Possible causes**:
- Event indexer not running
- Database permissions issue
- Supabase connection error

**Debug**:
1. Verify contract emitted event (check Polygonscan)
2. Check event indexer is running
3. Manually insert for testing:
   ```sql
   INSERT INTO games (game_id, creator_address, tier_id, status)
   VALUES ('1', '0xYourAddress', 0, 'waiting');
   ```

---

### VRF Not Fulfilling

**Possible causes**:
- No LINK in subscription
- Contract not added as consumer
- Testnet congestion

**Debug**:
1. Check LINK balance in VRF subscription
2. Verify contract address is consumer
3. Wait up to 5 minutes (testnet can be slow)
4. Check Chainlink VRF dashboard for errors

---

### No Winner Payout

**Possible causes**:
- Contract doesn't have funds
- Payout logic error in contract
- VRF callback failed

**Debug**:
1. Check contract balance on Polygonscan
2. Review contract code for payout function
3. Check VRF callback transaction
4. Verify `GameResolved` event was emitted

---

## Performance Expectations

| Action | Expected Time | Notes |
|--------|---------------|-------|
| Create game transaction | 5-15 seconds | Amoy testnet |
| Join game transaction | 5-15 seconds | Amoy testnet |
| VRF request fulfillment | 1-3 minutes | Depends on testnet |
| Database sync | 1-10 seconds | With event indexer |
| Real-time update | < 1 second | Supabase realtime |

---

## Next Steps After Successful Testing

Once all tests pass:

1. **Security**:
   - [ ] Run Slither static analysis
   - [ ] Test all edge cases
   - [ ] Get professional audit (for mainnet)

2. **Optimization**:
   - [ ] Profile gas costs
   - [ ] Optimize contract storage
   - [ ] Minimize event logs if needed

3. **Production Prep**:
   - [ ] Set up The Graph for event indexing
   - [ ] Configure monitoring and alerts
   - [ ] Test on Polygon mainnet testnet (if available)
   - [ ] Plan mainnet deployment

4. **Documentation**:
   - [ ] Document all admin functions
   - [ ] Create user guide
   - [ ] Write incident response plan

---

## Quick Reference Commands

```bash
# Development
pnpm dev                    # Start Next.js dev server
pnpm verify-db              # Check database health
pnpm migrate                # Show pending migrations

# Contract (Hardhat)
npx hardhat compile         # Compile contracts
npx hardhat test            # Run tests
npx hardhat run scripts/deploy.js --network mumbai

# Contract (Foundry)
forge build                 # Compile
forge test                  # Run tests
forge create --rpc-url $RPC --private-key $KEY

# Database
psql $DATABASE_URL          # Connect to Supabase DB
# Or use Supabase dashboard SQL Editor
```

---

## Support

**Issues during testing?**

1. Check [DATABASE_MIGRATIONS.md](./DATABASE_MIGRATIONS.md) troubleshooting
2. Review [doc/01_smart_contract_architecture.md](./doc/01_smart_contract_architecture.md)
3. Check Mumbai Polygonscan for transaction details
4. Review Supabase logs for backend errors
5. Check browser console for frontend errors

**Resources**:
- Polygon Faucet: https://faucet.polygon.technology/ (select Amoy)
- Chainlink Faucet: https://faucets.chain.link/polygon-amoy
- Amoy Polygonscan: https://amoy.polygonscan.com
- Chainlink VRF: https://vrf.chain.link/
- Deployed Contract: https://amoy.polygonscan.com/address/0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae
