import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CoinFlip - Provably Fair Crypto Gambling',
  description: 'Non-custodial crypto coin-flip gambling game with provably fair randomness using Chainlink VRF',
  keywords: ['web3', 'crypto', 'gambling', 'coinflip', 'blockchain', 'polygon'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
