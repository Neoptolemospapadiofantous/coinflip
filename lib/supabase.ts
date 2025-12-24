import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We use Web3 wallet auth, not Supabase auth
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

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
          random_number: string | null;
          payout: string | null;
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
      queue: {
        Row: {
          id: string;
          game_id: string;
          tier: number;
          player_address: string;
          choice: boolean;
          joined_at: string;
          expires_at: string;
        };
        Insert: Omit<Database['public']['Tables']['queue']['Row'], 'joined_at'>;
        Update: Partial<Database['public']['Tables']['queue']['Row']>;
      };
    };
  };
}
