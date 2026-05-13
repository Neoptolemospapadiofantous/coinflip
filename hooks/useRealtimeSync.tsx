'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useGameStore } from '@/store/gameStore';
import { Game, parseGame } from '@/types/game';
import { useAccount } from 'wagmi';
import { devLog, debounce } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import { useIsLoggedIn } from '@/lib/data';
import {
  FALLBACK_POLL_INTERVALS_MS,
  REALTIME_DEBOUNCE_MS,
  MAX_CONNECTION_LISTENERS,
  CONNECTION_STATUS_DEBOUNCE_MS,
} from '@/lib/constants';

// Add jitter to prevent thundering herd (returns random offset between -25% and +25%)
function addJitter(interval: number): number {
  const jitterRange = interval * 0.25; // 25% jitter
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;
  return Math.max(1000, interval + jitter); // Minimum 1 second
}

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
let globalIsPolling = false;
// Use Set to prevent duplicate listeners and ensure O(1) removal
const globalListeners = new Set<() => void>();

// Subscribe to connection status changes (with memory leak protection)
export function subscribeToConnectionStatus(callback: () => void) {
  // Prevent memory leaks - limit max listeners
  if (globalListeners.size >= MAX_CONNECTION_LISTENERS) {
    devLog.warn('[RealtimeSync] Max listeners reached, cleaning oldest');
    const first = globalListeners.values().next().value;
    if (first) globalListeners.delete(first);
  }
  globalListeners.add(callback);
  return () => {
    globalListeners.delete(callback);
  };
}

// Debounced notify to prevent UI flickering during rapid status changes
const notifyListeners = debounce(() => {
  globalListeners.forEach((l) => l());
}, CONNECTION_STATUS_DEBOUNCE_MS);

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { updateActiveGame, addActiveGame, removeActiveGame } = useGameStore();
  const [isConnected, setIsConnected] = useState(false);
  const isLoggedIn = useIsLoggedIn();

  // Use refs to avoid recreating callbacks and breaking the subscription
  const queryClientRef = useRef(queryClient);
  const addressRef = useRef(address);
  const actionsRef = useRef({ updateActiveGame, addActiveGame, removeActiveGame });
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackRetryCountRef = useRef(0);
  // Map game ID -> timeout for auto-removal (prevents duplicate timeouts)
  const autoRemoveTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const mountedRef = useRef(true);

  // Keep refs updated
  queryClientRef.current = queryClient;
  addressRef.current = address;
  actionsRef.current = { updateActiveGame, addActiveGame, removeActiveGame };

  // Batched invalidation helper - reduces re-renders from multiple invalidations
  const batchInvalidate = useMemo(() => {
    return debounce((keys: readonly (readonly unknown[])[]) => {
      devLog.log('🔄 [RealtimeSync] Batch invalidating', keys.length, 'queries');
      keys.forEach(queryKey => {
        queryClientRef.current.invalidateQueries({ queryKey });
      });
    }, REALTIME_DEBOUNCE_MS);
  }, []);

  // Fallback polling function
  const fallbackPoll = () => {
    devLog.log('🔄 [RealtimeSync] Fallback polling...');
    const keys: (readonly unknown[])[] = [
      queryKeys.games.pending,
      queryKeys.games.active,
      queryKeys.stats.game,
    ];
    if (addressRef.current) {
      const lowerAddress = addressRef.current.toLowerCase();
      keys.push(queryKeys.games.player(addressRef.current));
      keys.push(queryKeys.games.userActive(lowerAddress));
    }
    // Invalidate all at once (React Query batches within same tick)
    keys.forEach(queryKey => {
      queryClientRef.current.invalidateQueries({ queryKey });
    });
  };

  // Store isLoggedIn in ref for use in effect
  const isLoggedInRef = useRef(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;

  // Setup single channel for all game updates - only in centralized mode
  useEffect(() => {
    // Skip Supabase subscriptions in decentralized mode
    if (!isLoggedInRef.current) {
      return;
    }

    devLog.log('📡 [RealtimeSync] Setting up centralized real-time sync...');
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
          try {
            const game = parseGame(payload.new);
            if (!game) {
              devLog.warn('🆕 [RealtimeSync] Received invalid game payload on INSERT');
              return;
            }
            devLog.log('🆕 [RealtimeSync] Game created:', game.id, 'status:', game.status);

            // Remove any optimistic game with matching tx_hash (ensure lowercase match)
            const txHashPrefix = game.tx_hash?.toLowerCase().slice(0, 10) || '';
            const optimisticId = txHashPrefix ? `optimistic-${txHashPrefix}` : '';

            // Add new pending game directly to cache for instant UI update
            // Using setQueryData instead of invalidate to avoid redundant refetch
            if (game.status === 'pending') {
              queryClientRef.current.setQueryData(queryKeys.games.pending, (old: Game[] | undefined) => {
                if (!old) return [game];
                // Remove optimistic version (if exists) and avoid duplicates
                const filtered = old.filter(g =>
                  (optimisticId ? g.id !== optimisticId : true) && g.id !== game.id
                );
                return [game, ...filtered]; // Add real game to front
              });
              // Only invalidate active games (lightweight) - pending cache is already updated
              batchInvalidate([queryKeys.games.active, queryKeys.stats.game]);
            } else {
              // For non-pending games (rare on INSERT), batch invalidate
              batchInvalidate([queryKeys.games.pending, queryKeys.games.active, queryKeys.stats.game]);
            }

            // If this is the user's game, add directly to userActive cache for instant UI
            const userAddress = addressRef.current?.toLowerCase();
            if (userAddress && game.creator_address?.toLowerCase() === userAddress) {
              devLog.log('🎯 [RealtimeSync] Adding game to userActive cache:', game.id);
              actionsRef.current.updateActiveGame(game);
              // Add to userActive cache directly (not invalidate) to prevent race with pending tx removal
              queryClientRef.current.setQueryData(queryKeys.games.userActive(userAddress), (old: Game[] | undefined) => {
                devLog.log('🎯 [RealtimeSync] userActive cache update - old:', old?.length, 'adding game:', game.id);
                if (!old) return [game];
                // Avoid duplicates
                if (old.some(g => g.id === game.id)) return old;
                return [game, ...old];
              });
            }
          } catch (error) {
            devLog.error('🆕 [RealtimeSync] Error processing INSERT:', error);
          }
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
          try {
            const game = parseGame(payload.new);
            if (!game) {
              devLog.warn('🔄 [RealtimeSync] Received invalid game payload on UPDATE');
              return;
            }
            // oldGame is partial and may be incomplete, just extract what we need
            const oldGame = payload.old as Partial<Game> | null;
            devLog.log('🔄 [RealtimeSync] Game updated:', game.id, oldGame?.status, '→', game.status);

            const userAddress = addressRef.current?.toLowerCase();
            const isUserGame = userAddress && (
              game.creator_address?.toLowerCase() === userAddress ||
              game.joiner_address?.toLowerCase() === userAddress
            );

            // Get cached data BEFORE updating (to detect status changes)
            const cachedGame = queryClientRef.current.getQueryData(queryKeys.games.single(game.id)) as Game | undefined;
            const cachedPendingGames = queryClientRef.current.getQueryData(queryKeys.games.pending) as Game[] | undefined;
            const cachedStatus = cachedGame?.status || oldGame?.status;

            // Update specific game in cache
            queryClientRef.current.setQueryData(queryKeys.games.single(game.id), game);
            const wasInPendingCache = cachedPendingGames?.some(g => g.id === game.id) ?? false;
            const isPending = game.status === 'pending';

            // Collect keys to invalidate for batching
            const keysToInvalidate: (readonly unknown[])[] = [queryKeys.games.active];

            // If game was in pending cache but is no longer pending, remove it immediately
            if (wasInPendingCache && !isPending) {
              devLog.log('🔄 [RealtimeSync] Removing game from pending cache:', game.id, '→', game.status);
              queryClientRef.current.setQueryData(queryKeys.games.pending, (old: Game[] | undefined) =>
                old?.filter(g => g.id !== game.id) || []
              );
            } else if (!wasInPendingCache && isPending) {
              // Game became pending, add to batch
              keysToInvalidate.push(queryKeys.games.pending);
            } else if (!isPending && (game.status === 'cancelled' || game.status === 'matched' || game.status === 'resolved')) {
              // Fallback: if game left pending state but wasn't in our cache, add to batch
              devLog.log('🔄 [RealtimeSync] Game status changed, will invalidate pending list:', game.id, '→', game.status);
              keysToInvalidate.push(queryKeys.games.pending);
            }

            // If user is involved in this game
            if (isUserGame && userAddress) {
              // cachedStatus was read before cache update above
              const statusChanged = cachedStatus !== game.status;

              // Update in store
              actionsRef.current.updateActiveGame(game);

              // Handle status transitions
              // NOTE: Modal queuing is handled by useActiveGameMonitor with DB-backed deduplication
              // This hook only handles cache updates and active game state management
              if (statusChanged) {
                devLog.log('🔄 [RealtimeSync] User game status changed:', game.id, cachedStatus, '→', game.status);
                if (game.status === 'resolved') {
                  // Auto-remove from active games after delay (prevent duplicates)
                  const existingTimeout = autoRemoveTimeoutsRef.current.get(game.id);
                  if (existingTimeout) {
                    clearTimeout(existingTimeout);
                  }
                  const timeoutId = setTimeout(() => {
                    autoRemoveTimeoutsRef.current.delete(game.id);
                    if (mountedRef.current) {
                      actionsRef.current.removeActiveGame(game.id);
                    }
                  }, 5000);
                  autoRemoveTimeoutsRef.current.set(game.id, timeoutId);
                } else if (game.status === 'cancelled') {
                  // Clear any pending auto-remove timeout
                  const existingTimeout = autoRemoveTimeoutsRef.current.get(game.id);
                  if (existingTimeout) {
                    clearTimeout(existingTimeout);
                    autoRemoveTimeoutsRef.current.delete(game.id);
                  }
                  actionsRef.current.removeActiveGame(game.id);
                }
              }

              // Add user-specific queries to batch
              keysToInvalidate.push(queryKeys.games.player(userAddress));
              keysToInvalidate.push(queryKeys.games.userActive(userAddress));
            }

            // Update stats on resolved games
            if (game.status === 'resolved') {
              keysToInvalidate.push(queryKeys.stats.game);
            }

            // Batch invalidate all collected keys
            batchInvalidate(keysToInvalidate);
          } catch (error) {
            devLog.error('🔄 [RealtimeSync] Error processing UPDATE:', error);
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
          try {
            // DELETE payloads only contain the primary key in old
            const oldGame = payload.old as { id?: string } | null;
            const gameId = oldGame?.id;
            devLog.log('🗑️ [RealtimeSync] Game deleted:', gameId);

            if (gameId && typeof gameId === 'string') {
              queryClientRef.current.removeQueries({ queryKey: queryKeys.games.single(gameId) });
              actionsRef.current.removeActiveGame(gameId);
            }

            // Batch invalidate lists
            batchInvalidate([
              queryKeys.games.pending,
              queryKeys.games.active,
              queryKeys.stats.game,
            ]);
          } catch (error) {
            devLog.error('🗑️ [RealtimeSync] Error processing DELETE:', error);
          }
        }
      )
      .subscribe((status, err) => {
        devLog.log('📡 [RealtimeSync] Connection status:', status, err ? `Error: ${err.message}` : '');
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
          globalIsPolling = false;
          notifyListeners();
          devLog.log('✅ [RealtimeSync] WebSocket connected - real-time updates active');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsConnected(false);
          devLog.warn('⚠️ [RealtimeSync] WebSocket disconnected - starting fallback polling');

          // Start fallback polling with exponential backoff
          const startFallbackPolling = () => {
            if (fallbackIntervalRef.current) {
              clearTimeout(fallbackIntervalRef.current);
            }

            globalIsPolling = true;
            notifyListeners();
            fallbackPoll();

            // Get next interval with backoff + jitter (prevents thundering herd)
            const intervalIndex = Math.min(fallbackRetryCountRef.current, FALLBACK_POLL_INTERVALS_MS.length - 1);
            const baseInterval = FALLBACK_POLL_INTERVALS_MS[intervalIndex];
            const nextInterval = addJitter(baseInterval);
            fallbackRetryCountRef.current++;

            devLog.log(`🔄 [RealtimeSync] Next poll in ${(nextInterval / 1000).toFixed(1)}s (with jitter)`);
            fallbackIntervalRef.current = setTimeout(startFallbackPolling, nextInterval);
          };

          if (!fallbackIntervalRef.current) {
            startFallbackPolling();
          }
        }
      });

    // NOTE: Initial poll removed - WebSocket connection handles data freshness
    // The fallback polling system kicks in automatically if WebSocket fails
    // This eliminates 1 redundant query on every page load

    // Capture ref values for cleanup
    const autoRemoveTimeouts = autoRemoveTimeoutsRef.current;

    // Cleanup on unmount only
    return () => {
      devLog.log('🔌 [RealtimeSync] Cleaning up...');
      mountedRef.current = false;
      channel.unsubscribe();
      if (fallbackIntervalRef.current) {
        clearTimeout(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      // Clear all auto-remove timeouts (Map values are the timeout IDs)
      for (const timeout of autoRemoveTimeouts.values()) {
        clearTimeout(timeout);
      }
      autoRemoveTimeouts.clear();
      globalConnectionStatus = 'disconnected';
      notifyListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]); // Re-run when login state changes (enable/disable realtime sync)

  return isConnected;
}

// Export for debugging and components
export function getRealtimeStatus() {
  return globalConnectionStatus;
}

// Hook to get current connection status with automatic re-render on changes
export function useConnectionStatus() {
  const [status, setStatus] = useState(globalConnectionStatus);
  const [isPolling, setIsPolling] = useState(globalIsPolling);

  useEffect(() => {
    // Initial sync
    setStatus(globalConnectionStatus);
    setIsPolling(globalIsPolling);

    // Subscribe to changes
    const unsubscribe = subscribeToConnectionStatus(() => {
      setStatus(globalConnectionStatus);
      setIsPolling(globalIsPolling);
    });

    return unsubscribe;
  }, []);

  return {
    status,
    isConnected: status === 'SUBSCRIBED',
    isConnecting: status === 'connecting',
    isDisconnected: status === 'disconnected' || status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT',
    isPolling,
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
