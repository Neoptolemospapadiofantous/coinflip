'use client';

import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { useGameStore } from '@/store/gameStore';
import { Game } from '@/types/game';
import { playSound } from '@/lib/sounds';
import { devLog } from '@/lib/utils';

// Chainlink Automation auto-cancels after 5 minutes (25 blocks on Sepolia @ 12s/block)
// This is for UI display purposes only - actual cancellation is on-chain
export const AUTO_CANCEL_MS = 5 * 60 * 1000;

// Warning threshold - show warning when less than this time remaining
export const WARNING_THRESHOLD_MS = 60 * 1000; // 1 minute

// Poll interval when games are past auto-cancel threshold (check if DB updated)
const EXPIRED_POLL_INTERVAL_MS = 5000; // 5 seconds

/**
 * Calculate time remaining for any game based on created_at
 */
export function getGameTimeRemaining(game: Game): number {
  const createdAt = new Date(game.created_at);
  const autoCancelAt = createdAt.getTime() + AUTO_CANCEL_MS;
  const now = Date.now();
  return Math.max(0, autoCancelAt - now);
}

/**
 * Format time remaining as a string
 */
export function formatGameTimeRemaining(game: Game): string {
  const remaining = getGameTimeRemaining(game);
  if (remaining <= 0) return 'Expiring...';

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Check if a game is in warning state (< 1 minute remaining)
 */
export function isGameWarning(game: Game): boolean {
  const remaining = getGameTimeRemaining(game);
  return remaining > 0 && remaining <= WARNING_THRESHOLD_MS;
}

/**
 * Check if a game is expired (past auto-cancel time)
 */
export function isGameExpired(game: Game): boolean {
  return getGameTimeRemaining(game) <= 0;
}

/**
 * Hook to track time until Chainlink Automation auto-cancels pending games.
 *
 * NOTE: This hook is for UI display only. The actual auto-cancellation is
 * handled by Chainlink Automation on-chain after TIMEOUT_BLOCKS (25 blocks).
 *
 * Creators can cancel their games immediately - no waiting required.
 *
 * When games pass the auto-cancel threshold, this hook polls for DB updates
 * to ensure the UI reflects the on-chain state.
 */
export function useGameTimeout() {
  const { address } = useAccount();
  const { activeGames, queueModal } = useGameStore();
  const queryClient = useQueryClient();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  // Track which games have already shown expired modal to avoid duplicates
  const expiredModalShownRef = useRef<Set<string>>(new Set());

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

  // Calculate pending timeouts from user pending games (for display only)
  const pendingTimeouts = useMemo(() => {
    return userPendingGames.map((game) => {
      const createdAt = new Date(game.created_at);
      const autoCancelAt = new Date(createdAt.getTime() + AUTO_CANCEL_MS);
      return {
        gameId: game.id,
        createdAt,
        autoCancelAt,
      };
    });
  }, [userPendingGames]);

  // Calculate time remaining until Chainlink auto-cancel (for user's games)
  const getTimeRemaining = useCallback((gameId: string): number => {
    const timeout = pendingTimeouts.find((t) => t.gameId === gameId);
    if (!timeout) return 0;

    const now = new Date();
    const remaining = timeout.autoCancelAt.getTime() - now.getTime();
    return Math.max(0, remaining);
  }, [pendingTimeouts]);

  // Format time remaining as string (for user's games)
  const formatTimeRemaining = useCallback((gameId: string): string => {
    const remaining = getTimeRemaining(gameId);
    if (remaining <= 0) return 'Auto-cancelling...';

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }, [getTimeRemaining]);

  // Check if game is eligible for auto-cancel (past 5 min threshold)
  const isAutoCancelEligible = useCallback((gameId: string): boolean => {
    return getTimeRemaining(gameId) <= 0;
  }, [getTimeRemaining]);

  // Check if any games are past the auto-cancel threshold
  const hasExpiredGames = useMemo(() => {
    return pendingTimeouts.some(t => {
      const now = new Date();
      return now >= t.autoCancelAt;
    });
  }, [pendingTimeouts]);

  // Auto-trigger expired modal when games expire
  useEffect(() => {
    userPendingGames.forEach((game) => {
      const remaining = getGameTimeRemaining(game);

      // Game has expired and we haven't shown modal yet
      if (remaining <= 0 && !expiredModalShownRef.current.has(game.id)) {
        devLog.log(`⏰ [useGameTimeout] Game ${game.id} expired, showing modal`);
        expiredModalShownRef.current.add(game.id);
        playSound.error();
        queueModal(game, 'expired');
      }
    });
  }, [userPendingGames, queueModal]);

  // Clean up expired modal tracking when games are removed
  useEffect(() => {
    const activeGameIds = new Set(userPendingGames.map(g => g.id));
    expiredModalShownRef.current.forEach((gameId) => {
      if (!activeGameIds.has(gameId)) {
        expiredModalShownRef.current.delete(gameId);
      }
    });
  }, [userPendingGames]);

  // Poll for DB updates when games are past auto-cancel threshold
  // This ensures UI updates even if realtime subscription misses the event
  useEffect(() => {
    if (!hasExpiredGames) {
      // No expired games, stop polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Start polling for DB updates
    devLog.log('⏰ [useGameTimeout] Games past auto-cancel threshold, polling for updates...');

    const poll = () => {
      queryClient.invalidateQueries({ queryKey: ['games', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['games', 'active'] });
      if (address) {
        queryClient.invalidateQueries({ queryKey: ['games', 'player', address] });
      }
    };

    // Poll immediately
    poll();

    // Then poll every 5 seconds
    pollingRef.current = setInterval(poll, EXPIRED_POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [hasExpiredGames, queryClient, address]);

  return {
    pendingTimeouts,
    getTimeRemaining,
    formatTimeRemaining,
    isAutoCancelEligible,
    hasExpiredGames,
  };
}
