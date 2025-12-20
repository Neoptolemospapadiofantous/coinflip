# CoinFlip - Provably Fair Crypto Gambling

A non-custodial crypto coin-flip gambling game built with Next.js, wagmi, and Chainlink VRF for provably fair randomness.

## Features

- **Provably Fair**: Uses Chainlink VRF for verifiable randomness
- **Non-Custodial**: Smart contract holds funds, you control your wallet
- **Instant Payouts**: Automatic payouts directly to winners
- **Tier-Based Betting**: Fixed tiers ($5, $10, $25, $50, $100)
- **Real-time Updates**: Live game status with Supabase
- **Mobile-First**: Responsive design optimized for all devices

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
- **Polygon Mumbai** - Low-cost testnet (development)
- **Polygon Mainnet** - Production network
- **Chainlink VRF** - Verifiable random function
- **Solidity** - Smart contract language

### Backend
- **Supabase** - PostgreSQL database + real-time subscriptions
- **Edge Functions** - Serverless API endpoints

## Getting Started

### Prerequisites

- Node.js 18+ installed
- pnpm package manager
- MetaMask or another Web3 wallet
- Polygon Mumbai testnet MATIC (for testing)

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
   - `NEXT_PUBLIC_ALCHEMY_API_KEY`: Get from [Alchemy](https://www.alchemy.com)

4. **Run the development server**
   ```bash
   pnpm dev
   ```

5. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
coinflip/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── layout/           # Layout components
│   ├── wallet/           # Wallet connection
│   ├── game/             # Game components
│   ├── queue/            # Queue/matching
│   ├── transaction/      # Transaction status
│   ├── ui/               # Reusable UI components
│   └── Providers.tsx     # App providers
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and configs
│   ├── contracts/        # Contract ABIs and addresses
│   ├── utils/            # Helper functions
│   └── wagmi.ts          # Web3 configuration
├── store/                 # Zustand stores
├── types/                 # TypeScript types
├── public/               # Static assets
└── doc/                  # Complete documentation
```

## Available Scripts

```bash
# Development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint

# Format code
pnpm format
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
- Set up Supabase project
- Create database schema
- Implement event indexer
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

Complete technical documentation is available in the `doc/` folder:

- **00_README.md** - Master index and overview
- **01_smart_contract_architecture.md** - Solidity implementation
- **02_frontend_architecture.md** - React/Web3 frontend
- **03_backend_database_architecture.md** - Supabase backend
- **04_security_testing_audit.md** - Security best practices
- **05_deployment_operations.md** - Production deployment
- **06_VRF_randomness_implementation.md** - Chainlink VRF guide
- **07_UX_design_user_flows.md** - UX specifications

## Configuration

### Wallet Setup

1. Install MetaMask browser extension
2. Add Polygon Mumbai testnet:
   - Network Name: Polygon Mumbai
   - RPC URL: https://rpc-mumbai.maticvigil.com
   - Chain ID: 80001
   - Currency Symbol: MATIC
   - Block Explorer: https://mumbai.polygonscan.com

3. Get testnet MATIC:
   - Visit [Polygon Faucet](https://faucet.polygon.technology/)
   - Enter your wallet address
   - Request testnet MATIC

### Environment Variables

Required variables in `.env.local`:

```bash
# WalletConnect (required for wallet connection)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id

# Supabase (required for backend)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Network Configuration
NEXT_PUBLIC_CHAIN_ID=80001  # Mumbai testnet

# Smart Contract (deploy contract first)
NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_MUMBAI=0x...

# Alchemy RPC (optional but recommended)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
```

## Troubleshooting

### Wallet Connection Issues
- Ensure you're on the correct network (Polygon Mumbai)
- Clear browser cache and reconnect wallet
- Check that WalletConnect Project ID is correct

### Build Errors
- Delete `.next` folder and rebuild
- Delete `node_modules` and run `pnpm install`
- Check Node.js version (18+ required)

### Transaction Failures
- Ensure you have enough MATIC for gas
- Check contract address is correct
- Verify network is Polygon Mumbai (testnet)

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
