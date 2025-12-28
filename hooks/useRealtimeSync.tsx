'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useGameStore } from '@/store/gameStore';
import { Game, parseGame } from '@/types/game';
import { useAccount } from 'wagmi';

// Fallback polling with exponential backoff
const FALLBACK_POLL_INTERVALS = [5000, 10000, 20000, 30000]; // 5s, 10s, 20s, 30s max

/**
 * Centralized real-time sync manager
 *
 * This hook creates a SINGLE Supabase channel that listens to ALL game changes
 * and automatically:
 * 1. Invalidates relevant React Query caches
 * 2. Updates the Zustand store for active games
 * 3. Queues modals for matched/resolved games
 *
 * Components don't need their own subscriptions - they just read from
 * React Query or Zustand and get automatic updates.
 */
// Global connection state for components to access
let globalConnectionStatus: 'disconnected' | 'connecting' | 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' = 'disconnected';
let globalListeners: Array<() => void> = [];

// Subscribe to connection status changes
export function subscribeToConnectionStatus(callback: () => void) {
  globalListeners.push(callback);
  return () => {
    globalListeners = globalListeners.filter((l) => l !== callback);
  };
}

function notifyListeners() {
  globalListeners.forEach((l) => l());
}

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { updateActiveGame, addActiveGame, removeActiveGame, queueModal } = useGameStore();
  const [isConnected, setIsConnected] = useState(false);

  // Use refs to avoid recreating callbacks and breaking the subscription
  const queryClientRef = useRef(queryClient);
  const addressRef = useRef(address);
  const actionsRef = useRef({ updateActiveGame, addActiveGame, removeActiveGame, queueModal });
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackRetryCountRef = useRef(0);
  const initialPollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoRemoveTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const mountedRef = useRef(true);

  // Keep refs updated
  queryClientRef.current = queryClient;
  addressRef.current = address;
  actionsRef.current = { updateActiveGame, addActiveGame, removeActiveGame, queueModal };

  // Fallback polling function
  const fallbackPoll = () => {
    console.log('🔄 [RealtimeSync] Fallback polling...');
    queryClientRef.current.invalidateQueries({ queryKey: ['games', 'pending'] });
    queryClientRef.current.invalidateQueries({ queryKey: ['games', 'active'] });
    queryClientRef.current.invalidateQueries({ queryKey: ['game-stats'] });
    if (addressRef.current) {
      queryClientRef.current.invalidateQueries({ queryKey: ['games', 'player', addressRef.current] });
    }
  };

  // Setup single channel for all game updates - NO dependencies to prevent re-subscription
  useEffect(() => {
    console.log('📡 [RealtimeSync] Setting up centralized real-time sync...');
    globalConnectionStatus = 'connecting';

    const channel = supabase
      .channel('global-game-sync')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          const game = parseGame(payload.new);
          if (!game) {
            console.warn('🆕 [RealtimeSync] Received invalid game payload on INSERT');
            return;
          }
          console.log('🆕 [RealtimeSync] Game created:', game.id);

          // Invalidate pending games list
          queryClientRef.current.invalidateQueries({ queryKey: ['games', 'pending'] });
          queryClientRef.current.invalidateQueries({ queryKey: ['games', 'active'] });

          // If this is the user's game, add to active games
          const userAddress = addressRef.current?.toLowerCase();
          if (userAddress && game.creator_address?.toLowerCase() === userAddress) {
            actionsRef.current.addActiveGame(game);
          }

          // Update stats
          queryClientRef.current.invalidateQueries({ queryKey: ['game-stats'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          const game = parseGame(payload.new);
          if (!game) {
            console.warn('🔄 [RealtimeSync] Received invalid game payload on UPDATE');
            return;
          }
          // oldGame is partial and may be incomplete, just extract what we need
          const oldGame = payload.old as Partial<Game> | null;
          console.log('🔄 [RealtimeSync] Game updated:', game.id, oldGame?.status, '→', game.status);

          const userAddress = addressRef.current?.toLowerCase();
          const isUserGame = userAddress && (
            game.creator_address?.toLowerCase() === userAddress ||
            game.joiner_address?.toLowerCase() === userAddress
          );

          // Get cached data BEFORE updating (to detect status changes)
          const cachedGame = queryClientRef.current.getQueryData(['game', game.id]) as Game | undefined;
          const cachedPendingGames = queryClientRef.current.getQueryData(['games', 'pending']) as Game[] | undefined;
          const cachedStatus = cachedGame?.status || oldGame?.status;

          // Update specific game in cache
          queryClientRef.current.setQueryData(['game', game.id], game);
          const wasInPendingCache = cachedPendingGames?.some(g => g.id === game.id) ?? false;
          const isPending = game.status === 'pending';

          // If game was in pending cache but is no longer pending, remove it immediately
          if (wasInPendingCache && !isPending) {
            console.log('🔄 [RealtimeSync] Removing game from pending cache:', game.id, '→', game.status);
            queryClientRef.current.setQueryData(['games', 'pending'], (old: Game[] | undefined) =>
              old?.filter(g => g.id !== game.id) || []
            );
          } else if (!wasInPendingCache && isPending) {
            // Game became pending, refetch the list
            queryClientRef.current.invalidateQueries({ queryKey: ['games', 'pending'] });
          }

          // Always update active games list on status change
          queryClientRef.current.invalidateQueries({ queryKey: ['games', 'active'] });

          // If user is involved in this game
          if (isUserGame) {
            // cachedStatus was read before cache update above
            const statusChanged = cachedStatus !== game.status;

            // Update in store
            actionsRef.current.updateActiveGame(game);

            // Handle status transitions
            if (statusChanged) {
              console.log('🔄 [RealtimeSync] User game status changed:', game.id, cachedStatus, '→', game.status);
              if (game.status === 'matched') {
                actionsRef.current.queueModal(game, 'matched');
              } else if (game.status === 'resolved') {
                actionsRef.current.queueModal(game, 'resolved');
                // Auto-remove from active games after delay (tracked for cleanup)
                const timeoutId = setTimeout(() => {
                  autoRemoveTimeoutsRef.current.delete(timeoutId);
                  if (mountedRef.current) {
                    actionsRef.current.removeActiveGame(game.id);
                  }
                }, 5000);
                autoRemoveTimeoutsRef.current.add(timeoutId);
              } else if (game.status === 'cancelled') {
                actionsRef.current.removeActiveGame(game.id);
              }
            }

            // Invalidate player games
            queryClientRef.current.invalidateQueries({ queryKey: ['games', 'player', addressRef.current] });
          }

          // Update stats on resolved games
          if (game.status === 'resolved') {
            queryClientRef.current.invalidateQueries({ queryKey: ['game-stats'] });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          // DELETE payloads only contain the primary key in old
          const oldGame = payload.old as { id?: string } | null;
          const gameId = oldGame?.id;
          console.log('🗑️ [RealtimeSync] Game deleted:', gameId);

          if (gameId && typeof gameId === 'string') {
            queryClientRef.current.removeQueries({ queryKey: ['game', gameId] });
            actionsRef.current.removeActiveGame(gameId);
          }

          // Invalidate lists
          queryClientRef.current.invalidateQueries({ queryKey: ['games', 'pending'] });
          queryClientRef.current.invalidateQueries({ queryKey: ['games', 'active'] });
          queryClientRef.current.invalidateQueries({ queryKey: ['game-stats'] });
        }
      )
      .subscribe((status, err) => {
        console.log('📡 [RealtimeSync] Connection status:', status, err ? `Error: ${err.message}` : '');
        globalConnectionStatus = status as typeof globalConnectionStatus;
        notifyListeners();

        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          // Clear fallback polling when connected
          if (fallbackIntervalRef.current) {
            clearTimeout(fallbackIntervalRef.current);
            fallbackIntervalRef.current = null;
          }
          fallbackRetryCountRef.current = 0; // Reset backoff
          console.log('✅ [RealtimeSync] WebSocket connected - real-time updates active');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsConnected(false);
          console.warn('⚠️ [RealtimeSync] WebSocket disconnected - starting fallback polling');

          // Start fallback polling with exponential backoff
          const startFallbackPolling = () => {
            if (fallbackIntervalRef.current) {
              clearTimeout(fallbackIntervalRef.current);
            }

            fallbackPoll();

            // Get next interval with backoff
            const intervalIndex = Math.min(fallbackRetryCountRef.current, FALLBACK_POLL_INTERVALS.length - 1);
            const nextInterval = FALLBACK_POLL_INTERVALS[intervalIndex];
            fallbackRetryCountRef.current++;

            console.log(`🔄 [RealtimeSync] Next poll in ${nextInterval / 1000}s`);
            fallbackIntervalRef.current = setTimeout(startFallbackPolling, nextInterval);
          };

          if (!fallbackIntervalRef.current) {
            startFallbackPolling();
          }
        }
      });

    // Initial fallback poll to ensure data is fresh
    initialPollTimeoutRef.current = setTimeout(fallbackPoll, 1000);

    // Capture ref values for cleanup
    const autoRemoveTimeouts = autoRemoveTimeoutsRef.current;

    // Cleanup on unmount only
    return () => {
      console.log('🔌 [RealtimeSync] Cleaning up...');
      mountedRef.current = false;
      channel.unsubscribe();
      if (fallbackIntervalRef.current) {
        clearTimeout(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      if (initialPollTimeoutRef.current) {
        clearTimeout(initialPollTimeoutRef.current);
        initialPollTimeoutRef.current = null;
      }
      // Clear all auto-remove timeouts
      autoRemoveTimeouts.forEach((timeout) => clearTimeout(timeout));
      autoRemoveTimeouts.clear();
      globalConnectionStatus = 'disconnected';
      notifyListeners();
    };
  }, []); // Empty dependency array - subscription lives for component lifetime

  return isConnected;
}

// Export for debugging and components
export function getRealtimeStatus() {
  return globalConnectionStatus;
}

// Hook to get current connection status with automatic re-render on changes
export function useConnectionStatus() {
  const [status, setStatus] = useState(globalConnectionStatus);

  useEffect(() => {
    // Initial sync
    setStatus(globalConnectionStatus);

    // Subscribe to changes
    const unsubscribe = subscribeToConnectionStatus(() => {
      setStatus(globalConnectionStatus);
    });

    return unsubscribe;
  }, []);

  return {
    status,
    isConnected: status === 'SUBSCRIBED',
    isConnecting: status === 'connecting',
    isDisconnected: status === 'disconnected' || status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT',
  };
}

/**
 * Provider component that initializes the real-time sync
 * Add this to your root layout or providers
 */
export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  useRealtimeSync();
  return <>{children}</>;
}
