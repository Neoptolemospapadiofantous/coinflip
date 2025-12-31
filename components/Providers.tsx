'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import { useState } from 'react';
import { GameMonitor } from './GameMonitor';
import { RealtimeSyncProvider } from '@/hooks/useRealtimeSync';

import '@rainbow-me/rainbowkit/styles.css';

// NOTE: GlobalTransactionWatcher removed - now using DB-backed pending_transactions
// with real-time subscriptions instead of polling blockchain

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <RealtimeSyncProvider>
            {children}
            <GameMonitor />
          </RealtimeSyncProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
