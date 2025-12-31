'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useGameStore } from '@/store/gameStore';
import { useGameLimits } from '@/hooks/usePendingTransactions';
import { showToast } from '@/lib/toast';
import { playSound } from '@/lib/sounds';
import { devLog } from '@/lib/utils';

/**
 * Hook to detect wallet address changes during an active session
 * Shows warnings when user switches wallets while having active games
 */
export function useWalletChangeDetection() {
  const { address, isConnected } = useAccount();
  const previousAddressRef = useRef<string | null>(null);
  const { clearAllActiveGames } = useGameStore();
  // Use DB-backed game count instead of Zustand
  const { activeGamesCount } = useGameLimits();
  const hasShownWarningRef = useRef(false);

  // Track wallet changes
  useEffect(() => {
    // Initialize on first render
    if (previousAddressRef.current === null && address) {
      previousAddressRef.current = address.toLowerCase();
      hasShownWarningRef.current = false;
      return;
    }

    // Detect wallet change
    if (address && previousAddressRef.current) {
      const currentAddress = address.toLowerCase();
      const previousAddress = previousAddressRef.current;

      if (currentAddress !== previousAddress) {
        devLog.log(`🔄 Wallet changed from ${previousAddress.slice(0, 8)}... to ${currentAddress.slice(0, 8)}...`);

        // Check if there were active games with the previous wallet (DB-backed)
        const hasActiveGames = activeGamesCount > 0;

        if (hasActiveGames && !hasShownWarningRef.current) {
          hasShownWarningRef.current = true;
          playSound.error();
          showToast.warning('Wallet changed - Active games from previous wallet are no longer visible');

          // Clear active games from the previous wallet (clears Zustand state)
          clearAllActiveGames();
        }

        previousAddressRef.current = currentAddress;
      }
    }

    // Handle disconnect
    if (!address && previousAddressRef.current) {
      devLog.log('🔌 Wallet disconnected');
      previousAddressRef.current = null;
      hasShownWarningRef.current = false;
    }

    // Handle new connection
    if (address && !previousAddressRef.current) {
      previousAddressRef.current = address.toLowerCase();
      hasShownWarningRef.current = false;
    }
  }, [address, activeGamesCount, clearAllActiveGames]);

  // Reset warning flag when games change
  useEffect(() => {
    if (activeGamesCount === 0) {
      hasShownWarningRef.current = false;
    }
  }, [activeGamesCount]);

  const getCurrentWallet = useCallback(() => {
    return address?.toLowerCase() || null;
  }, [address]);

  const isWalletConnected = useCallback(() => {
    return isConnected && !!address;
  }, [isConnected, address]);

  return {
    currentWallet: address?.toLowerCase() || null,
    isConnected,
    getCurrentWallet,
    isWalletConnected,
  };
}
