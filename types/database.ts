/**
 * Database Types - Single Source of Truth
 *
 * All types in this file match the actual Supabase database schema exactly.
 * Use snake_case to match database columns directly.
 *
 * When importing into components/hooks, use these types or the
 * transformation functions to convert to camelCase if needed.
 *
 * Generated based on database schema verification on 2025-01-03
 */

// ============================================
// ENUMS
// ============================================

export type GameStatus = 'pending' | 'matched' | 'resolved' | 'cancelled';
export type PendingTxType = 'create' | 'join' | 'cancel';
export type PendingTxStatus = 'pending' | 'submitted' | 'confirmed' | 'failed' | 'expired';
export type ActivityEventType = 'game_created' | 'game_matched' | 'game_resolved' | 'big_win';

// ============================================
// TABLE TYPES (Direct database rows)
// ============================================

/**
 * Games table - Core game data
 * Matches: public.games
 */
export interface DbGame {
  id: number;
  tx_hash: string;
  tier: number;
  amount: string;
  creator_address: string;
  creator_choice: boolean;
  joiner_address: string | null;
  joiner_choice: boolean | null;
  status: GameStatus;
  winner_address: string | null;
  coin_result: boolean | null;
  payout: string | null;
  fee: string | null;
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
  contract_address: string | null;
  contract_version: number | null;
}

/**
 * Tiers table - Game tier configuration
 * Matches: public.tiers
 */
export interface DbTier {
  id: number;
  amount: string; // wei as string
  amount_usd: number;
  win_amount: string; // wei as string
  win_amount_usd: number;
  players_in_queue: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * User preferences table
 * Matches: public.user_preferences
 */
export interface DbUserPreferences {
  id: number;
  user_address: string;
  skip_animation: boolean;
  sound_enabled: boolean;
  active_games_collapsed: boolean;
  activity_feed_collapsed: boolean;
  default_tier: number | null;
  default_choice: boolean | null;
  last_game_tier: number | null;
  last_game_choice: boolean | null;
  last_game_was_win: boolean | null;
  created_at: string;
  updated_at: string;
}

/**
 * Pending transactions table
 * Matches: public.pending_transactions
 */
export interface DbPendingTransaction {
  id: number;
  user_address: string;
  tx_type: PendingTxType;
  tx_hash: string | null;
  game_id: number | null;
  tier: number | null;
  choice: boolean | null;
  amount_eth: string | null;
  status: PendingTxStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * User game notifications table
 * Matches: public.user_game_notifications
 */
export interface DbUserGameNotification {
  id: number;
  user_address: string;
  game_id: string;
  matched_modal_shown: boolean;
  resolved_modal_shown: boolean;
  expired_modal_shown: boolean;
  matched_sound_played: boolean;
  resolved_sound_played: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Activity feed table
 * Matches: public.activity_feed
 */
export interface DbActivityFeed {
  id: number;
  event_type: ActivityEventType;
  game_id: number;
  player_address: string;
  opponent_address: string | null;
  tier: number;
  amount: string;
  payout: string | null;
  is_winner: boolean | null;
  coin_result: boolean | null;
  created_at: string;
}

/**
 * Indexer state table
 * Matches: public.indexer_state
 */
export interface DbIndexerState {
  id: number;
  indexer_name: string;
  last_processed_block: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// VIEW TYPES (Database views)
// ============================================

/**
 * Game statistics view
 * Matches: public.game_statistics
 */
export interface DbGameStatistics {
  total_games: number;
  pending_games: number;
  matched_games: number;
  resolved_games: number;
  cancelled_games: number;
  avg_game_duration_seconds: number | null;
  total_volume_wei: string;
  total_unique_players: number;
  games_by_tier: number[] | null;
}

/**
 * Pending games by tier view
 * Matches: public.pending_games_by_tier
 */
export interface DbPendingByTier {
  tier: number;
  pending_count: number;
  oldest_game: string | null;
  newest_game: string | null;
  avg_wait_seconds: number | null;
}

/**
 * Tier match statistics view
 * Matches: public.tier_match_stats
 */
export interface DbTierMatchStats {
  tier: number;
  total_resolved: number;
  currently_pending: number;
  avg_match_time_seconds: number | null;
  median_match_time_seconds: number | null;
  p90_match_time_seconds: number | null;
  recent_avg_match_time_seconds: number | null;
  recent_match_count: number;
}

// ============================================
// RPC RETURN TYPES
// ============================================

/**
 * Player stats RPC return type
 * From: get_player_stats_v2(player_address)
 */
export interface DbPlayerStatsV2 {
  total_games: number;
  wins: number;
  losses: number;
  pending_games: number;
  total_wagered: string;
  total_won: string;
  total_lost: string;
  games_by_tier: number[];
  wins_by_tier: number[];
}

/**
 * Leaderboard entry RPC return type
 * From: get_leaderboard_by_*
 */
export interface DbLeaderboardEntry {
  rank: number;
  player_address: string;
  wins: number;
  losses: number;
  total_games: number;
  win_rate: number;
  total_profit: string;
  total_wagered: string;
}

/**
 * Player rank RPC return type
 * From: get_player_rank(player_address)
 */
export interface DbPlayerRank {
  rank_by_wins: number;
  rank_by_profit: number;
  rank_by_winrate: number;
  rank_by_volume: number;
  total_players: number;
  player_wins: number;
  player_losses: number;
  player_total_games: number;
  player_win_rate: number;
  player_total_profit: string;
  player_total_wagered: string;
}

/**
 * Leaderboard stats RPC return type
 * From: get_leaderboard_stats()
 */
export interface DbLeaderboardStats {
  total_players: number;
  total_games: number;
  total_volume: string;
  avg_win_rate: number;
}

/**
 * Realtime stats RPC return type
 * From: get_realtime_stats()
 */
export interface DbRealtimeStats {
  pending_by_tier: DbPendingByTier[] | null;
  match_times: DbTierMatchStats[] | null;
  recent_activity: DbActivityFeed[] | null;
  indexer_state: { last_block: string; updated_at: string } | null;
}

// ============================================
// INSERT/UPDATE TYPES
// ============================================

/**
 * Create pending transaction input
 */
export interface CreatePendingTxInput {
  user_address: string;
  tx_type: PendingTxType;
  tx_hash?: string;
  game_id?: number;
  tier?: number;
  choice?: boolean;
  amount_eth?: string;
  status?: PendingTxStatus;
}

/**
 * Update pending transaction input
 */
export interface UpdatePendingTxInput {
  tx_hash?: string;
  status?: PendingTxStatus;
  error_message?: string | null;
}

/**
 * Update user preferences input
 */
export interface UpdateUserPreferencesInput {
  skip_animation?: boolean;
  sound_enabled?: boolean;
  active_games_collapsed?: boolean;
  activity_feed_collapsed?: boolean;
  default_tier?: number | null;
  default_choice?: boolean | null;
  last_game_tier?: number | null;
  last_game_choice?: boolean | null;
  last_game_was_win?: boolean | null;
}

// ============================================
// COLUMN DEFINITIONS
// ============================================

/**
 * Column selectors for optimized queries
 * Use these instead of SELECT * for better performance
 */
export const DB_COLUMNS = {
  /** Full game columns for detail views */
  GAME_FULL: `
    id, tx_hash, tier, amount, creator_address, creator_choice,
    joiner_address, joiner_choice, status, winner_address, coin_result,
    payout, fee, block_number, matched_tx_hash, matched_block_number,
    resolved_tx_hash, resolved_block_number, cancelled_tx_hash,
    cancelled_block_number, created_at, matched_at, resolved_at,
    cancelled_at, updated_at, contract_address, contract_version
  `,

  /** Game list columns (lobby, history) */
  GAME_LIST: `
    id, tx_hash, tier, amount, creator_address, creator_choice,
    joiner_address, joiner_choice, status, winner_address, coin_result,
    payout, fee, block_number, created_at, updated_at, matched_at, resolved_at
  `,

  /** Minimal pending game columns */
  GAME_PENDING: `
    id, tx_hash, tier, amount, creator_address, creator_choice, status,
    block_number, created_at, updated_at
  `,

  /** Game statistics view columns */
  GAME_STATS: `
    total_games, pending_games, matched_games, resolved_games, cancelled_games,
    avg_game_duration_seconds, total_volume_wei, total_unique_players, games_by_tier
  `,

  /** Activity feed columns */
  ACTIVITY_FEED: `
    id, event_type, game_id, player_address, opponent_address,
    tier, amount, payout, is_winner, coin_result, created_at
  `,
} as const;

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if status is a valid GameStatus
 */
export function isValidGameStatus(status: unknown): status is GameStatus {
  return ['pending', 'matched', 'resolved', 'cancelled'].includes(status as string);
}

/**
 * Check if status is a valid PendingTxStatus
 */
export function isValidPendingTxStatus(status: unknown): status is PendingTxStatus {
  return ['pending', 'submitted', 'confirmed', 'failed', 'expired'].includes(status as string);
}

/**
 * Check if type is a valid PendingTxType
 */
export function isValidPendingTxType(type: unknown): type is PendingTxType {
  return ['create', 'join', 'cancel'].includes(type as string);
}

/**
 * Check if type is a valid ActivityEventType
 */
export function isValidActivityEventType(type: unknown): type is ActivityEventType {
  return ['game_created', 'game_matched', 'game_resolved', 'big_win'].includes(type as string);
}
