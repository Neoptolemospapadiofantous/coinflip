/**
 * Zod Validation Schemas
 *
 * Runtime validation schemas matching database types.
 * Use these to validate data from Supabase responses.
 */

import { z } from 'zod';

// ============================================
// ENUM SCHEMAS
// ============================================

export const GameStatusSchema = z.enum(['pending', 'matched', 'resolved', 'cancelled']);
export const PendingTxTypeSchema = z.enum(['create', 'join', 'cancel']);
export const PendingTxStatusSchema = z.enum(['pending', 'submitted', 'confirmed', 'failed', 'expired']);
export const ActivityEventTypeSchema = z.enum(['game_created', 'game_matched', 'game_resolved', 'big_win']);

// ============================================
// HELPER SCHEMAS
// ============================================

// Coerce numeric ID to string (Supabase realtime sends numbers)
const IdSchema = z.union([z.string(), z.number()]).transform(String);

// Coerce numeric to string for BigInt fields
const BigIntStringSchema = z.union([z.string(), z.number()]).transform(String);

// Nullable string that also accepts undefined
const NullableString = z.string().nullable().optional().transform(v => v ?? null);

// ============================================
// TABLE SCHEMAS
// ============================================

/**
 * Game schema - validates full game object from database
 */
export const DbGameSchema = z.object({
  id: IdSchema,
  tx_hash: z.string(),
  tier: z.number().min(0).max(9),
  amount: BigIntStringSchema,
  creator_address: z.string(),
  creator_choice: z.boolean(),
  joiner_address: NullableString,
  joiner_choice: z.boolean().nullable().optional().transform(v => v ?? null),
  status: GameStatusSchema,
  winner_address: NullableString,
  coin_result: z.boolean().nullable().optional().transform(v => v ?? null),
  payout: NullableString,
  fee: NullableString,
  block_number: BigIntStringSchema,
  matched_tx_hash: NullableString,
  matched_block_number: BigIntStringSchema.nullable().optional().transform(v => v ?? null),
  resolved_tx_hash: NullableString,
  resolved_block_number: BigIntStringSchema.nullable().optional().transform(v => v ?? null),
  cancelled_tx_hash: NullableString,
  cancelled_block_number: BigIntStringSchema.nullable().optional().transform(v => v ?? null),
  created_at: z.string(),
  matched_at: NullableString,
  resolved_at: NullableString,
  cancelled_at: NullableString,
  updated_at: z.string(),
  contract_address: NullableString,
  contract_version: z.number().nullable().optional().transform(v => v ?? null),
});

/**
 * Tier schema
 */
export const DbTierSchema = z.object({
  id: z.number(),
  amount: BigIntStringSchema,
  amount_usd: z.number(),
  win_amount: BigIntStringSchema,
  win_amount_usd: z.number(),
  players_in_queue: z.number(),
  enabled: z.boolean(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * User preferences schema
 */
export const DbUserPreferencesSchema = z.object({
  id: z.number().optional(),
  user_address: z.string(),
  skip_animation: z.boolean().default(false),
  sound_enabled: z.boolean().default(true),
  active_games_collapsed: z.boolean().default(false),
  activity_feed_collapsed: z.boolean().default(false),
  default_tier: z.number().nullable().optional().transform(v => v ?? null),
  default_choice: z.boolean().nullable().optional().transform(v => v ?? null),
  last_game_tier: z.number().nullable().optional().transform(v => v ?? null),
  last_game_choice: z.boolean().nullable().optional().transform(v => v ?? null),
  last_game_was_win: z.boolean().nullable().optional().transform(v => v ?? null),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/**
 * Pending transaction schema
 */
export const DbPendingTransactionSchema = z.object({
  id: z.number(),
  user_address: z.string(),
  tx_type: PendingTxTypeSchema,
  tx_hash: NullableString,
  game_id: z.number().nullable().optional().transform(v => v ?? null),
  tier: z.number().nullable().optional().transform(v => v ?? null),
  choice: z.boolean().nullable().optional().transform(v => v ?? null),
  amount_eth: NullableString,
  status: PendingTxStatusSchema,
  error_message: NullableString,
  created_at: z.string(),
  updated_at: z.string(),
});

/**
 * Activity feed item schema
 */
export const DbActivityFeedSchema = z.object({
  id: z.number(),
  event_type: ActivityEventTypeSchema,
  game_id: z.number(),
  player_address: z.string(),
  opponent_address: NullableString,
  tier: z.number(),
  amount: BigIntStringSchema,
  payout: NullableString,
  is_winner: z.boolean().nullable().optional().transform(v => v ?? null),
  coin_result: z.boolean().nullable().optional().transform(v => v ?? null),
  created_at: z.string(),
});

// ============================================
// VIEW SCHEMAS
// ============================================

/**
 * Game statistics view schema
 */
export const DbGameStatisticsSchema = z.object({
  total_games: z.number(),
  pending_games: z.number(),
  matched_games: z.number(),
  resolved_games: z.number(),
  cancelled_games: z.number(),
  avg_game_duration_seconds: z.number().nullable(),
  total_volume_wei: BigIntStringSchema,
  total_unique_players: z.number(),
  games_by_tier: z.array(z.number()).nullable(),
});

/**
 * Pending games by tier view schema
 */
export const DbPendingByTierSchema = z.object({
  tier: z.number(),
  pending_count: z.number(),
  oldest_game: NullableString,
  newest_game: NullableString,
  avg_wait_seconds: z.number().nullable(),
});

/**
 * Tier match statistics view schema
 */
export const DbTierMatchStatsSchema = z.object({
  tier: z.number(),
  total_resolved: z.number(),
  currently_pending: z.number(),
  avg_match_time_seconds: z.number().nullable(),
  median_match_time_seconds: z.number().nullable(),
  p90_match_time_seconds: z.number().nullable(),
  recent_avg_match_time_seconds: z.number().nullable(),
  recent_match_count: z.number(),
});

// ============================================
// RPC RETURN SCHEMAS
// ============================================

/**
 * Player stats RPC schema
 */
export const DbPlayerStatsV2Schema = z.object({
  total_games: z.number(),
  wins: z.number(),
  losses: z.number(),
  pending_games: z.number().optional().default(0),
  total_wagered: BigIntStringSchema,
  total_won: BigIntStringSchema,
  total_lost: BigIntStringSchema.optional().default('0'),
  games_by_tier: z.array(z.number()).optional().default([0, 0, 0, 0, 0]),
  wins_by_tier: z.array(z.number()).optional().default([0, 0, 0, 0, 0]),
});

/**
 * Leaderboard entry schema
 */
export const DbLeaderboardEntrySchema = z.object({
  rank: z.number(),
  player_address: z.string(),
  wins: z.number(),
  losses: z.number(),
  total_games: z.number(),
  win_rate: z.number(),
  total_profit: BigIntStringSchema,
  total_wagered: BigIntStringSchema,
});

/**
 * Player rank schema
 */
export const DbPlayerRankSchema = z.object({
  rank_by_wins: z.number(),
  rank_by_profit: z.number(),
  rank_by_winrate: z.number(),
  rank_by_volume: z.number(),
  total_players: z.number(),
  player_wins: z.number(),
  player_losses: z.number(),
  player_total_games: z.number(),
  player_win_rate: z.number(),
  player_total_profit: BigIntStringSchema,
  player_total_wagered: BigIntStringSchema,
});

/**
 * Leaderboard stats schema
 */
export const DbLeaderboardStatsSchema = z.object({
  total_players: z.number(),
  total_games: z.number(),
  total_volume: BigIntStringSchema,
  avg_win_rate: z.number(),
});

// ============================================
// INFERRED TYPES
// ============================================

export type ValidatedGame = z.infer<typeof DbGameSchema>;
export type ValidatedTier = z.infer<typeof DbTierSchema>;
export type ValidatedUserPreferences = z.infer<typeof DbUserPreferencesSchema>;
export type ValidatedPendingTransaction = z.infer<typeof DbPendingTransactionSchema>;
export type ValidatedActivityFeed = z.infer<typeof DbActivityFeedSchema>;
export type ValidatedGameStatistics = z.infer<typeof DbGameStatisticsSchema>;
export type ValidatedPendingByTier = z.infer<typeof DbPendingByTierSchema>;
export type ValidatedTierMatchStats = z.infer<typeof DbTierMatchStatsSchema>;
export type ValidatedPlayerStats = z.infer<typeof DbPlayerStatsV2Schema>;
export type ValidatedLeaderboardEntry = z.infer<typeof DbLeaderboardEntrySchema>;
export type ValidatedPlayerRank = z.infer<typeof DbPlayerRankSchema>;
