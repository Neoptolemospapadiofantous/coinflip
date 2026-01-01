'use client';

import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useGameStore } from '@/store/gameStore';
import { useUserActiveGames } from '@/hooks/useGames';
import { Game } from '@/types/game';
import { playSound } from '@/lib/sounds';
import { devLog } from '@/lib/utils';

// Chainlink Automation auto-cancels after 5 minutes (25 blocks on Sepolia @ 12s/block)
// This is for UI display purposes only - actual cancellation is on-chain
export const AUTO_CANCEL_MS = 5 * 60 * 1000;

// Warning threshold - show warning when less than this time remaining
export const WARNING_THRESHOLD_MS = 60 * 1000; // 1 minute

// NOTE: Polling removed - useRealtimeSync handles game status changes including cancellations
// When Chainlink Automation cancels a game, the realtime subscription detects the status
// change and automatically updates the UI via query invalidation.

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
 * Game status updates (including Chainlink cancellations) are handled by
 * useRealtimeSync which subscribes to postgres_changes on the games table.
 */
export function useGameTimeout() {
  const { address } = useAccount();
  const { queueModal } = useGameStore();
  // Use DB-backed active games instead of Zustand
  const { data: dbActiveGames = [] } = useUserActiveGames(address);
  // Track which games have already shown expired modal to avoid duplicates
  const expiredModalShownRef = useRef<Set<string>>(new Set());

  // Get user's pending games from DB (already filtered by user in useUserActiveGames)
  const userPendingGames = useMemo(() => {
    return dbActiveGames.filter(
      (game) =>
        game.status === 'pending' &&
        game.creator_address?.toLowerCase() === address?.toLowerCase()
    );
  }, [dbActiveGames, address]);

  // Create a Map for O(1) timeout lookups (instead of O(n) array.find)
  const pendingTimeoutsMap = useMemo(() => {
    const map = new Map<string, { createdAt: Date; autoCancelAt: Date }>();
    userPendingGames.forEach((game) => {
      const createdAt = new Date(game.created_at);
      const autoCancelAt = new Date(createdAt.getTime() + AUTO_CANCEL_MS);
      map.set(game.id, { createdAt, autoCancelAt });
    });
    return map;
  }, [userPendingGames]);

  // Array version for iteration (derived from Map)
  const pendingTimeouts = useMemo(() => {
    return Array.from(pendingTimeoutsMap.entries()).map(([gameId, times]) => ({
      gameId,
      ...times,
    }));
  }, [pendingTimeoutsMap]);

  // Calculate time remaining until Chainlink auto-cancel (for user's games)
  // Uses Map for O(1) lookup instead of O(n) array.find
  const getTimeRemaining = useCallback((gameId: string): number => {
    const timeout = pendingTimeoutsMap.get(gameId);
    if (!timeout) return 0;

    const remaining = timeout.autoCancelAt.getTime() - Date.now();
    return Math.max(0, remaining);
  }, [pendingTimeoutsMap]);

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

  // NOTE: Polling removed - useRealtimeSync handles game cancellation via postgres_changes
  // When Chainlink Automation cancels games, the realtime subscription detects the UPDATE
  // and automatically invalidates queries, updating the UI.

  return {
    pendingTimeouts,
    getTimeRemaining,
    formatTimeRemaining,
    isAutoCancelEligible,
  };
}
