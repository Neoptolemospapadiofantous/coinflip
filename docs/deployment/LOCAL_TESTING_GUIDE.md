# 🚀 Local Testing Guide (No Testnet Tokens Needed!)

## Why Test Locally?
- ✅ **Unlimited test ETH** - 10,000 ETH per account
- ✅ **Instant transactions** - No waiting for block confirmations
- ✅ **No faucets needed** - Everything runs on your machine
- ✅ **Full functionality** - Test all features without real money

## Quick Start (3 Steps)

### Step 1: Start Local Blockchain

Open a new terminal and run:
```bash
cd /home/theone/Desktop/coinflip
npx hardhat node
```

**You'll see:**
- 20 accounts with 10,000 ETH each
- RPC server at http://127.0.0.1:8545
- Keep this terminal running!

### Step 2: Deploy Contracts

In a NEW terminal:
```bash
cd /home/theone/Desktop/coinflip
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/deploy-local.ts --network localhost
```

**This will:**
- Deploy CoinFlip contract
- Deploy mock VRF coordinator
- Initialize all game tiers
- Give you the contract address

### Step 3: Configure MetaMask

#### A. Add Localhost Network
1. Open MetaMask
2. Click network dropdown → "Add Network"
3. Enter:
   - **Network Name:** Localhost 8545
   - **RPC URL:** http://127.0.0.1:8545
   - **Chain ID:** 31337
   - **Currency Symbol:** ETH

#### B. Import Test Account
1. Click account icon → "Import Account"
2. Paste this private key:
   ```
   0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
3. You now have 10,000 ETH! 💰

## Usage

### Start Playing
1. Go to: http://localhost:3000/play
2. Connect your MetaMask wallet
3. **Make sure you're on "Localhost 8545" network**
4. Select a tier and start playing!

### Test Accounts Available

All these accounts have 10,000 ETH:

```
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

Account #2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

Import multiple accounts to test 2-player games!

## Testing Scenarios

### Test 1: Create a Game
1. Connect wallet with Account #0
2. Select Tier 0 ($5 = 0.001 ETH)
3. Choose Heads or Tails
4. Click "Create Game"
5. Approve transaction
6. ✅ Game created!

### Test 2: Two-Player Game
1. Create game with Account #0 (Heads)
2. Switch to Account #1 in MetaMask
3. Join the same game (Tails)
4. Wait for VRF (instant on local network)
5. ✅ Winner gets paid automatically!

### Test 3: Multiple Games
- Import more accounts
- Create multiple games simultaneously
- Test the full matchmaking system

## Troubleshooting

### "Transaction Failed"
- Check you're on Localhost 8545 network
- Restart Hardhat node if it crashed
- Redeploy contracts

### "Contract Not Found"
- Make sure you ran deploy-local.ts
- Check contract address matches in frontend
- Restart dev server

### "Insufficient Funds"
- Verify you imported the test account
- Check you're on Localhost network (not Amoy)
- Each account starts with 10,000 ETH

## Benefits of Local Testing

| Feature | Local Network | Amoy Testnet |
|---------|--------------|--------------|
| Transaction Speed | Instant | 5-15 seconds |
| Cost | Free | Free (but limited) |
| ETH Available | 10,000 per account | Need faucets |
| VRF Response | Instant | 1-3 minutes |
| Reliability | 100% | Depends on network |

## When to Use Real Testnet

Use Amoy testnet when you want to:
- Test with real Chainlink VRF
- Share the app with others
- Test production-like conditions
- Verify contract on Polygonscan

For now, **local testing is perfect** for development and debugging!

## Quick Commands Reference

```bash
# Start local blockchain
npx hardhat node

# Deploy contracts locally
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/deploy-local.ts --network localhost

# Run tests
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat test

# Start frontend
pnpm dev

# Check local blockchain
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

## Need Help?

If you have any issues:
1. Check Hardhat terminal for errors
2. Restart local blockchain
3. Clear MetaMask activity (Settings → Advanced → Clear activity)
4. Redeploy contracts

Happy testing! 🎮✨
