# CoinFlip Deployment Checklist

Quick checklist for deploying the CoinFlip contract to Polygon Amoy testnet.

**Note:** Contract is already deployed at `0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae`

## Pre-Deployment ✅

- [ ] **Contract compiled successfully**
  ```bash
  npx hardhat compile
  # Should output: "Compiled 7 Solidity files successfully"
  ```

- [ ] **Dependencies installed**
  - [ ] @openzeppelin/contracts (v5.4.0)
  - [ ] @chainlink/contracts (v1.5.0)
  - [ ] hardhat (v2.28.0)

- [x] **Environment configured**
  - [x] `.env.local` file exists
  - [x] `PRIVATE_KEY` set (66 chars, starts with 0x)
  - [x] Wallet has Amoy MATIC (get from https://faucet.polygon.technology/)

## VRF Setup ✅

- [x] **Get LINK tokens**
  - Visit https://faucets.chain.link/polygon-amoy
  - Request testnet LINK to your wallet
  - Confirm receipt (check wallet balance)

- [x] **Create VRF Subscription**
  - [x] Go to https://vrf.chain.link/
  - [x] Connect wallet (Amoy network - Chain ID 80002)
  - [x] Click "Create Subscription"
  - [x] Fund with 5+ LINK tokens
  - [x] Copy Subscription ID

- [ ] **Update .env.local**
  ```bash
  VRF_SUBSCRIPTION_ID=YOUR_SUBSCRIPTION_ID_HERE
  ```

## Deployment ✅

- [x] **Deploy contract**
  ```bash
  TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/deploy.ts --network amoy
  ```

- [x] **Save contract address**
  - Contract address: `0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae`
  - View on Polygonscan: https://amoy.polygonscan.com/address/0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae

- [x] **Add contract as VRF consumer**
  - [ ] Go to https://vrf.chain.link/
  - [ ] Open your subscription
  - [ ] Click "Add Consumer"
  - [ ] Paste contract address
  - [ ] Confirm transaction
  - [ ] Wait for confirmation

## Post-Deployment ✅

- [x] **Update frontend config**
  ```bash
  # Edit .env.local
  NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_AMOY=0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae
  ```

- [ ] **Initialize tiers**
  ```bash
  TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/initialize-tiers.ts --network amoy
  ```

- [ ] **Verify contract on Polygonscan**
  ```bash
  TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat verify --network amoy <ADDRESS> <VRF_SUB_ID> <VRF_COORDINATOR> <KEY_HASH> <FEE_RECIPIENT>
  ```

## Testing ✅

- [ ] **Test game creation**
  - [ ] Connect wallet to app
  - [ ] Select tier 0 ($5)
  - [ ] Choose heads/tails
  - [ ] Create game
  - [ ] Verify transaction on Polygonscan
  - [ ] Check `GameCreated` event emitted

- [ ] **Test game joining**
  - [ ] Use different wallet
  - [ ] Join the created game
  - [ ] Verify transaction
  - [ ] Check `GameJoined` event
  - [ ] Confirm VRF request made

- [ ] **Test VRF resolution**
  - [ ] Wait 1-3 minutes
  - [ ] Check Polygonscan for VRF callback
  - [ ] Verify `GameResolved` event
  - [ ] Confirm winner received payout

- [ ] **Test game cancellation**
  - [ ] Create a game
  - [ ] Wait 100+ blocks (~3-5 min)
  - [ ] Call `cancelGame`
  - [ ] Verify refund received

## Verification ✅

- [ ] **Contract is verified on Polygonscan**
  - Visit: https://amoy.polygonscan.com/address/0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae
  - Should show green checkmark and "Contract" tab

- [ ] **VRF subscription is funded**
  - Check LINK balance > 2
  - If low, add more LINK

- [ ] **All tiers initialized**
  - Call `getTier(0)` through Polygonscan
  - Should show non-zero amount

- [ ] **Frontend connects to contract**
  - Visit http://localhost:3000/play
  - Should show actual contract address (not 0x000...)

## Troubleshooting

### Deployment fails

**"Insufficient funds"**
- Get more Amoy MATIC from faucet (https://faucet.polygon.technology/)
- Check you have at least 0.1 MATIC

**"Invalid VRF subscription"**
- Verify subscription ID is correct
- Check subscription exists on vrf.chain.link

### VRF not fulfilling

**Request pending forever**
- Check LINK balance in subscription (need 2+)
- Verify contract is added as consumer
- Mumbai testnet can be slow (wait up to 5 min)

### Transaction reverts

**"Tier disabled"**
- Run initialize-tiers script
- Or manually call setTier() via Polygonscan

**"Incorrect bet amount"**
- Check tier amount matches what you're sending
- Use exact wei amount (no rounding)

## Quick Commands

```bash
# Compile
npx hardhat compile

# Deploy to Mumbai
npx hardhat run scripts/deploy.ts --network mumbai

# Initialize tiers
npx hardhat run scripts/initialize-tiers.ts --network mumbai

# Verify contract
npx hardhat verify --network mumbai <ADDRESS> <ARGS...>

# Check deployment status
npx hardhat console --network mumbai
> const contract = await ethers.getContractAt("CoinFlip", "YOUR_ADDRESS")
> await contract.VERSION()
> await contract.getTier(0)
```

## Resources

- **Mumbai Faucet**: https://faucet.polygon.technology/
- **LINK Faucet**: https://faucets.chain.link/mumbai
- **VRF Dashboard**: https://vrf.chain.link/
- **Mumbai Explorer**: https://mumbai.polygonscan.com/
- **Contract Spec**: doc/01_smart_contract_architecture.md
- **Testing Guide**: TESTING_GUIDE.md

---

**Ready to deploy?** Start from the top and check off each item!
