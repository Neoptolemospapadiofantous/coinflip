import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Client Configuration
 *
 * This module provides a single main client instance and a cache of authenticated
 * clients (one per wallet address) for RLS-protected queries.
 *
 * NOTE: Multiple GoTrueClient warnings may appear in the console. This is expected
 * because we intentionally create separate clients for authenticated wallet users
 * to set the x-wallet-address header for RLS policies. These clients are cached
 * to minimize creation, but some duplication is unavoidable.
 *
 * For centralized database types, see: @/types/database
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Base Supabase client (used for public queries and auth)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Persist auth session across page refreshes
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 100, // Increased for 1000+ concurrent users
    },
  },
});

// Cache for authenticated clients (one per wallet address)
const authClientCache = new Map<string, SupabaseClient>();

/**
 * Get a Supabase client authenticated with a wallet address
 * This sets the x-wallet-address header for RLS policies
 *
 * @param walletAddress - The connected wallet address (0x...)
 * @returns Supabase client with wallet auth headers
 */
export function getAuthenticatedClient(walletAddress: string): SupabaseClient {
  const normalizedAddress = walletAddress.toLowerCase();

  // Return cached client if exists
  const cached = authClientCache.get(normalizedAddress);
  if (cached) {
    return cached;
  }

  // Create new client with wallet address header
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        'x-wallet-address': normalizedAddress,
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 100,
      },
    },
  });

  // Cache the client
  authClientCache.set(normalizedAddress, client);

  return client;
}

/**
 * Clear authenticated client cache (call on wallet disconnect)
 */
export function clearAuthClientCache(walletAddress?: string): void {
  if (walletAddress) {
    authClientCache.delete(walletAddress.toLowerCase());
  } else {
    authClientCache.clear();
  }
}

// NOTE: For comprehensive database types, use @/types/database
// This legacy Database interface is kept for backwards compatibility
// but prefer importing from types/database.ts for new code
export type { DbGame, DbTier, DbUserPreferences, DbPendingTransaction } from '@/types/database';
