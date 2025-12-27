export enum GameStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

// Valid game statuses for runtime validation
const VALID_STATUSES = ['pending', 'matched', 'resolved', 'cancelled'] as const;

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
  coin_result: boolean | null; // false = heads, true = tails
  payout: string | null;
  fee: string | null; // Platform fee in wei
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
  // Contract tracking
  contract_address?: string;
  contract_version?: number;
  // Optional fields from joins with tiers/views
  amount_usd?: number;
  win_amount_usd?: number;
  time_waiting_seconds?: number;
}

/**
 * Runtime validation for Game objects from database/realtime payloads
 * Returns true if the object has all required fields with correct types
 */
export function isValidGame(obj: unknown): obj is Game {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const game = obj as Record<string, unknown>;

  // Required string fields
  if (typeof game.id !== 'string' || game.id.length === 0) return false;
  if (typeof game.tx_hash !== 'string') return false;
  if (typeof game.amount !== 'string') return false;
  if (typeof game.creator_address !== 'string') return false;
  if (typeof game.block_number !== 'string') return false;
  if (typeof game.created_at !== 'string') return false;
  if (typeof game.updated_at !== 'string') return false;

  // Required number fields
  if (typeof game.tier !== 'number' || game.tier < 0 || game.tier > 9) return false;

  // Required boolean fields
  if (typeof game.creator_choice !== 'boolean') return false;

  // Status must be valid
  if (!VALID_STATUSES.includes(game.status as typeof VALID_STATUSES[number])) return false;

  // Optional string fields (must be string or null)
  const optionalStrings = [
    'joiner_address', 'winner_address', 'payout', 'fee',
    'matched_tx_hash', 'matched_block_number',
    'resolved_tx_hash', 'resolved_block_number',
    'cancelled_tx_hash', 'cancelled_block_number',
    'matched_at', 'resolved_at', 'cancelled_at'
  ];
  for (const field of optionalStrings) {
    if (game[field] !== null && typeof game[field] !== 'string') return false;
  }

  // Optional boolean fields (must be boolean or null)
  if (game.joiner_choice !== null && typeof game.joiner_choice !== 'boolean') return false;
  if (game.coin_result !== null && typeof game.coin_result !== 'boolean') return false;

  return true;
}

/**
 * Validate and cast an unknown object to Game
 * Returns the Game if valid, null otherwise
 */
export function parseGame(obj: unknown): Game | null {
  if (isValidGame(obj)) {
    return obj;
  }
  console.warn('Invalid game object received:', obj);
  return null;
}

