/**
 * Game Query Functions
 *
 * Centralized game queries for consistency across hooks.
 * All queries return Supabase query builders for flexibility.
 */

import { supabase } from '@/lib/supabase';
import { DB_COLUMNS } from '@/types/database';

/**
 * Validate and sanitize Ethereum address for use in queries
 * Prevents SQL injection by ensuring only valid hex characters
 */
function sanitizeAddress(address: string): string {
  const lower = address.toLowerCase();
  // Strict validation: must be 0x followed by exactly 40 hex characters
  if (!/^0x[a-f0-9]{40}$/.test(lower)) {
    throw new Error('Invalid Ethereum address format');
  }
  return lower;
}

/**
 * Fetch all games with standard columns
 */
export function queryAllGames(limit: number = 100) {
  return supabase
    .from('games')
    .select(DB_COLUMNS.GAME_LIST)
    .order('created_at', { ascending: false })
    .limit(limit);
}

/**
 * Fetch pending games only (for lobby)
 */
export function queryPendingGames() {
  return supabase
    .from('games')
    .select(DB_COLUMNS.GAME_PENDING)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
}

/**
 * Fetch active games (pending + matched)
 */
export function queryActiveGames() {
  return supabase
    .from('games')
    .select(DB_COLUMNS.GAME_LIST)
    .in('status', ['pending', 'matched'])
    .order('created_at', { ascending: false });
}

/**
 * Fetch a single game by ID
 */
export function queryGameById(gameId: string) {
  return supabase
    .from('games')
    .select(DB_COLUMNS.GAME_LIST)
    .eq('id', gameId)
    .single();
}

/**
 * Fetch games by player address (as creator or joiner)
 * Address is validated to prevent SQL injection
 */
export function queryPlayerGames(address: string, limit: number = 50) {
  const safeAddress = sanitizeAddress(address);
  return supabase
    .from('games')
    .select(DB_COLUMNS.GAME_LIST)
    .or(`creator_address.ilike.${safeAddress},joiner_address.ilike.${safeAddress}`)
    .order('created_at', { ascending: false })
    .limit(limit);
}

/**
 * Fetch user's active games (pending/matched) by address
 * Address is validated to prevent SQL injection
 */
export function queryUserActiveGames(address: string, limit: number = 10) {
  const safeAddress = sanitizeAddress(address);
  return supabase
    .from('games')
    .select(DB_COLUMNS.GAME_LIST)
    .or(`creator_address.ilike.${safeAddress},joiner_address.ilike.${safeAddress}`)
    .in('status', ['pending', 'matched'])
    .order('created_at', { ascending: false })
    .limit(limit);
}

/**
 * Fetch game by transaction hash
 */
export function queryGameByTxHash(txHash: string) {
  return supabase
    .from('games')
    .select(DB_COLUMNS.GAME_LIST)
    .eq('tx_hash', txHash)
    .single();
}
