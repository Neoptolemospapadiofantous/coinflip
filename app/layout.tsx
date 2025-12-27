import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@radix-ui/themes/styles.css';
import './globals.css';
import { Providers } from '@/components/Providers';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ActiveGamesPanel } from '@/components/game/ActiveGamesPanel';

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
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ThemeProvider>
          <ErrorBoundary>
            <Providers>
              {children}
              <ActiveGamesPanel />
            </Providers>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
