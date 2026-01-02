'use client';

import { useMemo, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase, getAuthenticatedClient, clearAuthClientCache } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Hook that provides a Supabase client authenticated with the connected wallet
 *
 * Usage:
 * ```tsx
 * const { client, isAuthenticated } = useSupabaseAuth();
 *
 * // Use client for authenticated queries
 * const { data } = await client.from('user_preferences').select('*');
 * ```
 *
 * When wallet is connected, requests include x-wallet-address header.
 * RLS policies use get_caller_address() to verify the wallet.
 */
export function useSupabaseAuth(): {
  client: SupabaseClient;
  isAuthenticated: boolean;
  address: string | undefined;
} {
  const { address, isConnected } = useAccount();

  // Clear cache when wallet disconnects
  useEffect(() => {
    if (!isConnected && address) {
      clearAuthClientCache(address);
    }
  }, [isConnected, address]);

  // Get the appropriate client based on connection state
  const client = useMemo(() => {
    if (address && isConnected) {
      return getAuthenticatedClient(address);
    }
    return supabase;
  }, [address, isConnected]);

  return {
    client,
    isAuthenticated: isConnected && !!address,
    address,
  };
}

/**
 * Get authenticated Supabase client outside of React components
 * Use this in async functions or callbacks where hooks can't be used
 *
 * @param walletAddress - The wallet address to authenticate with
 * @returns Authenticated Supabase client
 */
export function getSupabaseClient(walletAddress?: string): SupabaseClient {
  if (walletAddress) {
    return getAuthenticatedClient(walletAddress);
  }
  return supabase;
}
