import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Base Supabase client (used for public queries without auth)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We use Web3 wallet auth, not Supabase auth
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

// Database types (will be generated from Supabase schema)
export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: number;
          tx_hash: string;
          tier: number;
          amount: string;
          creator_address: string;
          creator_choice: boolean;
          joiner_address: string | null;
          joiner_choice: boolean | null;
          status: string;
          winner_address: string | null;
          coin_result: boolean | null;
          payout: string | null;
          fee: string | null;
          block_number: number;
          matched_tx_hash: string | null;
          matched_block_number: number | null;
          resolved_tx_hash: string | null;
          resolved_block_number: number | null;
          cancelled_tx_hash: string | null;
          cancelled_block_number: number | null;
          created_at: string;
          matched_at: string | null;
          resolved_at: string | null;
          cancelled_at: string | null;
          updated_at: string;
          contract_address: string | null;
          contract_version: number | null;
        };
        Insert: Omit<Database['public']['Tables']['games']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['games']['Row']>;
      };
      tiers: {
        Row: {
          id: number;
          amount: string;
          amount_usd: number;
          win_amount: string;
          win_amount_usd: number;
          players_in_queue: number;
          enabled: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tiers']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['tiers']['Row']>;
      };
      // Note: Queue functionality is handled by the games table with status='pending'
      // No separate queue table exists - games with pending status serve as the queue
    };
  };
}
