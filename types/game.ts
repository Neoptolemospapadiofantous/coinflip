export enum GameStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

export interface Game {
  id: string;
  tx_hash: string;
  tier: number;
  amount: string;
  creator_address: string;
  creator_choice: boolean;
  joiner_address: string | null;
  joiner_choice: boolean | null;
  status: 'pending' | 'matched' | 'resolved' | 'cancelled';
  winner_address: string | null;
  random_number: string | null;
  coin_result: boolean | null; // false = heads, true = tails (replaces random_number)
  payout: string | null;
  block_number: string;
  matched_tx_hash: string | null;
  matched_block_number: string | null;
  resolved_tx_hash: string | null;
  resolved_block_number: string | null;
  cancelled_tx_hash: string | null;
  cancelled_block_number: string | null;
  created_at: string;
  matched_at: string | null;
  resolved_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
  // Optional fields from joins with tiers/views
  amount_usd?: number;
  win_amount_usd?: number;
  time_waiting_seconds?: number;
}

export interface GameCreate {
  tier: number;
  choice: boolean; // false = heads, true = tails
  amount: string; // in wei
}

export interface GameJoin {
  gameId: string;
  choice: boolean;
  amount: string;
}

export interface GameResult {
  gameId: string;
  result: boolean; // coin flip result
  winner: string;
  amount: string;
}
