'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { devLog } from '@/lib/utils';

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
const notificationCache = new Map<string, NotificationState>();

function getCacheKey(userAddress: string, gameId: string): string {
  return `${userAddress.toLowerCase()}-${gameId}`;
}

/**
 * Hook for tracking notification state in the database
 * Ensures modals and sounds are only shown once per user per game
 */
export function useNotificationState() {
  const { address } = useAccount();
  const pendingOpsRef = useRef<Set<string>>(new Set());

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
      const { data, error } = await supabase
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
        // Update cache
        notificationCache.set(cacheKey, {
          matched_modal_shown: data.matched_modal_shown,
          resolved_modal_shown: data.resolved_modal_shown,
          expired_modal_shown: data.expired_modal_shown,
          matched_sound_played: data.matched_sound_played,
          resolved_sound_played: data.resolved_sound_played,
        });

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
      const { error } = await supabase
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

        // Update cache
        const cached = notificationCache.get(cacheKey) || {
          matched_modal_shown: false,
          resolved_modal_shown: false,
          expired_modal_shown: false,
          matched_sound_played: false,
          resolved_sound_played: false,
        };
        cached[`${type}_modal_shown` as keyof NotificationState] = true;
        notificationCache.set(cacheKey, cached);
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
      const { error } = await supabase
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

        // Update cache
        const cached = notificationCache.get(cacheKey) || {
          matched_modal_shown: false,
          resolved_modal_shown: false,
          expired_modal_shown: false,
          matched_sound_played: false,
          resolved_sound_played: false,
        };
        cached[`${type}_sound_played` as keyof NotificationState] = true;
        notificationCache.set(cacheKey, cached);
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

    try {
      const { data, error } = await supabase
        .from('user_game_notifications')
        .select('*')
        .eq('user_address', address.toLowerCase())
        .in('game_id', gameIds);

      if (error) {
        devLog.warn(`🔔 [Notification] Error prefetching:`, error.message);
        return;
      }

      // Populate cache
      for (const row of data || []) {
        const cacheKey = getCacheKey(address, String(row.game_id));
        notificationCache.set(cacheKey, {
          matched_modal_shown: row.matched_modal_shown,
          resolved_modal_shown: row.resolved_modal_shown,
          expired_modal_shown: row.expired_modal_shown,
          matched_sound_played: row.matched_sound_played,
          resolved_sound_played: row.resolved_sound_played,
        });
      }

      devLog.log(`🔔 [Notification] Prefetched ${data?.length || 0} notification states`);
    } catch (err) {
      devLog.warn(`🔔 [Notification] Prefetch error:`, err);
    }
  }, [address]);

  // Clear cache on address change
  useEffect(() => {
    if (!address) {
      notificationCache.clear();
    }
  }, [address]);

  return {
    shouldShowModal,
    shouldPlaySound,
    markModalShown,
    markSoundPlayed,
    prefetchNotifications,
  };
}
