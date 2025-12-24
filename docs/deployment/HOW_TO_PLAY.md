# 🎮 How to Play CoinFlip (Sepolia Testnet)

## Current Deployment Status

✅ **Contract Deployed:** `0x0D24d83E396c96759294b2b0C5c6C64F7DB189CB` on Ethereum Sepolia
✅ **Tiers Initialized:** All 5 tiers ready (0.001 to 0.020 ETH)
✅ **Network:** Ethereum Sepolia (Chain ID: 11155111)
✅ **App Running:** http://localhost:3000/play

---

## Quick Start (2 Players)

### Prerequisites
- 2 wallets with Sepolia ETH (you have 2.34 ETH on `0x4492...9BaF` ✅)
- MetaMask installed and connected to Sepolia network

### Step 1: Add Contract as VRF Consumer

**IMPORTANT:** Before playing, you need to authorize the contract for randomness:

1. Go to: https://vrf.chain.link/
2. Connect your wallet (switch to Sepolia network)
3. Find your VRF subscription (ID in .env.local)
4. Click **"Add Consumer"**
5. Paste contract address: `0x0D24d83E396c96759294b2b0C5c6C64F7DB189CB`
6. Confirm transaction

### Step 2: Play the Game

#### Player 1 (Create Game)
1. Go to: http://localhost:3000/play
2. Connect wallet: `0x4492d278C7981a2384176Cc7f46543AE243c9BaF` (Account 1)
3. Ensure MetaMask is on **Sepolia network**
4. Select **Tier 0** ($5 = 0.001 ETH)
5. Click **"Create Game"**
6. Confirm transaction in MetaMask
7. Wait for confirmation (game will appear in queue)

#### Player 2 (Join Game)
1. In MetaMask, switch to your second wallet: `0x6c2eEA6c606EbB5fB14aa0668F0fDE40D9171B7c`
2. Refresh the page (http://localhost:3000/play)
3. You should see Player 1's game in the queue
4. Click **"Join Game"**
5. Confirm transaction in MetaMask

#### Wait for Result
1. **Chainlink VRF will process** (1-3 minutes)
2. Contract automatically determines winner
3. Winner receives payout (95% of pot = 0.0019 ETH)
4. Platform keeps 5% fee (0.0001 ETH)

---

## Game Tiers

| Tier | Bet Amount | Win Amount | USD Value |
|------|------------|------------|-----------|
| 0    | 0.001 ETH  | 0.0019 ETH | ~$5       |
| 1    | 0.002 ETH  | 0.0038 ETH | ~$10      |
| 2    | 0.005 ETH  | 0.0095 ETH | ~$25      |
| 3    | 0.010 ETH  | 0.019 ETH  | ~$50      |
| 4    | 0.020 ETH  | 0.038 ETH  | ~$100     |

All tiers have a **5% platform fee**.

---

## Current Wallet Status

### Wallet 1: `0x4492d278C7981a2384176Cc7f46543AE243c9BaF`
- ✅ Balance: 2.34 SepoliaETH
- ✅ Enough for testing all tiers
- 🎮 Ready to play!

### Wallet 2: `0x6c2eEA6c606EbB5fB14aa0668F0fDE40D9171B7c`
- ❌ Balance: Unknown (needs Sepolia ETH)
- 📍 Action needed: Get testnet ETH from faucets

**Get Sepolia ETH for Wallet 2:**
1. Alchemy Faucet: https://www.alchemy.com/faucets/ethereum-sepolia (0.5 ETH/day)
2. QuickNode Faucet: https://faucet.quicknode.com/ethereum/sepolia (0.1 ETH)
3. Chainlink Faucet: https://faucets.chain.link/sepolia (multiple tokens)

---

## Verify Everything is Working

### Check Contract on Etherscan
https://sepolia.etherscan.io/address/0x0D24d83E396c96759294b2b0C5c6C64F7DB189CB

You should see:
- ✅ Contract verified
- ✅ Recent transactions (tier initialization)
- ✅ Contract balance

### Check VRF Subscription
https://vrf.chain.link/ → Your subscriptions

You should see:
- ✅ Subscription funded with LINK
- ✅ Contract added as consumer
- ✅ Balance sufficient for randomness requests

### Check Wallet Balances
- Wallet 1: https://sepolia.etherscan.io/address/0x4492d278C7981a2384176Cc7f46543AE243c9BaF
- Wallet 2: https://sepolia.etherscan.io/address/0x6c2eEA6c606EbB5fB14aa0668F0fDE40D9171B7c

---

## Troubleshooting

### "Low balance" on all tiers
✅ **FIXED!** - The balance check logic has been corrected. Refresh the page to see available tiers.

### "Transaction failed"
- Ensure you're on **Sepolia network** in MetaMask
- Check you have enough ETH for gas (~0.002 ETH per transaction)
- Verify contract address in .env.local is correct

### "VRF request failed"
- Ensure contract is added as VRF consumer (Step 1 above)
- Check VRF subscription has enough LINK tokens
- Verify subscription ID is correct in .env.local

### "Game not found" or "No games in queue"
- Refresh the page
- Check Supabase database connection
- Verify contract events are being emitted

### "Stuck waiting for result"
- VRF can take 1-5 minutes
- Check VRF subscription on https://vrf.chain.link/
- View transaction on Etherscan to see VRF callback status

---

## Testing Checklist

Before playing:
- [ ] Contract deployed to Sepolia
- [ ] All 5 tiers initialized
- [ ] VRF subscription created and funded
- [ ] Contract added as VRF consumer
- [ ] .env.local updated with contract address
- [ ] Dev server running (pnpm dev)
- [ ] MetaMask connected to Sepolia
- [ ] Both wallets have Sepolia ETH

---

## Next Steps After Testing

1. **Test all tiers** - Try different bet amounts
2. **Monitor VRF** - Watch how randomness is generated
3. **Check payouts** - Verify winner gets correct amount
4. **Test edge cases** - Multiple games, cancellations, etc.
5. **Deploy to production** - When ready, deploy to Polygon mainnet

---

## Quick Links

- **Play Game:** http://localhost:3000/play
- **Sepolia Etherscan:** https://sepolia.etherscan.io
- **VRF Dashboard:** https://vrf.chain.link/
- **Sepolia Faucets:** See SEPOLIA_DEPLOYMENT_GUIDE.md
- **Complete Guide:** SEPOLIA_DEPLOYMENT_GUIDE.md

---

**Ready to flip? Connect your wallet and start playing!** 🎲✨
