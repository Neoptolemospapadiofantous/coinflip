/**
 * User Query Functions
 *
 * Centralized user-related queries (preferences, pending transactions, notifications).
 */

import { supabase, getAuthenticatedClient } from '@/lib/supabase';
import type { UpdateUserPreferencesInput, CreatePendingTxInput, UpdatePendingTxInput } from '@/types/database';

// ============================================
// USER PREFERENCES
// ============================================

/**
 * Fetch user preferences
 */
export function queryUserPreferences(address: string) {
  const client = getAuthenticatedClient(address);
  return client
    .from('user_preferences')
    .select('*')
    .eq('user_address', address.toLowerCase())
    .single();
}

/**
 * Upsert user preferences
 */
export function upsertUserPreferences(address: string, updates: UpdateUserPreferencesInput) {
  const client = getAuthenticatedClient(address);
  return client
    .from('user_preferences')
    .upsert(
      {
        user_address: address.toLowerCase(),
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
 */
export function queryPendingTransactions(address: string) {
  return supabase
    .from('pending_transactions')
    .select('*')
    .eq('user_address', address.toLowerCase())
    .in('status', ['pending', 'submitted'])
    .order('created_at', { ascending: false });
}

/**
 * Create a new pending transaction
 */
export function createPendingTransaction(input: CreatePendingTxInput) {
  return supabase
    .from('pending_transactions')
    .insert({
      user_address: input.user_address.toLowerCase(),
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
 */
export function updatePendingTransaction(id: number, updates: UpdatePendingTxInput) {
  return supabase
    .from('pending_transactions')
    .update(updates)
    .eq('id', id);
}

/**
 * Delete a pending transaction
 */
export function deletePendingTransaction(id: number) {
  return supabase
    .from('pending_transactions')
    .delete()
    .eq('id', id);
}

/**
 * Cleanup expired pending transactions via RPC
 */
export function cleanupExpiredPendingTransactions() {
  return supabase.rpc('cleanup_expired_pending_transactions');
}

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Fetch notification state for a user's game
 */
export function queryUserGameNotification(address: string, gameId: string) {
  const client = getAuthenticatedClient(address);
  return client
    .from('user_game_notifications')
    .select('*')
    .eq('user_address', address.toLowerCase())
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
  const client = getAuthenticatedClient(address);
  return client
    .from('user_game_notifications')
    .upsert(
      {
        user_address: address.toLowerCase(),
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
  const client = getAuthenticatedClient(address);
  const upserts = updates.map(({ gameId, type }) => ({
    user_address: address.toLowerCase(),
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
  const client = getAuthenticatedClient(address);
  return client
    .from('user_game_notifications')
    .select('*')
    .eq('user_address', address.toLowerCase())
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
