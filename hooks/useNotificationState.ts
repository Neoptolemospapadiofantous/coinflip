'use client';

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { getAuthenticatedClient } from '@/lib/supabase';
import { devLog } from '@/lib/utils';
import { useIsLoggedIn } from '@/lib/data';

type NotificationType = 'matched' | 'resolved' | 'expired';
type SoundType = 'matched' | 'resolved';

interface NotificationState {
  matched_modal_shown: boolean;
  resolved_modal_shown: boolean;
  expired_modal_shown: boolean;
  matched_sound_played: boolean;
  resolved_sound_played: boolean;
}

// In-memory cache to avoid repeated DB calls within a session
// LRU cache with max size to prevent memory leaks
const MAX_CACHE_SIZE = 100;
const notificationCache = new Map<string, NotificationState>();
const cacheAccessOrder: string[] = []; // Track access order for LRU

function getCacheKey(userAddress: string, gameId: string): string {
  return `${userAddress.toLowerCase()}-${gameId}`;
}

// LRU cache helper - moves key to end (most recently used)
function touchCacheKey(key: string): void {
  const index = cacheAccessOrder.indexOf(key);
  if (index > -1) {
    cacheAccessOrder.splice(index, 1);
  }
  cacheAccessOrder.push(key);
}

// Evict oldest entries if cache exceeds max size
function evictOldCacheEntries(): void {
  while (notificationCache.size > MAX_CACHE_SIZE && cacheAccessOrder.length > 0) {
    const oldestKey = cacheAccessOrder.shift();
    if (oldestKey) {
      notificationCache.delete(oldestKey);
      devLog.log(`🔔 [Notification] Evicted cache entry: ${oldestKey}`);
    }
  }
}

/**
 * Hook for tracking notification state in the database
 * Ensures modals and sounds are only shown once per user per game
 *
 * In decentralized mode (not logged in), returns no-op functions
 * since there's no database to track notifications.
 */
export function useNotificationState() {
  const { address } = useAccount();
  const pendingOpsRef = useRef<Set<string>>(new Set());
  const isLoggedIn = useIsLoggedIn();

  // Decentralized mode: return no-op functions
  // In blockchain-only mode, always allow showing modals/sounds (no deduplication)
  const noopReturn = useMemo(() => ({
    shouldShowModal: async () => true,
    shouldPlaySound: async () => true,
    markModalShown: async () => {},
    markSoundPlayed: async () => {},
    prefetchNotifications: async () => {},
    markMultipleModalsShown: async () => {},
  }), []);

  if (!isLoggedIn) {
    return noopReturn;
  }

  /**
   * Check if a modal should be shown for a game
   * Returns true if the modal hasn't been shown yet
   */
  const shouldShowModal = useCallback(async (
    gameId: string,
    type: NotificationType
  ): Promise<boolean> => {
    if (!address) return false;

    const cacheKey = getCacheKey(address, gameId);

    // Check in-memory cache first
    const cached = notificationCache.get(cacheKey);
    if (cached) {
      const field = `${type}_modal_shown` as keyof NotificationState;
      if (cached[field]) {
        devLog.log(`🔔 [Notification] Modal already shown (cached): ${type} for game ${gameId}`);
        return false;
      }
    }

    try {
      // Check database
      const client = getAuthenticatedClient(address);
      const { data, error } = await client
        .from('user_game_notifications')
        .select('*')
        .eq('user_address', address.toLowerCase())
        .eq('game_id', gameId)
        .maybeSingle();

      if (error) {
        devLog.warn(`🔔 [Notification] Error checking state:`, error.message);
        return true; // Show if we can't check (fail open)
      }

      if (data) {
        // Update cache with LRU tracking
        notificationCache.set(cacheKey, {
          matched_modal_shown: data.matched_modal_shown,
          resolved_modal_shown: data.resolved_modal_shown,
          expired_modal_shown: data.expired_modal_shown,
          matched_sound_played: data.matched_sound_played,
          resolved_sound_played: data.resolved_sound_played,
        });
        touchCacheKey(cacheKey);
        evictOldCacheEntries();

        const field = `${type}_modal_shown` as keyof typeof data;
        if (data[field]) {
          devLog.log(`🔔 [Notification] Modal already shown (DB): ${type} for game ${gameId}`);
          return false;
        }
      }

      return true;
    } catch (err) {
      devLog.warn(`🔔 [Notification] Error:`, err);
      return true; // Show if we can't check
    }
  }, [address]);

  /**
   * Check if a sound should be played for a game
   */
  const shouldPlaySound = useCallback(async (
    gameId: string,
    type: SoundType
  ): Promise<boolean> => {
    if (!address) return false;

    const cacheKey = getCacheKey(address, gameId);

    // Check in-memory cache first
    const cached = notificationCache.get(cacheKey);
    if (cached) {
      const field = `${type}_sound_played` as keyof NotificationState;
      if (cached[field]) {
        devLog.log(`🔔 [Notification] Sound already played (cached): ${type} for game ${gameId}`);
        return false;
      }
    }

    // For sounds, we trust the cache more - don't hit DB every time
    // The modal check will populate the cache
    return true;
  }, [address]);

  /**
   * Mark a modal as shown in the database
   */
  const markModalShown = useCallback(async (
    gameId: string,
    type: NotificationType
  ): Promise<void> => {
    if (!address) return;

    const opKey = `modal-${gameId}-${type}`;
    if (pendingOpsRef.current.has(opKey)) return;
    pendingOpsRef.current.add(opKey);

    const cacheKey = getCacheKey(address, gameId);
    const field = `${type}_modal_shown`;

    try {
      // Upsert the notification state
      const client = getAuthenticatedClient(address);
      const { error } = await client
        .from('user_game_notifications')
        .upsert({
          user_address: address.toLowerCase(),
          game_id: gameId,
          [field]: true,
        }, {
          onConflict: 'user_address,game_id',
        });

      if (error) {
        devLog.warn(`🔔 [Notification] Error marking modal shown:`, error.message);
      } else {
        devLog.log(`🔔 [Notification] Marked modal shown: ${type} for game ${gameId}`);

        // Update cache with LRU tracking
        const cached = notificationCache.get(cacheKey) || {
          matched_modal_shown: false,
          resolved_modal_shown: false,
          expired_modal_shown: false,
          matched_sound_played: false,
          resolved_sound_played: false,
        };
        cached[`${type}_modal_shown` as keyof NotificationState] = true;
        notificationCache.set(cacheKey, cached);
        touchCacheKey(cacheKey);
        evictOldCacheEntries();
      }
    } catch (err) {
      devLog.warn(`🔔 [Notification] Error:`, err);
    } finally {
      pendingOpsRef.current.delete(opKey);
    }
  }, [address]);

  /**
   * Mark a sound as played in the database
   */
  const markSoundPlayed = useCallback(async (
    gameId: string,
    type: SoundType
  ): Promise<void> => {
    if (!address) return;

    const opKey = `sound-${gameId}-${type}`;
    if (pendingOpsRef.current.has(opKey)) return;
    pendingOpsRef.current.add(opKey);

    const cacheKey = getCacheKey(address, gameId);
    const field = `${type}_sound_played`;

    try {
      const client = getAuthenticatedClient(address);
      const { error } = await client
        .from('user_game_notifications')
        .upsert({
          user_address: address.toLowerCase(),
          game_id: gameId,
          [field]: true,
        }, {
          onConflict: 'user_address,game_id',
        });

      if (error) {
        devLog.warn(`🔔 [Notification] Error marking sound played:`, error.message);
      } else {
        devLog.log(`🔔 [Notification] Marked sound played: ${type} for game ${gameId}`);

        // Update cache with LRU tracking
        const cached = notificationCache.get(cacheKey) || {
          matched_modal_shown: false,
          resolved_modal_shown: false,
          expired_modal_shown: false,
          matched_sound_played: false,
          resolved_sound_played: false,
        };
        cached[`${type}_sound_played` as keyof NotificationState] = true;
        notificationCache.set(cacheKey, cached);
        touchCacheKey(cacheKey);
        evictOldCacheEntries();
      }
    } catch (err) {
      devLog.warn(`🔔 [Notification] Error:`, err);
    } finally {
      pendingOpsRef.current.delete(opKey);
    }
  }, [address]);

  /**
   * Prefetch notification states for multiple games
   * Call this when loading user's games to populate cache
   */
  const prefetchNotifications = useCallback(async (gameIds: string[]): Promise<void> => {
    if (!address || gameIds.length === 0) return;

    // Limit to prevent DoS - only prefetch first 100 games
    const limitedGameIds = gameIds.slice(0, 100);
    if (gameIds.length > 100) {
      devLog.warn(`🔔 [Notification] Limiting prefetch from ${gameIds.length} to 100 games`);
    }

    try {
      const client = getAuthenticatedClient(address);
      const { data, error } = await client
        .from('user_game_notifications')
        .select('*')
        .eq('user_address', address.toLowerCase())
        .in('game_id', limitedGameIds);

      if (error) {
        devLog.warn(`🔔 [Notification] Error prefetching:`, error.message);
        return;
      }

      // Populate cache with LRU tracking
      for (const row of data || []) {
        const cacheKey = getCacheKey(address, String(row.game_id));
        notificationCache.set(cacheKey, {
          matched_modal_shown: row.matched_modal_shown,
          resolved_modal_shown: row.resolved_modal_shown,
          expired_modal_shown: row.expired_modal_shown,
          matched_sound_played: row.matched_sound_played,
          resolved_sound_played: row.resolved_sound_played,
        });
        touchCacheKey(cacheKey);
      }
      evictOldCacheEntries();

      devLog.log(`🔔 [Notification] Prefetched ${data?.length || 0} notification states`);
    } catch (err) {
      devLog.warn(`🔔 [Notification] Prefetch error:`, err);
    }
  }, [address]);

  // Clear cache on address change
  useEffect(() => {
    if (!address) {
      notificationCache.clear();
      cacheAccessOrder.length = 0; // Clear LRU tracking array
    }
  }, [address]);

  /**
   * Mark multiple modals as shown in the database (for skip all)
   */
  const markMultipleModalsShown = useCallback(async (
    gameIds: Array<{ gameId: string; type: NotificationType }>
  ): Promise<void> => {
    if (!address || gameIds.length === 0) return;

    devLog.log(`🔔 [Notification] Marking ${gameIds.length} modals as shown`);

    try {
      // Batch upsert all notification states
      const upserts = gameIds.map(({ gameId, type }) => ({
        user_address: address.toLowerCase(),
        game_id: gameId,
        [`${type}_modal_shown`]: true,
      }));

      const client = getAuthenticatedClient(address);
      const { error } = await client
        .from('user_game_notifications')
        .upsert(upserts, {
          onConflict: 'user_address,game_id',
        });

      if (error) {
        devLog.warn(`🔔 [Notification] Error marking multiple modals shown:`, error.message);
      } else {
        devLog.log(`🔔 [Notification] Marked ${gameIds.length} modals as shown`);

        // Update cache for all
        for (const { gameId, type } of gameIds) {
          const cacheKey = getCacheKey(address, gameId);
          const cached = notificationCache.get(cacheKey) || {
            matched_modal_shown: false,
            resolved_modal_shown: false,
            expired_modal_shown: false,
            matched_sound_played: false,
            resolved_sound_played: false,
          };
          cached[`${type}_modal_shown` as keyof NotificationState] = true;
          notificationCache.set(cacheKey, cached);
          touchCacheKey(cacheKey);
        }
        evictOldCacheEntries();
      }
    } catch (err) {
      devLog.warn(`🔔 [Notification] Error:`, err);
    }
  }, [address]);

  return {
    shouldShowModal,
    shouldPlaySound,
    markModalShown,
    markSoundPlayed,
    prefetchNotifications,
    markMultipleModalsShown,
  };
}
