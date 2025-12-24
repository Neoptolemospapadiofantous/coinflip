import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygon, polygonAmoy, sepolia } from 'wagmi/chains';

// Use default RainbowKit configuration
// This will use the wallet's built-in RPC provider (MetaMask, Coinbase, etc.)
// which avoids CORS issues with public RPCs
export const config = getDefaultConfig({
  appName: 'CoinFlip',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '',
  chains: [
    sepolia, // Ethereum Sepolia testnet (uses wallet's RPC)
    polygonAmoy, // Polygon Amoy testnet
    ...(process.env.NODE_ENV === 'production' ? [polygon] : []),
  ],
  ssr: true,
});
