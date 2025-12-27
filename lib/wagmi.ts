import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { polygon, polygonAmoy, sepolia } from 'wagmi/chains';

// Create a custom transport that uses our API proxy to avoid CORS issues
// The proxy route forwards requests to the actual RPC (Alchemy or public)
const createProxyTransport = (chainId: number) => {
  return http('/api/rpc', {
    fetchOptions: {
      headers: {
        'x-chain-id': chainId.toString(),
      },
    },
  });
};

export const config = getDefaultConfig({
  appName: 'CoinFlip',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '',
  chains: [
    sepolia,
    polygonAmoy,
    ...(process.env.NODE_ENV === 'production' ? [polygon] : []),
  ],
  transports: {
    [sepolia.id]: createProxyTransport(sepolia.id),
    [polygonAmoy.id]: createProxyTransport(polygonAmoy.id),
    [polygon.id]: createProxyTransport(polygon.id),
  },
  ssr: true,
});
