# CoinFlip - Provably Fair Crypto Gambling

A non-custodial crypto coin-flip gambling game built with Next.js, wagmi, and Chainlink VRF for provably fair randomness.

## Features

- **Provably Fair**: Uses Chainlink VRF for verifiable randomness
- **Non-Custodial**: Smart contract holds funds, you control your wallet
- **Instant Payouts**: Automatic payouts directly to winners
- **Tier-Based Betting**: Auto-scaling tiers (testnet: $0.05-$1, mainnet: $5-$100)
- **Real-time Updates**: Live game status with Supabase
- **Mobile-First**: Responsive design optimized for all devices
- **Network-Aware**: Automatically detects testnet/mainnet and adjusts tier amounts

## How It Works (Front to Back)

### 1. Frontend Layer (User Interface)
```
User Browser
    ↓
Next.js 16 App (React + TypeScript)
    ↓
Components:
- TierSelector: Choose bet amount
- CoinChoice: Pick Heads or Tails
- NetworkIndicator: Shows current network
    ↓
Hooks Layer:
- useTiers(): Fetches tier data (auto-detects testnet/mainnet)
- useContract(): Interacts with smart contract
- useGames(): Tracks game history
    ↓
State Management:
- Zustand stores (game, queue, UI state)
- React Query (server state caching)
```

### 2. Wallet Connection Layer
```
RainbowKit UI
    ↓
wagmi Hooks (useAccount, useBalance, useWriteContract)
    ↓
User's Wallet (MetaMask, Coinbase, etc.)
    ↓
Wallet's Built-in RPC Provider
    ↓
Blockchain Network (Sepolia/Amoy/Polygon)
```

### 3. Smart Contract Layer (On-Chain)
```
CoinFlip.sol (Deployed on blockchain)
    ↓
Player 1 calls createGame():
- Sends bet amount (e.g., 0.00001 ETH on testnet)
- Chooses Heads (0) or Tails (1)
- Contract holds funds in escrow
    ↓
Player 2 calls joinGame():
- Sends matching bet amount
- Automatically chooses opposite side
- Triggers Chainlink VRF request
    ↓
Chainlink VRF Coordinator:
- Generates verifiable random number
- Calls fulfillRandomWords()
    ↓
Contract determines winner:
- Random number % 2 = 0 (Heads) or 1 (Tails)
- Transfers 95% of pot to winner (5% fee)
- Emits GameResolved event
```

### 4. Backend Layer (Event Indexer)
```
Event Indexer Script (Node.js)
    ↓
Listens to blockchain events:
- GameCreated
- GameJoined
- GameResolved
    ↓
Processes events and writes to database:
- Updates game status
- Records winners/losers
- Calculates statistics
    ↓
Supabase PostgreSQL Database
```

### 5. Database Layer
```
Supabase PostgreSQL
    ↓
Tables:
- tiers: Bet tier definitions
- games: All game records
- players: Player statistics
    ↓
Real-time Subscriptions:
- Frontend subscribes to game updates
- Live queue counts
- Instant status changes
```

### 6. Data Flow Example (Complete Game)

**Step-by-Step:**

1. **User connects wallet** → RainbowKit + wagmi detect network
2. **useTiers() detects Sepolia** → Returns TESTNET_TIERS ($0.05-$1)
3. **User selects Tier 0 ($0.05)** → Zustand stores `selectedTier: 0`
4. **User picks Heads** → Stores `selectedChoice: 0`
5. **User clicks "Create Game"** → Frontend calls `contract.createGame(0, 0, { value: "10000000000000" })`
6. **Wallet prompts signature** → User approves transaction
7. **Contract emits GameCreated** → Event indexer writes to database
8. **Frontend shows "Waiting for opponent"** → Subscribes to game updates
9. **Player 2 joins** → Calls `contract.joinGame(gameId, { value: "10000000000000" })`
10. **Contract requests VRF** → Chainlink processes randomness
11. **VRF returns random number** → Contract calculates winner
12. **Contract transfers winnings** → 95% to winner, 5% fee retained
13. **GameResolved event** → Indexer updates database
14. **Real-time subscription** → Frontend shows result instantly

### 7. Network Detection & Tier Scaling

**Automatic Testnet Detection:**
```typescript
// lib/networkUtils.ts
const TESTNET_CHAIN_IDS = [11155111, 80002] // Sepolia, Amoy
const MAINNET_CHAIN_IDS = [1, 137]         // Ethereum, Polygon

// hooks/useTiers.ts
const chainId = useChainId() // Auto-detected from wallet
if (isTestnet(chainId)) {
  return TESTNET_TIERS // $0.05, $0.1, $0.25, $0.5, $1
} else {
  return PRODUCTION_TIERS // $5, $10, $25, $50, $100
}
```

**Why 100x smaller on testnet?**
- Sepolia faucets give ~0.5-2.5 ETH per day
- Production tiers (0.001-0.020 ETH) would be too expensive
- Testnet tiers (0.00001-0.001 ETH) allow thousands of test games
- Example: With 2.5 Sepolia ETH, you can play ~250,000 games on Tier 0!

## Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **wagmi** - React hooks for Ethereum
- **viem** - TypeScript Ethereum library
- **RainbowKit** - Beautiful wallet connection UI
- **Framer Motion** - Smooth animations
- **React Query** - Server state management
- **Zustand** - Client state management

### Blockchain
- **Ethereum Sepolia** - Recommended testnet (easiest faucets!)
- **Polygon Amoy** - Alternative testnet (Mumbai deprecated April 2024)
- **Polygon Mainnet** - Production network
- **Chainlink VRF V2.5** - Verifiable random function
- **Solidity 0.8.20** - Smart contract language

### Backend
- **Supabase** - PostgreSQL database + real-time subscriptions
- **Edge Functions** - Serverless API endpoints

## Getting Started

### Prerequisites

- Node.js 18+ installed
- pnpm package manager
- MetaMask or another Web3 wallet
- Testnet tokens: Sepolia ETH (recommended) or Polygon Amoy MATIC

### Installation

1. **Clone the repository**
   ```bash
   cd coinflip
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

   Fill in the required values:
   - `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`: Get from [WalletConnect Cloud](https://cloud.walletconnect.com)
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
   - `ALCHEMY_API_KEY`: Get from [Alchemy](https://www.alchemy.com) (server-side only for security)

4. **Set up the database**

   a. **Run database migrations** (first time only):
   ```bash
   pnpm migrate
   ```

   This will show you the SQL to execute in Supabase. Copy the output and run it in your Supabase SQL Editor.

   See [docs/archive/DATABASE_MIGRATIONS.md](./docs/archive/DATABASE_MIGRATIONS.md) for detailed migration instructions.

   b. **Verify database setup**:
   ```bash
   pnpm verify-db
   ```

   Or visit: [http://localhost:3000/admin/setup](http://localhost:3000/admin/setup)

   **Note:** The app works with mock data by default, so you can skip this step initially.

5. **Run the development server**
   ```bash
   pnpm dev
   ```

6. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Quick Reference

### Betting Tiers

**Testnet (Sepolia/Amoy) - Auto-detected:**
| Tier | Amount ETH | USD | Win Amount | Win USD |
|------|-----------|-----|------------|---------|
| 0 | 0.00001 | $0.05 | 0.000019 | $0.095 |
| 1 | 0.00005 | $0.10 | 0.000095 | $0.19 |
| 2 | 0.0001 | $0.25 | 0.00019 | $0.475 |
| 3 | 0.0005 | $0.50 | 0.00095 | $0.95 |
| 4 | 0.001 | $1.00 | 0.0019 | $1.90 |

**Mainnet (Ethereum/Polygon) - Auto-detected:**
| Tier | Amount ETH | USD | Win Amount | Win USD |
|------|-----------|-----|------------|---------|
| 0 | 0.001 | $5 | 0.0019 | $9.50 |
| 1 | 0.002 | $10 | 0.0038 | $19 |
| 2 | 0.005 | $25 | 0.0095 | $47.50 |
| 3 | 0.010 | $50 | 0.019 | $95 |
| 4 | 0.020 | $100 | 0.038 | $190 |

*Winner receives 95% of total pot (5% platform fee)*

### Deployed Contracts

- **Sepolia:** `0x0D24d83E396c96759294b2b0C5c6C64F7DB189CB`
- **Polygon Amoy:** `0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae`

### Common Commands
```bash
pnpm dev                    # Start development server
pnpm build                  # Build for production
npx hardhat compile         # Compile smart contracts
npx hardhat test            # Run contract tests
pnpm verify-db              # Check database setup
```

## For REAL Coinflip Testing

The database and frontend are ready, but to test actual blockchain transactions you need:

- ✅ Database migrations (completed above)
- ✅ Frontend UI (included)
- ✅ **Smart contract deployed** to Sepolia testnet
- ✅ **Chainlink VRF** subscription configured
- ✅ **Contract address** updated in `.env.local`
- ✅ **Tiers initialized** (auto-detects testnet/mainnet amounts)

**Current deployments:**
- Ethereum Sepolia (Chain ID: 11155111): `0x0D24d83E396c96759294b2b0C5c6C64F7DB189CB`
- Polygon Amoy (Chain ID: 80002): `0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae`

**Quick Start:**
- See [QUICK_START.md](./QUICK_START.md) for production setup (25 minutes)
- See [docs/guides/HOW_TO_PLAY.md](./docs/guides/HOW_TO_PLAY.md) for playing the game
- See [docs/guides/TESTING_GUIDE.md](./docs/guides/TESTING_GUIDE.md) for complete testing instructions
- See [TESTNET_CONVERTER.md](./TESTNET_CONVERTER.md) for testnet tier scaling details

## Project Structure

```
coinflip/
├── app/                      # Next.js app directory
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Home page
│   ├── play/                # Game creation page
│   ├── queue/               # Queue matching page
│   └── admin/               # Admin tools
├── components/              # React components
│   ├── layout/             # Layout components
│   ├── wallet/             # Wallet connection
│   ├── game/               # Game components (CoinChoice, TierSelector)
│   ├── queue/              # Queue/matching
│   ├── transaction/        # Transaction status
│   ├── ui/                 # Reusable UI components
│   └── Providers.tsx       # App providers (wagmi, React Query)
├── hooks/                   # Custom React hooks
│   ├── useContract.ts      # Contract interaction hook
│   ├── useTiers.ts         # Tier data hook
│   └── useGames.ts         # Game data hook
├── lib/                     # Utilities and configs
│   ├── contracts/          # Contract ABIs and addresses
│   ├── supabase.ts         # Supabase client
│   ├── wagmi.ts            # Web3 configuration
│   └── utils.ts            # Helper functions
├── store/                   # Zustand stores (game, queue, ui)
├── types/                   # TypeScript types
├── contracts/               # Solidity smart contracts
│   └── CoinFlip.sol        # Main game contract
├── scripts/                 # Deployment and utility scripts
│   ├── deploy.ts           # Contract deployment
│   ├── production-indexer.ts # Event indexer
│   └── verify-production-setup.ts # Setup verification
├── supabase/               # Database migrations
│   └── migrations/         # SQL migration files
├── test/                   # Smart contract tests
├── docs/                   # Organized documentation
│   ├── guides/            # User guides
│   └── archive/           # Reference docs
├── doc/                    # Technical specifications
└── public/                # Static assets
```

## Available Scripts

### Development Commands
```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server (after build)
pnpm start

# Clean build artifacts and caches
rm -rf .next node_modules/.cache .turbo

# Run TypeScript type checking
pnpm tsc --noEmit

# Run linter
pnpm lint

# Run security audit
pnpm audit
```

### Database Commands
```bash
# Run database migrations (first time setup)
pnpm migrate

# Verify database setup
pnpm verify-db

# Start local PostgreSQL (if using Docker)
pnpm db:start

# View database logs
pnpm db:logs

# Run production event indexer
pnpm indexer:prod
# Or manually: tsx scripts/production-indexer.ts
```

### Smart Contract Commands (Hardhat)
```bash
# Compile contracts
npx hardhat compile

# Run contract tests
npx hardhat test

# Deploy contract to Sepolia testnet
npx hardhat run scripts/deploy.ts --network sepolia

# Deploy to Polygon Amoy testnet
npx hardhat run scripts/deploy.ts --network amoy

# Initialize tiers on deployed contract (auto-detects testnet/mainnet)
npx hardhat run scripts/initialize-tiers.ts --network sepolia

# Verify production setup
tsx scripts/verify-production-setup.ts
```

### Useful Development Commands
```bash
# Kill all dev servers
pkill -9 -f "next dev"

# Kill process on specific port
lsof -ti:3000 | xargs kill -9

# View project structure
tree -L 2 -I 'node_modules|.next'

# Check disk usage
du -sh .next node_modules

# Find files by pattern
find . -name "*.ts" -not -path "*/node_modules/*"
```

## Next Steps

### 1. Smart Contract Development
- Read `doc/01_smart_contract_architecture.md`
- Implement CoinFlip.sol contract
- Set up Chainlink VRF subscription
- Deploy to Mumbai testnet
- Update contract address in `.env.local`

### 2. Frontend Implementation
- Read `doc/02_frontend_architecture.md`
- Implement tier selector component
- Create game flow components
- Add coin flip animation
- Build result screen

### 3. Backend Setup
- Read `doc/03_backend_database_architecture.md`
- Set up Supabase project (see [docs/guides/SETUP_SUPABASE.md](./docs/guides/SETUP_SUPABASE.md))
- Run database migrations in Supabase SQL Editor
- Verify database setup with `pnpm verify-db`
- Run production indexer with `pnpm indexer:prod`
- Set up real-time subscriptions

### 4. Testing & Security
- Read `doc/04_security_testing_audit.md`
- Write unit tests
- Conduct integration testing
- Security audit
- Bug bounty program

### 5. Deployment
- Read `doc/05_deployment_operations.md`
- Deploy to Vercel
- Configure monitoring
- Set up CI/CD
- Launch to production

## Documentation

All documentation has been organized into the `docs/` directory:

### Quick Reference

- **[README.md](./README.md)** - This file (project overview)
- **[QUICK_START.md](./QUICK_START.md)** - Fast setup guide for production
- **[docs/README.md](./docs/README.md)** - Complete documentation index

### Main Documentation Categories

1. **Technical Architecture** (`doc/`) - Deep technical specifications
   - Smart contract architecture
   - Frontend architecture
   - Backend/database design
   - Security and testing
   - Deployment operations

2. **User Guides** (`docs/guides/`) - Step-by-step instructions
   - How to play
   - Testing guides
   - Deployment guides
   - Supabase setup

3. **Reference** (`docs/archive/`) - Historical documentation and references

## Configuration

### Wallet Setup

1. Install MetaMask browser extension

2. Add Ethereum Sepolia testnet (recommended):
   - Network Name: Sepolia
   - RPC URL: https://rpc.sepolia.org
   - Chain ID: 11155111
   - Currency Symbol: ETH
   - Block Explorer: https://sepolia.etherscan.io

3. Get testnet ETH (Sepolia):
   - Alchemy Faucet: https://www.alchemy.com/faucets/ethereum-sepolia (0.5 ETH/day)
   - QuickNode Faucet: https://faucet.quicknode.com/ethereum/sepolia
   - Chainlink Faucet: https://faucets.chain.link/sepolia

**OR** for Polygon Amoy testnet:
   - Network Name: Polygon Amoy
   - RPC URL: https://rpc-amoy.polygon.technology
   - Chain ID: 80002
   - Currency Symbol: MATIC
   - Block Explorer: https://amoy.polygonscan.com

### Environment Variables

Required variables in `.env.local`:

```bash
# WalletConnect (required for wallet connection)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id

# Supabase (required for backend)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Network Configuration (Sepolia recommended)
NEXT_PUBLIC_CHAIN_ID=11155111  # Sepolia testnet (or 80002 for Amoy)

# Smart Contract Addresses
NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA=0x0D24d83E396c96759294b2b0C5c6C64F7DB189CB
NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_AMOY=0xD94991Babc68bA91Ec3B0c4B36fbA6f2d60385ae

# Alchemy RPC (optional but recommended - server-side only)
ALCHEMY_API_KEY=your_alchemy_key

# Private deployment variables (server-side only)
PRIVATE_KEY=your_wallet_private_key  # For contract deployment
VRF_SUBSCRIPTION_ID=your_vrf_subscription_id  # From vrf.chain.link
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
```

## Troubleshooting

### Wallet Connection Issues
- **Problem:** Wallet won't connect
  - Ensure you're on the correct network (Sepolia - Chain ID 11155111)
  - Clear browser cache and reconnect wallet
  - Check that `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` is set in `.env.local`

### Balance Not Loading ("Your Balance: 0 ETH")
- **Problem:** Balance shows 0 despite having testnet ETH
  - **Solution:** Disconnect and reconnect your wallet
  - Hard refresh browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
  - Check you're on the correct network in MetaMask
  - The app uses your wallet's built-in RPC provider (no external RPC needed)

### Build Errors
- **Problem:** TypeScript or build errors
  - Clean and rebuild: `rm -rf .next node_modules/.cache .turbo && pnpm build`
  - Delete `node_modules` and reinstall: `rm -rf node_modules && pnpm install`
  - Check Node.js version: `node -v` (18+ required)

### Transaction Failures
- **Problem:** Transactions failing or reverting
  - Ensure you have enough ETH/MATIC for gas fees (plus bet amount)
  - Check contract address is correct in `.env.local`
  - Verify network matches contract deployment (Sepolia = 11155111)
  - Check you're not trying to join your own game

### "Low balance" on all tiers
- **Fixed in latest version** - testnet tiers are now 100x smaller
  - Testnet Tier 0: Only 0.00001 ETH ($0.05) required
  - If still showing low balance: Disconnect/reconnect wallet and refresh
  - Check you have at least 0.00001 ETH on Sepolia testnet
  - Verify you're connected to the correct network (see NetworkIndicator)

### Dev Server Won't Start
- **Problem:** "Port 3000 in use" or lock file errors
  - Kill existing server: `pkill -9 -f "next dev"`
  - Kill process on port: `lsof -ti:3000 | xargs kill -9`
  - Remove lock file: `rm -rf .next/dev/lock`
  - Restart: `pnpm dev`

### RPC/Network Errors
- **Problem:** "Failed to fetch" or CORS errors
  - The app uses your wallet's built-in RPC (MetaMask, Coinbase)
  - No custom RPC configuration needed
  - Ensure wallet is connected and network is selected
  - Try switching networks in wallet and switching back

## Contributing

This is a reference implementation based on the comprehensive documentation in `doc/`.

To contribute:
1. Read the relevant documentation
2. Follow the coding patterns shown in examples
3. Write tests for new features
4. Follow security best practices
5. Submit PR with clear description

## Security

This application handles real cryptocurrency. Key security considerations:

- Smart contracts must be audited before mainnet deployment
- Never commit `.env.local` or private keys
- Test thoroughly on testnet first
- Implement rate limiting and abuse prevention
- Monitor for suspicious activity

See `doc/04_security_testing_audit.md` for complete security guidelines.

## License

MIT License - see LICENSE file for details

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [wagmi Documentation](https://wagmi.sh)
- [Chainlink VRF](https://docs.chain.link/vrf/v2/introduction)
- [Polygon Documentation](https://docs.polygon.technology/)
- [Supabase Documentation](https://supabase.com/docs)

## Support

For questions or issues:
1. Check the documentation in `doc/`
2. Review example implementations
3. Check troubleshooting section above
4. Open an issue with detailed description

---

**Built with ❤️ following the complete technical specification in `doc/`**
