# Quick Local Testing (No VRF Needed)

If you want to test the full game flow instantly without waiting for VRF:

## Option 1: Mock VRF in Local Hardhat

```bash
# Terminal 1: Start local Hardhat node
npx hardhat node

# Terminal 2: Deploy contract with mock VRF
npx hardhat run scripts/deploy-local.ts --network localhost

# Terminal 3: Run dev server
pnpm dev
```

Then update `.env.local`:
```bash
NEXT_PUBLIC_CHAIN_ID=31337  # Hardhat local
NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_LOCAL=0x... # from deploy output
```

## Option 2: Wait for Current Game (Recommended)

The game will complete once you:
1. ✅ Get LINK tokens from faucet
2. ✅ Fund VRF subscription with 10+ LINK
3. ✅ Wait 1-3 minutes for VRF callback

Your current game is NOT lost - it's just waiting for LINK funding!

## Current Status

**Game State:** ✅ Created & Matched
**VRF Request:** ⏸️ Pending (needs LINK)
**Players:**
- Wallet 1: `0x4492...9BaF` (Creator)
- Wallet 2: `0x6c2e...1B7c` (Joiner)
**Bet:** 0.001 ETH each (0.002 ETH total pot)
**Prize:** 0.0019 ETH to winner

## After Funding

Once you add LINK to the subscription:
- VRF will automatically fulfill the pending request
- Game will resolve within 1-3 minutes
- Winner gets paid 0.0019 ETH automatically
- Check events at: https://sepolia.etherscan.io/address/0x0D24d83E396c96759294b2b0C5c6C64F7DB189CB#events
