import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygon, polygonMumbai } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'CoinFlip',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '',
  chains: [
    polygonMumbai, // Testnet
    ...(process.env.NODE_ENV === 'production' ? [polygon] : []),
  ],
  ssr: true,
});
