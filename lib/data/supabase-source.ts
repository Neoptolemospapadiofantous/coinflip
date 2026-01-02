/**
 * Supabase Data Source
 *
 * Reads game data from the Supabase indexed database.
 * Used in centralized mode when user is logged in.
 *
 * Features:
 * - Fast indexed queries
 * - Realtime subscriptions
 * - User preferences (cloud synced)
 * - Cross-device sync
 * - Activity feed
 * - Match time estimates
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, getAuthenticatedClient } from '@/lib/supabase';
import { Game, parseGame } from '@/types/game';
import {
  GameDataSource,
  EnhancedDataSource,
  Tier,
  PlayerStats,
  GameStats,
  UserPreferences,
  PendingTransaction,
  CreatePendingTransaction,
  GameNotifications,
  ActivityFeedItem,
  MatchTimeEstimate,
} from './types';
import { devLog } from '@/lib/utils';

// ============================================
// COLUMN SELECTIONS
// ============================================

const GAME_COLUMNS = `
  id, tx_hash, tier, amount, creator_address, creator_choice,
  joiner_address, joiner_choice, status, winner_address, coin_result,
  payout, fee, block_number, matched_tx_hash, matched_block_number,
  resolved_tx_hash, resolved_block_number, cancelled_tx_hash,
  cancelled_block_number, created_at, matched_at, resolved_at,
  cancelled_at, updated_at, contract_address, contract_version
`;

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizeGames(data: unknown[] | null): Game[] {
  if (!data) return [];
  return data
    .map(parseGame)
    .filter((game): game is Game => game !== null);
}

function snakeToCamel<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

// ============================================
// SUPABASE DATA SOURCE IMPLEMENTATION
// ============================================

export class SupabaseDataSource implements EnhancedDataSource {
  readonly name = 'supabase' as const;
  readonly isRealtime = true;

  private channels: Map<string, RealtimeChannel> = new Map();
  private walletAddress: string | null = null;

  constructor(walletAddress?: string) {
    this.walletAddress = walletAddress?.toLowerCase() || null;
  }

  private getClient() {
    if (this.walletAddress) {
      return getAuthenticatedClient(this.walletAddress);
    }
    return supabase;
  }

  // ============================================
  // GAME QUERIES
  // ============================================

  async getGames(limit = 100): Promise<Game[]> {
    const { data, error } = await this.getClient()
      .from('games')
      .select(GAME_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      devLog.error('[SupabaseDS] Error fetching games:', error);
      throw error;
    }

    return normalizeGames(data);
  }

  async getPendingGames(): Promise<Game[]> {
    const { data, error } = await this.getClient()
      .from('games')
      .select(GAME_COLUMNS)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      devLog.error('[SupabaseDS] Error fetching pending games:', error);
      throw error;
    }

    return normalizeGames(data);
  }

  async getActiveGames(): Promise<Game[]> {
    const { data, error } = await this.getClient()
      .from('games')
      .select(GAME_COLUMNS)
      .in('status', ['pending', 'matched'])
      .order('created_at', { ascending: false });

    if (error) {
      devLog.error('[SupabaseDS] Error fetching active games:', error);
      throw error;
    }

    return normalizeGames(data);
  }

  async getGame(id: string): Promise<Game | null> {
    const { data, error } = await this.getClient()
      .from('games')
      .select(GAME_COLUMNS)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      devLog.error('[SupabaseDS] Error fetching game:', error);
      throw error;
    }

    return parseGame(data);
  }

  async getGameByTxHash(txHash: string): Promise<Game | null> {
    const { data, error } = await this.getClient()
      .from('games')
      .select(GAME_COLUMNS)
      .eq('tx_hash', txHash.toLowerCase())
      .maybeSingle();

    if (error) {
      devLog.error('[SupabaseDS] Error fetching game by tx hash:', error);
      throw error;
    }

    return data ? parseGame(data) : null;
  }

  // ============================================
  // PLAYER QUERIES
  // ============================================

  async getPlayerGames(address: string, limit = 50): Promise<Game[]> {
    const lowerAddress = address.toLowerCase();

    const { data, error } = await this.getClient()
      .from('games')
      .select(GAME_COLUMNS)
      .or(`creator_address.ilike.${lowerAddress},joiner_address.ilike.${lowerAddress}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      devLog.error('[SupabaseDS] Error fetching player games:', error);
      throw error;
    }

    return normalizeGames(data);
  }

  async getPlayerActiveGames(address: string): Promise<Game[]> {
    const lowerAddress = address.toLowerCase();

    const { data, error } = await this.getClient()
      .from('games')
      .select(GAME_COLUMNS)
      .or(`creator_address.ilike.${lowerAddress},joiner_address.ilike.${lowerAddress}`)
      .in('status', ['pending', 'matched'])
      .order('created_at', { ascending: false });

    if (error) {
      devLog.error('[SupabaseDS] Error fetching player active games:', error);
      throw error;
    }

    return normalizeGames(data);
  }

  async getPlayerStats(address: string): Promise<PlayerStats | null> {
    const lowerAddress = address.toLowerCase();

    const { data, error } = await this.getClient()
      .rpc('get_player_stats_v2', { player_address: lowerAddress });

    if (error) {
      devLog.error('[SupabaseDS] Error fetching player stats:', error);
      return null;
    }

    if (!data || data.length === 0) return null;

    const stats = data[0];
    return {
      address: lowerAddress,
      totalGames: stats.total_games || 0,
      wins: stats.wins || 0,
      losses: stats.losses || 0,
      winRate: stats.win_rate || 0,
      totalWagered: stats.total_wagered || '0',
      totalWon: stats.total_won || '0',
      netProfit: stats.net_profit || '0',
    };
  }

  // ============================================
  // TIER QUERIES
  // ============================================

  async getTiers(): Promise<Tier[]> {
    const { data, error } = await this.getClient()
      .from('tiers')
      .select('*')
      .eq('enabled', true)
      .order('id');

    if (error) {
      devLog.error('[SupabaseDS] Error fetching tiers:', error);
      throw error;
    }

    return (data || []).map(tier => ({
      id: tier.id,
      amount: tier.amount,
      amountUsd: tier.amount_usd,
      winAmount: tier.win_amount,
      winAmountUsd: tier.win_amount_usd,
      enabled: tier.enabled,
    }));
  }

  async getPendingCountByTier(): Promise<Record<number, number>> {
    const { data, error } = await this.getClient()
      .from('pending_games_by_tier')
      .select('*');

    if (error) {
      devLog.error('[SupabaseDS] Error fetching pending by tier:', error);
      return {};
    }

    const counts: Record<number, number> = {};
    for (const row of data || []) {
      counts[row.tier] = row.players_in_queue || 0;
    }
    return counts;
  }

  // ============================================
  // GLOBAL STATS
  // ============================================

  async getGameStats(): Promise<GameStats> {
    const { data, error } = await this.getClient()
      .from('game_statistics')
      .select('*')
      .single();

    if (error) {
      devLog.error('[SupabaseDS] Error fetching game stats:', error);
      return {
        totalGames: 0,
        pendingGames: 0,
        matchedGames: 0,
        resolvedGames: 0,
        cancelledGames: 0,
        totalVolume: '0',
        uniquePlayers: 0,
      };
    }

    return {
      totalGames: data.total_games || 0,
      pendingGames: data.pending_games || 0,
      matchedGames: data.matched_games || 0,
      resolvedGames: data.resolved_games || 0,
      cancelledGames: data.cancelled_games || 0,
      totalVolume: data.total_volume_wei || '0',
      uniquePlayers: data.total_unique_players || 0,
    };
  }

  // ============================================
  // REALTIME SUBSCRIPTIONS
  // ============================================

  subscribeToGame(gameId: string, callback: (game: Game) => void): () => void {
    const channelName = `game-${gameId}`;

    const channel = this.getClient()
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const game = parseGame(payload.new);
          if (game) {
            callback(game);
          }
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  subscribeToPlayerGames(address: string, callback: (games: Game[]) => void): () => void {
    const lowerAddress = address.toLowerCase();
    const channelName = `player-${lowerAddress}`;

    const channel = this.getClient()
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
        },
        async (payload) => {
          const game = payload.new as Record<string, unknown>;
          const creator = (game.creator_address as string)?.toLowerCase();
          const joiner = (game.joiner_address as string)?.toLowerCase();

          if (creator === lowerAddress || joiner === lowerAddress) {
            const games = await this.getPlayerActiveGames(address);
            callback(games);
          }
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  subscribeToAllGames(callback: (games: Game[]) => void): () => void {
    const channelName = 'all-games';

    const channel = this.getClient()
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
        },
        async () => {
          const games = await this.getActiveGames();
          callback(games);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async isAvailable(): Promise<boolean> {
    try {
      const { error } = await this.getClient()
        .from('tiers')
        .select('id')
        .limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  // ============================================
  // ENHANCED FEATURES (Login Required)
  // ============================================

  async getUserPreferences(address: string): Promise<UserPreferences | null> {
    const { data, error } = await this.getClient()
      .from('user_preferences')
      .select('*')
      .eq('user_address', address.toLowerCase())
      .maybeSingle();

    if (error || !data) return null;

    return snakeToCamel(data) as unknown as UserPreferences;
  }

  async updateUserPreferences(address: string, prefs: Partial<UserPreferences>): Promise<void> {
    const snakePrefs = camelToSnake(prefs as Record<string, unknown>);

    const { error } = await this.getClient()
      .from('user_preferences')
      .upsert({
        user_address: address.toLowerCase(),
        ...snakePrefs,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      devLog.error('[SupabaseDS] Error updating preferences:', error);
      throw error;
    }
  }

  async getPendingTransactions(address: string): Promise<PendingTransaction[]> {
    const { data, error } = await this.getClient()
      .from('pending_transactions')
      .select('*')
      .eq('user_address', address.toLowerCase())
      .in('status', ['pending', 'submitted'])
      .order('created_at', { ascending: false });

    if (error) {
      devLog.error('[SupabaseDS] Error fetching pending transactions:', error);
      return [];
    }

    return (data || []).map(tx => snakeToCamel(tx) as unknown as PendingTransaction);
  }

  async createPendingTransaction(tx: CreatePendingTransaction): Promise<PendingTransaction> {
    const { data, error } = await this.getClient()
      .from('pending_transactions')
      .insert({
        user_address: tx.userAddress.toLowerCase(),
        tx_type: tx.txType,
        tx_hash: tx.txHash || null,
        game_id: tx.gameId || null,
        tier: tx.tier ?? null,
        choice: tx.choice ?? null,
        amount_eth: tx.amountEth || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      devLog.error('[SupabaseDS] Error creating pending transaction:', error);
      throw error;
    }

    return snakeToCamel(data) as unknown as PendingTransaction;
  }

  async updatePendingTransaction(id: string, updates: Partial<PendingTransaction>): Promise<void> {
    const snakeUpdates = camelToSnake(updates as Record<string, unknown>);

    const { error } = await this.getClient()
      .from('pending_transactions')
      .update({
        ...snakeUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      devLog.error('[SupabaseDS] Error updating pending transaction:', error);
      throw error;
    }
  }

  async deletePendingTransaction(id: string): Promise<void> {
    const { error } = await this.getClient()
      .from('pending_transactions')
      .delete()
      .eq('id', id);

    if (error) {
      devLog.error('[SupabaseDS] Error deleting pending transaction:', error);
      throw error;
    }
  }

  async getNotifications(address: string, gameId: string): Promise<GameNotifications | null> {
    const { data, error } = await this.getClient()
      .from('user_game_notifications')
      .select('*')
      .eq('user_address', address.toLowerCase())
      .eq('game_id', gameId)
      .maybeSingle();

    if (error || !data) return null;

    return snakeToCamel(data) as unknown as GameNotifications;
  }

  async updateNotifications(address: string, gameId: string, updates: Partial<GameNotifications>): Promise<void> {
    const snakeUpdates = camelToSnake(updates as Record<string, unknown>);

    const { error } = await this.getClient()
      .from('user_game_notifications')
      .upsert({
        user_address: address.toLowerCase(),
        game_id: gameId,
        ...snakeUpdates,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      devLog.error('[SupabaseDS] Error updating notifications:', error);
      throw error;
    }
  }

  async getActivityFeed(limit = 20): Promise<ActivityFeedItem[]> {
    const { data, error } = await this.getClient()
      .from('activity_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      devLog.error('[SupabaseDS] Error fetching activity feed:', error);
      return [];
    }

    return (data || []).map(item => snakeToCamel(item) as unknown as ActivityFeedItem);
  }

  subscribeToActivityFeed(callback: (items: ActivityFeedItem[]) => void): () => void {
    const channelName = 'activity-feed';

    const channel = this.getClient()
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
        },
        async () => {
          const items = await this.getActivityFeed();
          callback(items);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  async getMatchTimeEstimates(): Promise<Record<number, MatchTimeEstimate>> {
    const { data, error } = await this.getClient()
      .from('tier_match_stats')
      .select('*');

    if (error) {
      devLog.error('[SupabaseDS] Error fetching match time estimates:', error);
      return {};
    }

    const estimates: Record<number, MatchTimeEstimate> = {};

    for (const row of data || []) {
      const sampleSize = row.recent_match_count || 0;
      let confidence: MatchTimeEstimate['confidence'] = 'none';

      if (sampleSize >= 50) confidence = 'high';
      else if (sampleSize >= 20) confidence = 'medium';
      else if (sampleSize >= 5) confidence = 'low';

      estimates[row.tier] = {
        tierId: row.tier,
        avgMatchTimeSeconds: row.avg_match_time_seconds,
        recentAvgSeconds: row.recent_avg_match_time_seconds,
        confidence,
        sampleSize,
      };
    }

    return estimates;
  }

  // ============================================
  // CLEANUP
  // ============================================

  destroy(): void {
    for (const channel of this.channels.values()) {
      channel.unsubscribe();
    }
    this.channels.clear();
  }
}

// Factory function
export function getSupabaseDataSource(walletAddress?: string): SupabaseDataSource {
  return new SupabaseDataSource(walletAddress);
}
