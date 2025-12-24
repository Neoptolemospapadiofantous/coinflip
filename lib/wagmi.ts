import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { polygon, polygonAmoy, sepolia } from 'wagmi/chains';

// Get Alchemy API key from env
const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

// Configure custom transports with multiple RPC fallbacks
export const config = getDefaultConfig({
  appName: 'CoinFlip',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '',
  chains: [
    sepolia,
    polygonAmoy,
    ...(process.env.NODE_ENV === 'production' ? [polygon] : []),
  ],
  transports: {
    [sepolia.id]: http(
      alchemyKey
        ? `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`
        : 'https://rpc.sepolia.org',
      {
        batch: true,
        retryCount: 3,
        timeout: 10_000,
      }
    ),
    [polygonAmoy.id]: http(
      alchemyKey
        ? `https://polygon-amoy.g.alchemy.com/v2/${alchemyKey}`
        : 'https://rpc-amoy.polygon.technology',
      {
        batch: true,
        retryCount: 3,
        timeout: 10_000,
      }
    ),
    [polygon.id]: http(
      alchemyKey
        ? `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`
        : 'https://polygon-rpc.com',
      {
        batch: true,
        retryCount: 3,
        timeout: 10_000,
      }
    ),
  },
  ssr: true,
});
