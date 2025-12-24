# Hardhat Setup Complete ✅

Hardhat is now configured and ready to use for smart contract development.

## What Was Fixed

1. **Downgraded to Hardhat 2.x** - More stable than v3, better compatibility
2. **Created hardhat.config.ts** - Configured for Mumbai and Polygon networks
3. **Set up project structure**:
   - `contracts/` - Put your Solidity contracts here
   - `scripts/` - Deployment and utility scripts
   - `test/` - Test files
4. **Added deployment scripts**:
   - `scripts/deploy.ts` - Deploy CoinFlip contract
   - `scripts/initialize-tiers.ts` - Initialize bet tiers after deployment

## Quick Commands

```bash
# Compile contracts
npx hardhat compile

# Deploy to Mumbai testnet (after adding PRIVATE_KEY)
npx hardhat run scripts/deploy.ts --network mumbai

# Initialize tiers (after deployment)
npx hardhat run scripts/initialize-tiers.ts --network mumbai

# Verify contract on Polygonscan
npx hardhat verify --network mumbai <CONTRACT_ADDRESS> <VRF_SUB_ID> <VRF_COORDINATOR> <KEY_HASH>

# Run local Hardhat network
npx hardhat node

# Check Hardhat config
npx hardhat
```

## Environment Variables Required

Before deploying, update `.env.local`:

```bash
# Your wallet private key (DO NOT commit this!)
PRIVATE_KEY=0xYourPrivateKeyHere  # 66 characters, starts with 0x

# Chainlink VRF Subscription ID (get from https://vrf.chain.link/)
VRF_SUBSCRIPTION_ID=12345

# Optional: Polygonscan API key for contract verification
POLYGONSCAN_API_KEY=your_key_here
```

## Next Steps

1. **Write the CoinFlip contract**:
   - See `doc/01_smart_contract_architecture.md` for full specification
   - Create `contracts/CoinFlip.sol`
   - Implement game logic with Chainlink VRF

2. **Get testnet funds**:
   - MATIC: https://faucet.polygon.technology/
   - LINK: https://faucets.chain.link/mumbai

3. **Create VRF Subscription**:
   - Visit https://vrf.chain.link/
   - Connect wallet on Mumbai network
   - Create subscription and fund with LINK
   - Save the subscription ID

4. **Deploy**:
   ```bash
   npx hardhat run scripts/deploy.ts --network mumbai
   ```

5. **Update contract address**:
   ```bash
   # In .env.local
   NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_MUMBAI=0xYourDeployedAddress
   ```

6. **Add contract as VRF consumer**:
   - Go to https://vrf.chain.link/
   - Open your subscription
   - Add your deployed contract address as a consumer

7. **Initialize tiers**:
   ```bash
   npx hardhat run scripts/initialize-tiers.ts --network mumbai
   ```

## Warnings

- Node.js 20.x works but Hardhat recommends 22.x (can ignore for now)
- Some peer dependency warnings are expected and safe to ignore
- **NEVER commit your PRIVATE_KEY** - it's in .gitignore

## Troubleshooting

**Error: "Invalid account: private key too short"**
- Make sure PRIVATE_KEY in `.env.local` is 66 characters (0x + 64 hex chars)
- Get your private key from MetaMask (Account Details → Export Private Key)

**Error: "Insufficient funds"**
- Get Mumbai MATIC from https://faucet.polygon.technology/
- Make sure you have enough for gas

**Compilation works but can't deploy**
- Check PRIVATE_KEY is set correctly
- Check you're on Mumbai network
- Verify you have MATIC in your wallet

For more details, see [TESTING_GUIDE.md](./TESTING_GUIDE.md)
