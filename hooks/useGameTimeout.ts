'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useGameStore } from '@/store/gameStore';
import { Game } from '@/types/game';

// Game timeout in milliseconds (20 minutes - matches contract TIMEOUT_BLOCKS = 100)
// On Sepolia: ~12 sec/block × 100 blocks = ~20 minutes
const GAME_TIMEOUT_MS = 20 * 60 * 1000;
// Check interval (every 30 seconds)
const CHECK_INTERVAL_MS = 30 * 1000;

// Persist expired game IDs across component lifecycles to prevent duplicate modals
// Limit size to prevent memory leak - oldest entries removed when over limit
const MAX_EXPIRED_CACHE_SIZE = 50;
const globalExpiredGameIds = new Set<string>();

function addToExpiredCache(gameId: string) {
  // If cache is full, remove oldest entries (first ones added)
  if (globalExpiredGameIds.size >= MAX_EXPIRED_CACHE_SIZE) {
    const iterator = globalExpiredGameIds.values();
    const oldest = iterator.next().value;
    if (oldest) globalExpiredGameIds.delete(oldest);
  }
  globalExpiredGameIds.add(gameId);
}

interface TimeoutInfo {
  gameId: string;
  createdAt: Date;
  timeoutAt: Date;
}

/**
 * Hook to monitor games that haven't been matched after 20 minutes
 * (matches contract TIMEOUT_BLOCKS = 100 blocks @ ~12 sec/block on Sepolia)
 * Shows a popup notification when a game expires (user must manually cancel)
 */
export function useGameTimeout() {
  const { address } = useAccount();
  const { activeGames, queueModal, removeActiveGame } = useGameStore();

  // Use a ref instead of state to avoid re-render loops
  const expiredGameIdsRef = useRef<Set<string>>(globalExpiredGameIds);
  const mountedRef = useRef(true);

  // Get user's pending games from active games (Map -> Array)
  const userPendingGames = useMemo(() => {
    const games: Game[] = [];
    activeGames.forEach((entry) => {
      const game = entry.game;
      if (
        game.status === 'pending' &&
        game.creator_address?.toLowerCase() === address?.toLowerCase()
      ) {
        games.push(game);
      }
    });
    return games;
  }, [activeGames, address]);

  // Calculate pending timeouts from user pending games (pure transformation, use useMemo)
  const pendingTimeouts = useMemo(() => {
    return userPendingGames.map((game) => {
      const createdAt = new Date(game.created_at);
      const timeoutAt = new Date(createdAt.getTime() + GAME_TIMEOUT_MS);
      return {
        gameId: game.id,
        createdAt,
        timeoutAt,
      };
    });
  }, [userPendingGames]);

  // Check for expired games and show notification (no auto-cancel)
  const checkExpiredGames = useCallback(() => {
    if (!mountedRef.current) return;

    const now = new Date();

    for (const timeout of pendingTimeouts) {
      // Skip if already notified about this game (check both local ref and global set)
      if (expiredGameIdsRef.current.has(timeout.gameId)) continue;
      if (globalExpiredGameIds.has(timeout.gameId)) continue;

      if (now >= timeout.timeoutAt) {
        console.log(`⏰ Game ${timeout.gameId} expired - showing notification`);

        // Find the game to show in popup
        const game = userPendingGames.find((g) => g.id === timeout.gameId);
        if (game) {
          // Mark as notified in both ref and global set (prevents duplicates across re-renders)
          expiredGameIdsRef.current.add(timeout.gameId);
          addToExpiredCache(timeout.gameId);

          // Queue an expired modal (user needs to manually cancel for refund)
          // Keep the original 'pending' status - don't fake it as cancelled
          queueModal(game, 'expired');

          // Don't remove from active games - user still needs to cancel
          // removeActiveGame(timeout.gameId);
        }
      }
    }
  }, [pendingTimeouts, userPendingGames, queueModal]);

  // Check for expired games periodically
  useEffect(() => {
    mountedRef.current = true;

    // Initial check
    checkExpiredGames();

    // Set up interval
    const interval = setInterval(checkExpiredGames, CHECK_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [checkExpiredGames]);

  // Calculate time remaining for each pending game
  const getTimeRemaining = useCallback((gameId: string): number => {
    const timeout = pendingTimeouts.find((t) => t.gameId === gameId);
    if (!timeout) return 0;

    const now = new Date();
    const remaining = timeout.timeoutAt.getTime() - now.getTime();
    return Math.max(0, remaining);
  }, [pendingTimeouts]);

  // Format time remaining as string
  const formatTimeRemaining = useCallback((gameId: string): string => {
    const remaining = getTimeRemaining(gameId);
    if (remaining <= 0) return 'Expired';

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }, [getTimeRemaining]);

  return {
    pendingTimeouts,
    getTimeRemaining,
    formatTimeRemaining,
    expiredGameIds: expiredGameIdsRef.current,
  };
}
