import { devLog } from '@/lib/utils';

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

  // Optional string fields (must be string, null, or undefined)
  const optionalStrings = [
    'joiner_address', 'winner_address', 'payout', 'fee',
    'matched_tx_hash', 'matched_block_number',
    'resolved_tx_hash', 'resolved_block_number',
    'cancelled_tx_hash', 'cancelled_block_number',
    'matched_at', 'resolved_at', 'cancelled_at'
  ];
  for (const field of optionalStrings) {
    const value = game[field];
    if (value !== null && value !== undefined && typeof value !== 'string') return false;
  }

  // Optional boolean fields (must be boolean, null, or undefined)
  if (game.joiner_choice !== null && game.joiner_choice !== undefined && typeof game.joiner_choice !== 'boolean') return false;
  if (game.coin_result !== null && game.coin_result !== undefined && typeof game.coin_result !== 'boolean') return false;

  return true;
}

/**
 * Normalize game object from database/realtime
 * - Converts numeric fields to strings where needed (Supabase sends numbers for bigint columns)
 * - Converts undefined to null for optional fields
 */
function normalizeGame(obj: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...obj };

  // Convert numeric ID to string (Supabase realtime sends numbers)
  if (typeof normalized.id === 'number') {
    normalized.id = String(normalized.id);
  }

  // Convert numeric block numbers to strings
  if (typeof normalized.block_number === 'number') {
    normalized.block_number = String(normalized.block_number);
  }
  if (typeof normalized.matched_block_number === 'number') {
    normalized.matched_block_number = String(normalized.matched_block_number);
  }
  if (typeof normalized.resolved_block_number === 'number') {
    normalized.resolved_block_number = String(normalized.resolved_block_number);
  }
  if (typeof normalized.cancelled_block_number === 'number') {
    normalized.cancelled_block_number = String(normalized.cancelled_block_number);
  }

  // Normalize optional fields: convert undefined to null for consistency
  const optionalFields = [
    'joiner_address', 'winner_address', 'payout', 'fee',
    'matched_tx_hash', 'matched_block_number',
    'resolved_tx_hash', 'resolved_block_number',
    'cancelled_tx_hash', 'cancelled_block_number',
    'matched_at', 'resolved_at', 'cancelled_at',
    'joiner_choice', 'coin_result'
  ];
  for (const field of optionalFields) {
    if (normalized[field] === undefined) {
      normalized[field] = null;
    }
  }

  return normalized;
}

/**
 * Validate and cast an unknown object to Game
 * Returns the Game if valid, null otherwise
 */
export function parseGame(obj: unknown): Game | null {
  if (typeof obj !== 'object' || obj === null) {
    devLog.warn('Invalid game object received (not an object)');
    return null;
  }

  // Normalize the object first (convert numeric fields)
  const normalized = normalizeGame(obj as Record<string, unknown>);

  if (isValidGame(normalized)) {
    return normalized;
  }
  // Log safely without exposing potentially large/sensitive objects
  const objRecord = obj as Record<string, unknown>;
  devLog.warn('Invalid game object received, id:', objRecord.id || 'unknown');
  return null;
}

