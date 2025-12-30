'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { devLog } from '@/lib/utils';

export interface UserPreferences {
  user_address: string;
  skip_animation: boolean;
  sound_enabled: boolean;
  last_game_tier: number | null;
  last_game_choice: boolean | null;
  last_game_was_win: boolean | null;
  last_game_amount: string | null;
  default_tier: number | null;
  default_choice: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface LastGameSettings {
  tier: number;
  choice: boolean;
  wasWin: boolean;
  amount: string;
}

const DEFAULT_PREFERENCES: Omit<UserPreferences, 'user_address' | 'created_at' | 'updated_at'> = {
  skip_animation: false,
  sound_enabled: true,
  last_game_tier: null,
  last_game_choice: null,
  last_game_was_win: null,
  last_game_amount: null,
  default_tier: null,
  default_choice: null,
};

/**
 * Hook for managing user preferences stored in the database
 * Provides automatic sync across devices and sessions
 */
export function useUserPreferences() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const pendingUpdatesRef = useRef<Set<string>>(new Set());

  // Query key for preferences
  const queryKey = ['user-preferences', address?.toLowerCase()];

  // Fetch preferences from database
  const { data: preferences, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<UserPreferences | null> => {
      if (!address) return null;

      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_address', address.toLowerCase())
        .maybeSingle();

      if (error) {
        devLog.warn('[Preferences] Error fetching:', error.message);
        return null;
      }

      return data;
    },
    enabled: !!address,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation to update preferences
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Omit<UserPreferences, 'user_address' | 'created_at' | 'updated_at'>>) => {
      if (!address) throw new Error('No address');

      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_address: address.toLowerCase(),
          ...updates,
        }, {
          onConflict: 'user_address',
        });

      if (error) throw error;
      return updates;
    },
    onSuccess: (updates) => {
      // Optimistically update cache
      queryClient.setQueryData<UserPreferences | null>(queryKey, (old) => {
        if (!old && address) {
          return {
            user_address: address.toLowerCase(),
            ...DEFAULT_PREFERENCES,
            ...updates,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as UserPreferences;
        }
        return old ? { ...old, ...updates, updated_at: new Date().toISOString() } : null;
      });
    },
    onError: (error) => {
      devLog.warn('[Preferences] Error updating:', error);
    },
  });

  // Update a single preference
  const updatePreference = useCallback(<K extends keyof Omit<UserPreferences, 'user_address' | 'created_at' | 'updated_at'>>(
    key: K,
    value: UserPreferences[K]
  ) => {
    if (!address) return;

    const opKey = `${key}-${value}`;
    if (pendingUpdatesRef.current.has(opKey)) return;
    pendingUpdatesRef.current.add(opKey);

    devLog.log(`[Preferences] Updating ${key}:`, value);
    updateMutation.mutate({ [key]: value }, {
      onSettled: () => {
        pendingUpdatesRef.current.delete(opKey);
      },
    });
  }, [address, updateMutation]);

  // Convenience methods for common preferences
  const setSkipAnimation = useCallback((skip: boolean) => {
    updatePreference('skip_animation', skip);
  }, [updatePreference]);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    updatePreference('sound_enabled', enabled);
  }, [updatePreference]);

  const setDefaultTier = useCallback((tier: number | null) => {
    updatePreference('default_tier', tier);
  }, [updatePreference]);

  const setDefaultChoice = useCallback((choice: boolean | null) => {
    updatePreference('default_choice', choice);
  }, [updatePreference]);

  // Save last game settings for quick re-bet
  const saveLastGameSettings = useCallback((settings: LastGameSettings) => {
    if (!address) return;

    devLog.log('[Preferences] Saving last game settings:', settings);
    updateMutation.mutate({
      last_game_tier: settings.tier,
      last_game_choice: settings.choice,
      last_game_was_win: settings.wasWin,
      last_game_amount: settings.amount,
    });
  }, [address, updateMutation]);

  // Clear last game settings
  const clearLastGameSettings = useCallback(() => {
    updateMutation.mutate({
      last_game_tier: null,
      last_game_choice: null,
      last_game_was_win: null,
      last_game_amount: null,
    });
  }, [updateMutation]);

  // Get last game settings as a structured object
  const lastGameSettings: LastGameSettings | null = preferences?.last_game_tier !== null &&
    preferences?.last_game_tier !== undefined
    ? {
        tier: preferences.last_game_tier,
        choice: preferences.last_game_choice ?? false,
        wasWin: preferences.last_game_was_win ?? false,
        amount: preferences.last_game_amount ?? '0',
      }
    : null;

  return {
    // Preferences data
    preferences: preferences ?? {
      ...DEFAULT_PREFERENCES,
      user_address: address?.toLowerCase() ?? '',
      created_at: '',
      updated_at: '',
    },
    isLoading,
    error,

    // Individual preference values (with defaults)
    skipAnimation: preferences?.skip_animation ?? false,
    soundEnabled: preferences?.sound_enabled ?? true,
    defaultTier: preferences?.default_tier ?? null,
    defaultChoice: preferences?.default_choice ?? null,
    lastGameSettings,

    // Update methods
    updatePreference,
    setSkipAnimation,
    setSoundEnabled,
    setDefaultTier,
    setDefaultChoice,
    saveLastGameSettings,
    clearLastGameSettings,

    // Mutation state
    isUpdating: updateMutation.isPending,
  };
}
