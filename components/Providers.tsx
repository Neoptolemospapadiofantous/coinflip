'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import { useState, useEffect } from 'react';
import { GameMonitor } from './GameMonitor';
import { RealtimeSyncProvider } from '@/hooks/useRealtimeSync';
import { devLog } from '@/lib/utils';
import { showToast } from '@/lib/toast';

import '@rainbow-me/rainbowkit/styles.css';

// NOTE: GlobalTransactionWatcher removed - now using DB-backed pending_transactions
// with real-time subscriptions instead of polling blockchain

/**
 * Global error handler for unhandled promise rejections
 * Catches async errors that escape React's error boundary
 */
function GlobalErrorHandler({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Don't show user-cancelled wallet errors
      const errorMessage = event.reason?.message || String(event.reason);
      const isUserCancel = errorMessage.includes('User rejected') ||
                          errorMessage.includes('User denied') ||
                          errorMessage.includes('user rejected');

      if (isUserCancel) {
        devLog.log('ℹ️ User cancelled action');
        return;
      }

      devLog.error('Unhandled promise rejection:', event.reason);

      // Show toast for user-facing errors (but not for dev/network issues)
      const isNetworkError = errorMessage.includes('fetch') ||
                            errorMessage.includes('network') ||
                            errorMessage.includes('CORS');

      if (!isNetworkError) {
        showToast.error('Something went wrong. Please try again.');
      }
    };

    const handleError = (event: ErrorEvent) => {
      devLog.error('Uncaught error:', event.error);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <GlobalErrorHandler>
            <RealtimeSyncProvider>
              {children}
              <GameMonitor />
            </RealtimeSyncProvider>
          </GlobalErrorHandler>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
