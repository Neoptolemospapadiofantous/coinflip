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
          id: string;
          creator: string;
          joiner: string | null;
          tier: number;
          amount: string;
          creator_choice: boolean;
          joiner_choice: boolean | null;
          result: boolean | null;
          winner: string | null;
          status: string;
          created_at: string;
          matched_at: string | null;
          resolved_at: string | null;
          tx_hash: string;
          vrf_request_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['games']['Row'], 'created_at'>;
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
