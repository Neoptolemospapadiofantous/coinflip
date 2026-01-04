/**
 * Stats Query Functions
 *
 * Centralized statistics queries for consistency across hooks.
 */

import { supabase } from '@/lib/supabase';
import { DB_COLUMNS } from '@/types/database';

/**
 * Fetch game statistics from the view
 */
export function queryGameStats() {
  return supabase
    .from('game_statistics')
    .select(DB_COLUMNS.GAME_STATS)
    .single();
}

/**
 * Fetch pending games by tier from the view
 */
export function queryPendingByTier() {
  return supabase
    .from('pending_games_by_tier')
    .select('*')
    .order('tier');
}

/**
 * Fetch tier match time statistics from the view
 */
export function queryTierMatchStats() {
  return supabase
    .from('tier_match_stats')
    .select('*')
    .order('tier');
}

/**
 * Fetch activity feed items
 */
export function queryActivityFeed(limit: number = 10) {
  return supabase
    .from('activity_feed')
    .select(DB_COLUMNS.ACTIVITY_FEED)
    .order('created_at', { ascending: false })
    .limit(limit);
}

/**
 * Fetch indexer state
 */
export function queryIndexerState(indexerName: string = 'coinflip_events') {
  return supabase
    .from('indexer_state')
    .select('last_processed_block, updated_at')
    .eq('indexer_name', indexerName)
    .single();
}

/**
 * Fetch player stats via RPC
 */
export function queryPlayerStats(address: string) {
  return supabase.rpc('get_player_stats_v2', {
    player_address: address.toLowerCase(),
  });
}

/**
 * Fetch player stats via basic RPC (fallback)
 */
export function queryPlayerStatsBasic(address: string) {
  return supabase.rpc('get_player_stats', {
    player_address: address.toLowerCase(),
  });
}

/**
 * Fetch realtime stats bundle via RPC
 */
export function queryRealtimeStats() {
  return supabase.rpc('get_realtime_stats');
}

/**
 * Fetch leaderboard by type
 */
export function queryLeaderboard(
  type: 'wins' | 'profit' | 'winrate' | 'volume',
  options: { limit?: number; offset?: number; minGames?: number } = {}
) {
  const { limit = 50, offset = 0, minGames = 10 } = options;

  const rpcMap = {
    wins: 'get_leaderboard_by_wins',
    profit: 'get_leaderboard_by_profit',
    winrate: 'get_leaderboard_by_winrate',
    volume: 'get_leaderboard_by_volume',
  } as const;

  const params: Record<string, number> = {
    p_limit: limit,
    p_offset: offset,
  };

  if (type === 'winrate') {
    params.p_min_games = minGames;
  }

  return supabase.rpc(rpcMap[type], params);
}

/**
 * Fetch player rank via RPC
 */
export function queryPlayerRank(address: string) {
  return supabase.rpc('get_player_rank', {
    p_player_address: address.toLowerCase(),
  });
}

/**
 * Fetch leaderboard stats via RPC
 */
export function queryLeaderboardStats() {
  return supabase.rpc('get_leaderboard_stats');
}
