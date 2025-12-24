# 🚀 Deploy to Sepolia Testnet (EASY FAUCETS!)

## Why Sepolia?
- ✅ **Faucets actually work!** (unlike Amoy)
- ✅ Chainlink VRF fully supported
- ✅ Most popular Ethereum testnet
- ✅ Fast & reliable
- ✅ Great for testing before mainnet

---

## Step 1: Get Sepolia ETH (Easy!)

### Your Wallets:
- **Wallet 1:** `0x6c2eEA6c606EbB5fB14aa0668F0fDE40D9171B7c`
- **Wallet 2:** `0x4492d278C7981a2384176Cc7f46543AE243c9BaF`

### Faucets (Try These in Order):

#### 1. Alchemy Sepolia Faucet ⭐ (BEST)
**URL:** https://www.alchemy.com/faucets/ethereum-sepolia

**Steps:**
1. Create free Alchemy account (2 minutes)
2. Enter Wallet 1
3. Get **0.5 ETH** instantly ✅
4. Wait 24 hours
5. Get 0.5 ETH for Wallet 2

**Success Rate:** 95%

---

#### 2. QuickNode Sepolia Faucet
**URL:** https://faucet.quicknode.com/ethereum/sepolia

- No account needed
- Get **0.1 ETH**
- Works reliably

---

#### 3. Infura Sepolia Faucet
**URL:** https://www.infura.io/faucet/sepolia

- Free Infura account required
- Get **0.5 ETH/day**
- Very reliable

---

#### 4. Chainlink Sepolia Faucet
**URL:** https://faucets.chain.link/sepolia

- Works well for developers
- Also gives testnet LINK (for VRF!)
- Multiple tokens available

---

## Step 2: Add Sepolia to MetaMask

1. Open MetaMask
2. Click network dropdown
3. "Add network manually"
4. Enter:
   - **Network name:** Sepolia
   - **RPC URL:** https://rpc.sepolia.org
   - **Chain ID:** 11155111
   - **Currency symbol:** ETH
   - **Block Explorer:** https://sepolia.etherscan.io

5. Click "Save"

---

## Step 3: Get Testnet LINK (for VRF)

**You need LINK tokens to use Chainlink VRF!**

**URL:** https://faucets.chain.link/sepolia

1. Connect your wallet OR paste address
2. Get **20 testnet LINK**
3. Repeat for Wallet 2

---

## Step 4: Create VRF Subscription

**URL:** https://vrf.chain.link/

1. **Connect wallet** (switch to Sepolia network)
2. Click **"Create Subscription"**
3. Confirm transaction (costs ~0.001 ETH)
4. **Fund subscription** with 10 LINK
5. **Copy Subscription ID** (you'll need this!)

---

## Step 5: Deploy Contract to Sepolia

### A. Update .env.local

Add/update these lines:
```bash
# Your private key (NEVER commit this!)
PRIVATE_KEY=0xyour_private_key_here

# Sepolia RPC (optional, uses default if not set)
SEPOLIA_RPC_URL=https://rpc.sepolia.org

# VRF Subscription ID from Step 4
VRF_SUBSCRIPTION_ID=your_subscription_id_here

# Etherscan API key (optional, for verification)
ETHERSCAN_API_KEY=your_etherscan_key
```

### B. Deploy!

```bash
cd /home/theone/Desktop/coinflip

# Compile contracts
npx hardhat compile

# Deploy to Sepolia
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/deploy.ts --network sepolia
```

**You'll see:**
- ✅ Contract deployed to: 0x...
- ✅ Instructions for next steps

### C. Copy Contract Address

Save the contract address from the output!

---

## Step 6: Add Contract as VRF Consumer

1. Go back to: https://vrf.chain.link/
2. Open your subscription
3. Click **"Add Consumer"**
4. Paste your **CoinFlip contract address**
5. Confirm transaction

---

## Step 7: Update Frontend

Edit `.env.local`:
```bash
# Add this line
NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA=0xYourContractAddress

# Update chain ID
NEXT_PUBLIC_CHAIN_ID=11155111
```

Restart dev server:
```bash
pnpm dev
```

---

## Step 8: Initialize Game Tiers

```bash
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/initialize-tiers.ts --network sepolia
```

This sets up the betting tiers (Tier 0 = 0.001 ETH, etc.)

---

## Step 9: TEST YOUR GAME! 🎮

1. Go to: http://localhost:3000/play
2. Connect **Wallet 1** to MetaMask
3. **Switch to Sepolia network** in MetaMask
4. Create a game (Tier 0)
5. Switch to **Wallet 2** in MetaMask
6. Join the game
7. Wait 1-3 minutes for VRF
8. 🎉 Winner gets paid!

---

## Verify Your Deployment

### Check Contract on Etherscan:
https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS

### Check Your Balances:
- **Wallet 1:** https://sepolia.etherscan.io/address/0x6c2eEA6c606EbB5fB14aa0668F0fDE40D9171B7c
- **Wallet 2:** https://sepolia.etherscan.io/address/0x4492d278C7981a2384176Cc7f46543AE243c9BaF

### Check VRF Subscription:
https://vrf.chain.link/ → Your subscriptions

---

## Sepolia vs Amoy Comparison

| Feature | Sepolia | Amoy |
|---------|---------|------|
| **Faucets** | ✅ Work great! | ❌ Often broken |
| **Get Tokens** | 0.5-1 ETH easy | Hard to get POL |
| **VRF Support** | ✅ Full support | ✅ Full support |
| **Speed** | Fast | Fast |
| **Explorer** | Etherscan | Polygonscan |
| **Currency** | ETH | POL |

---

## Troubleshooting

### "Insufficient funds for gas"
- Get more Sepolia ETH from faucets above
- Each transaction costs ~0.001-0.01 ETH

### "VRF subscription not found"
- Check you copied the right subscription ID
- Make sure subscription has LINK tokens
- Verify you added contract as consumer

### "Contract not found"
- Make sure you're on Sepolia network
- Check contract address in .env.local
- Verify deployment succeeded

### "Transaction failed"
- Check you have enough ETH
- Verify you're on correct network
- Check contract is initialized (tiers set)

---

## Quick Command Reference

```bash
# Compile
npx hardhat compile

# Deploy to Sepolia
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/deploy.ts --network sepolia

# Initialize tiers
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/initialize-tiers.ts --network sepolia

# Verify contract
TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat verify --network sepolia <ADDRESS> <ARGS>

# Start frontend
pnpm dev
```

---

## Support Resources

- **Sepolia Faucets:** See Step 1 above
- **Chainlink Docs:** https://docs.chain.link/vrf/v2-5/overview
- **Etherscan:** https://sepolia.etherscan.io
- **Discord Help:** https://discord.gg/chainlink

---

## ✅ Success Checklist

Before testing, make sure:
- [ ] Got Sepolia ETH for both wallets (0.5+ ETH each)
- [ ] Got testnet LINK (10+ for VRF subscription)
- [ ] Created VRF subscription and funded it
- [ ] Deployed contract to Sepolia
- [ ] Added contract as VRF consumer
- [ ] Initialized game tiers
- [ ] Updated .env.local with contract address
- [ ] Restarted dev server
- [ ] MetaMask connected to Sepolia network

---

**Once all done, you'll have a fully working testnet deployment with REAL Chainlink VRF randomness!** 🎲✨
