'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useCancelGame } from './useContract';
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
 * Hook to auto-cancel games that haven't been matched after 15 minutes
 * Shows a popup when a game is auto-cancelled
 */
export function useGameTimeout() {
  const { address } = useAccount();
  const { cancelGame, isLoading: isCanceling, isSuccess, reset } = useCancelGame();
  const { activeGames, queueModal, removeActiveGame } = useGameStore();

  const [pendingTimeouts, setPendingTimeouts] = useState<TimeoutInfo[]>([]);
  const [autoCancelledGame, setAutoCancelledGame] = useState<Game | null>(null);
  const cancelingGameIdRef = useRef<string | null>(null);
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

  // Auto-cancel expired games
  const checkAndCancelExpired = useCallback(() => {
    if (!mountedRef.current || isCanceling || cancelingGameIdRef.current) return;

    const now = new Date();

    for (const timeout of pendingTimeouts) {
      if (now >= timeout.timeoutAt) {
        console.log(`⏰ Game ${timeout.gameId} expired, auto-cancelling...`);

        // Find the game to show in popup
        const game = userPendingGames.find((g) => g.id === timeout.gameId);
        if (game) {
          cancelingGameIdRef.current = timeout.gameId;
          setAutoCancelledGame(game);
          cancelGame(timeout.gameId);
        }

        // Only cancel one game at a time
        break;
      }
    }
  }, [pendingTimeouts, userPendingGames, isCanceling, cancelGame]);

  // Check for expired games periodically
  useEffect(() => {
    mountedRef.current = true;

    // Initial check
    checkAndCancelExpired();

    // Set up interval
    const interval = setInterval(checkAndCancelExpired, CHECK_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [checkAndCancelExpired]);

  // Handle successful cancellation
  useEffect(() => {
    if (isSuccess && cancelingGameIdRef.current && autoCancelledGame) {
      console.log(`✅ Game ${cancelingGameIdRef.current} auto-cancelled successfully`);

      // Remove from active games
      removeActiveGame(cancelingGameIdRef.current);

      // Queue a timeout modal
      queueModal(
        { ...autoCancelledGame, status: 'cancelled' } as Game,
        'timeout'
      );

      // Reset state
      cancelingGameIdRef.current = null;
      setAutoCancelledGame(null);
      reset();
    }
  }, [isSuccess, autoCancelledGame, removeActiveGame, queueModal, reset]);

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
    if (remaining <= 0) return 'Expiring...';

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
    isCanceling,
    autoCancelledGame,
  };
}
