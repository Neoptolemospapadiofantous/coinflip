/**
 * User Query Functions
 *
 * Centralized user-related queries (preferences, pending transactions, notifications).
 * All address parameters are sanitized to prevent SQL injection.
 */

import { supabase, getAuthenticatedClient } from '@/lib/supabase';
import type { UpdateUserPreferencesInput, CreatePendingTxInput, UpdatePendingTxInput } from '@/types/database';

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

// ============================================
// USER PREFERENCES
// ============================================

/**
 * Fetch user preferences
 */
export function queryUserPreferences(address: string) {
  const safeAddress = sanitizeAddress(address);
  const client = getAuthenticatedClient(address);
  return client
    .from('user_preferences')
    .select('*')
    .eq('user_address', safeAddress)
    .single();
}

/**
 * Upsert user preferences
 */
export function upsertUserPreferences(address: string, updates: UpdateUserPreferencesInput) {
  const safeAddress = sanitizeAddress(address);
  const client = getAuthenticatedClient(address);
  return client
    .from('user_preferences')
    .upsert(
      {
        user_address: safeAddress,
        ...updates,
      },
      { onConflict: 'user_address' }
    )
    .select()
    .single();
}

// ============================================
// PENDING TRANSACTIONS
// ============================================

/**
 * Fetch active pending transactions for a user
 * Uses authenticated client for RLS policy compliance
 */
export function queryPendingTransactions(address: string) {
  const safeAddress = sanitizeAddress(address);
  const client = getAuthenticatedClient(address);
  return client
    .from('pending_transactions')
    .select('*')
    .eq('user_address', safeAddress)
    .in('status', ['pending', 'submitted'])
    .order('created_at', { ascending: false });
}

/**
 * Create a new pending transaction
 * Uses authenticated client for RLS policy compliance
 */
export function createPendingTransaction(address: string, input: Omit<CreatePendingTxInput, 'user_address'>) {
  const safeAddress = sanitizeAddress(address);
  const client = getAuthenticatedClient(address);
  return client
    .from('pending_transactions')
    .insert({
      user_address: safeAddress,
      tx_type: input.tx_type,
      tx_hash: input.tx_hash || null,
      game_id: input.game_id || null,
      tier: input.tier ?? null,
      choice: input.choice ?? null,
      amount_eth: input.amount_eth || null,
      status: input.status || 'pending',
    })
    .select()
    .single();
}

/**
 * Update a pending transaction
 * Uses authenticated client for RLS policy compliance
 */
export function updatePendingTransaction(address: string, id: number, updates: UpdatePendingTxInput) {
  const client = getAuthenticatedClient(address);
  return client
    .from('pending_transactions')
    .update(updates)
    .eq('id', id);
}

/**
 * Delete a pending transaction
 * Uses authenticated client for RLS policy compliance
 */
export function deletePendingTransaction(address: string, id: number) {
  const client = getAuthenticatedClient(address);
  return client
    .from('pending_transactions')
    .delete()
    .eq('id', id);
}

/**
 * Cleanup expired pending transactions via RPC
 * Uses authenticated client for RLS policy compliance
 */
export function cleanupExpiredPendingTransactions(address: string) {
  const client = getAuthenticatedClient(address);
  return client.rpc('cleanup_expired_pending_transactions');
}

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Fetch notification state for a user's game
 */
export function queryUserGameNotification(address: string, gameId: string) {
  const safeAddress = sanitizeAddress(address);
  const client = getAuthenticatedClient(address);
  return client
    .from('user_game_notifications')
    .select('*')
    .eq('user_address', safeAddress)
    .eq('game_id', gameId)
    .maybeSingle();
}

/**
 * Upsert notification state
 */
export function upsertUserGameNotification(
  address: string,
  gameId: string,
  updates: Partial<{
    matched_modal_shown: boolean;
    resolved_modal_shown: boolean;
    expired_modal_shown: boolean;
    matched_sound_played: boolean;
    resolved_sound_played: boolean;
  }>
) {
  const safeAddress = sanitizeAddress(address);
  const client = getAuthenticatedClient(address);
  return client
    .from('user_game_notifications')
    .upsert(
      {
        user_address: safeAddress,
        game_id: gameId,
        ...updates,
      },
      { onConflict: 'user_address,game_id' }
    );
}

/**
 * Batch upsert notification states
 */
export function batchUpsertNotifications(
  address: string,
  updates: Array<{
    gameId: string;
    type: 'matched' | 'resolved' | 'expired';
  }>
) {
  const safeAddress = sanitizeAddress(address);
  const client = getAuthenticatedClient(address);
  const upserts = updates.map(({ gameId, type }) => ({
    user_address: safeAddress,
    game_id: gameId,
    [`${type}_modal_shown`]: true,
  }));

  return client
    .from('user_game_notifications')
    .upsert(upserts, { onConflict: 'user_address,game_id' });
}

/**
 * Prefetch notification states for multiple games
 */
export function queryUserGameNotifications(address: string, gameIds: string[]) {
  const safeAddress = sanitizeAddress(address);
  const client = getAuthenticatedClient(address);
  return client
    .from('user_game_notifications')
    .select('*')
    .eq('user_address', safeAddress)
    .in('game_id', gameIds);
}

// ============================================
// TIERS
// ============================================

/**
 * Fetch all tiers
 */
export function queryTiers() {
  return supabase
    .from('tiers')
    .select('*')
    .order('id');
}
