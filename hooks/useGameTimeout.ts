'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useGameStore } from '@/store/gameStore';
import { Game } from '@/types/game';

// Game timeout in milliseconds (15 minutes)
const GAME_TIMEOUT_MS = 15 * 60 * 1000;
// Check interval (every 30 seconds)
const CHECK_INTERVAL_MS = 30 * 1000;

interface TimeoutInfo {
  gameId: string;
  createdAt: Date;
  timeoutAt: Date;
}

/**
 * Hook to monitor games that haven't been matched after 15 minutes
 * Shows a popup notification when a game expires (user must manually cancel)
 */
export function useGameTimeout() {
  const { address } = useAccount();
  const { activeGames, queueModal, removeActiveGame } = useGameStore();

  const [pendingTimeouts, setPendingTimeouts] = useState<TimeoutInfo[]>([]);
  const [expiredGameIds, setExpiredGameIds] = useState<Set<string>>(new Set());
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

  // Update pending timeouts when user pending games change
  useEffect(() => {
    const timeouts: TimeoutInfo[] = userPendingGames.map((game) => {
      const createdAt = new Date(game.created_at);
      const timeoutAt = new Date(createdAt.getTime() + GAME_TIMEOUT_MS);
      return {
        gameId: game.id,
        createdAt,
        timeoutAt,
      };
    });
    setPendingTimeouts(timeouts);
  }, [userPendingGames]);

  // Check for expired games and show notification (no auto-cancel)
  const checkExpiredGames = useCallback(() => {
    if (!mountedRef.current) return;

    const now = new Date();

    for (const timeout of pendingTimeouts) {
      // Skip if already notified about this game
      if (expiredGameIds.has(timeout.gameId)) continue;

      if (now >= timeout.timeoutAt) {
        console.log(`⏰ Game ${timeout.gameId} expired - showing notification`);

        // Find the game to show in popup
        const game = userPendingGames.find((g) => g.id === timeout.gameId);
        if (game) {
          // Mark as notified
          setExpiredGameIds((prev) => new Set(prev).add(timeout.gameId));

          // Queue a timeout modal (user needs to manually cancel)
          queueModal(
            { ...game, status: 'cancelled' } as Game,
            'timeout'
          );

          // Remove from active games UI (but not cancelled on-chain yet)
          removeActiveGame(timeout.gameId);
        }
      }
    }
  }, [pendingTimeouts, userPendingGames, expiredGameIds, queueModal, removeActiveGame]);

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
    expiredGameIds,
  };
}
