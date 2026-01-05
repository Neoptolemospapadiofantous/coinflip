'use client';

/**
 * Data Provider
 *
 * Provides the appropriate data source based on authentication state.
 * - Logged out: Uses BlockchainDataSource (decentralized)
 * - Logged in: Uses SupabaseDataSource (centralized with enhanced features)
 *
 * Also handles offline fallback - if Supabase is down, falls back to blockchain.
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { GameDataSource, EnhancedDataSource, DataContextValue, DataMode } from './types';
import { getBlockchainDataSource, BlockchainDataSource } from './blockchain';
import { getSupabaseDataSource, SupabaseDataSource } from './supabase-source';
import { devLog } from '@/lib/utils';

// ============================================
// CONTEXT
// ============================================

const DataContext = createContext<DataContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface DataProviderProps {
  children: React.ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  // Auth state
  const { address: walletAddress } = useAccount();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Connection state
  const [isOnline, setIsOnline] = useState(true);
  const [supabaseAvailable, setSupabaseAvailable] = useState(true);

  // Data sources
  const [blockchainSource] = useState<BlockchainDataSource>(() => getBlockchainDataSource());
  const [supabaseSource, setSupabaseSource] = useState<SupabaseDataSource | null>(null);

  // ============================================
  // AUTH MANAGEMENT
  // ============================================

  // Listen for Supabase auth changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          // Auth errors (invalid refresh token, etc.) - just treat as not logged in
          devLog.log('[DataProvider] Auth error (treating as logged out):', error.message);
          setSession(null);
        } else {
          setSession(session);
        }
        setIsLoadingAuth(false);
      })
      .catch((err) => {
        // Catch any unexpected errors
        devLog.warn('[DataProvider] Unexpected auth error:', err);
        setSession(null);
        setIsLoadingAuth(false);
      });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Ignore token refresh errors - just log out
      if (_event === 'TOKEN_REFRESHED' && !session) {
        devLog.log('[DataProvider] Token refresh failed, treating as logged out');
        setSession(null);
        return;
      }
      setSession(session);
      devLog.log('[DataProvider] Auth state changed:', _event);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Create/update Supabase source when auth changes
  useEffect(() => {
    if (session?.user) {
      // User is logged in - create authenticated Supabase source
      const newSource = getSupabaseDataSource(walletAddress);
      setSupabaseSource(newSource);

      return () => {
        newSource.destroy();
      };
    } else {
      setSupabaseSource(null);
    }
  }, [session?.user, walletAddress]);

  // ============================================
  // ONLINE/OFFLINE DETECTION
  // ============================================

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check Supabase availability periodically
  useEffect(() => {
    const checkSupabase = async () => {
      if (supabaseSource) {
        const available = await supabaseSource.isAvailable();
        setSupabaseAvailable(available);
      }
    };

    checkSupabase();
    const interval = setInterval(checkSupabase, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, [supabaseSource]);

  // ============================================
  // DATA MODE DETERMINATION
  // ============================================

  const isLoggedIn = !!session?.user;

  const mode: DataMode = useMemo(() => {
    // Use blockchain mode if:
    // - Not logged in
    // - Supabase is unavailable
    // - Offline
    if (!isLoggedIn || !supabaseAvailable || !isOnline) {
      return 'blockchain';
    }
    return 'supabase';
  }, [isLoggedIn, supabaseAvailable, isOnline]);

  // Select the appropriate data source
  const source: GameDataSource = useMemo(() => {
    if (mode === 'supabase' && supabaseSource) {
      return supabaseSource;
    }
    return blockchainSource;
  }, [mode, supabaseSource, blockchainSource]);

  // Enhanced source (only available when logged in and using Supabase)
  const enhancedSource: EnhancedDataSource | null = useMemo(() => {
    if (mode === 'supabase' && supabaseSource) {
      return supabaseSource;
    }
    return null;
  }, [mode, supabaseSource]);

  // Feature availability
  const features = useMemo(() => ({
    realtime: mode === 'supabase',
    cloudPreferences: mode === 'supabase',
    crossDeviceSync: mode === 'supabase',
    activityFeed: mode === 'supabase',
    matchTimeEstimates: mode === 'supabase',
    notifications: mode === 'supabase',
  }), [mode]);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value: DataContextValue = useMemo(() => ({
    mode,
    isLoggedIn,
    isOnline,
    source,
    enhancedSource,
    features,
  }), [mode, isLoggedIn, isOnline, source, enhancedSource, features]);

  // Don't render until auth is loaded
  if (isLoadingAuth) {
    return null; // Or a loading spinner
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

// ============================================
// HOOKS
// ============================================

/**
 * Get the current data context
 */
export function useDataContext(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
}

/**
 * Get the current data source (works in both modes)
 */
export function useDataSource(): GameDataSource {
  const { source } = useDataContext();
  return source;
}

/**
 * Get enhanced data source (Supabase-only features)
 * Returns null if not logged in or using blockchain mode
 */
export function useEnhancedDataSource(): EnhancedDataSource | null {
  const { enhancedSource } = useDataContext();
  return enhancedSource;
}

/**
 * Check if a feature is available
 */
export function useFeature(feature: keyof DataContextValue['features']): boolean {
  const { features } = useDataContext();
  return features[feature];
}

/**
 * Get all feature flags
 */
export function useFeatures(): DataContextValue['features'] {
  const { features } = useDataContext();
  return features;
}

/**
 * Get current data mode
 */
export function useDataMode(): DataMode {
  const { mode } = useDataContext();
  return mode;
}

/**
 * Check if user is logged in (has Supabase session)
 */
export function useIsLoggedIn(): boolean {
  const { isLoggedIn } = useDataContext();
  return isLoggedIn;
}
