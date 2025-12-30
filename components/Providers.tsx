'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import { useState } from 'react';
import { GameMonitor } from './GameMonitor';
import { RealtimeSyncProvider } from '@/hooks/useRealtimeSync';
import { usePendingTransactionWatcher } from '@/hooks/usePendingTransactionWatcher';

import '@rainbow-me/rainbowkit/styles.css';

// Component that runs the global transaction watcher
function GlobalTransactionWatcher() {
  usePendingTransactionWatcher();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <RealtimeSyncProvider>
            {children}
            <GameMonitor />
            <GlobalTransactionWatcher />
          </RealtimeSyncProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
