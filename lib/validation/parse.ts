/**
 * Parsing Functions
 *
 * Type-safe parsing using Zod schemas.
 * These functions validate and transform data from Supabase.
 */

import { devLog } from '@/lib/utils';
import {
  DbGameSchema,
  DbTierSchema,
  DbUserPreferencesSchema,
  DbPendingTransactionSchema,
  DbActivityFeedSchema,
  DbGameStatisticsSchema,
  DbPendingByTierSchema,
  DbTierMatchStatsSchema,
  DbPlayerStatsV2Schema,
  DbLeaderboardEntrySchema,
  DbPlayerRankSchema,
  DbLeaderboardStatsSchema,
  type ValidatedGame,
  type ValidatedTier,
  type ValidatedUserPreferences,
  type ValidatedPendingTransaction,
  type ValidatedActivityFeed,
  type ValidatedGameStatistics,
  type ValidatedPendingByTier,
  type ValidatedTierMatchStats,
  type ValidatedPlayerStats,
  type ValidatedLeaderboardEntry,
  type ValidatedPlayerRank,
} from './schemas';

// ============================================
// SINGLE ITEM PARSERS
// ============================================

/**
 * Parse a single game from database response
 */
export function parseDbGame(data: unknown): ValidatedGame | null {
  const result = DbGameSchema.safeParse(data);
  if (!result.success) {
    devLog.warn('[Validation] Invalid game:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Parse a single tier from database response
 */
export function parseDbTier(data: unknown): ValidatedTier | null {
  const result = DbTierSchema.safeParse(data);
  if (!result.success) {
    devLog.warn('[Validation] Invalid tier:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Parse user preferences from database response
 */
export function parseDbUserPreferences(data: unknown): ValidatedUserPreferences | null {
  const result = DbUserPreferencesSchema.safeParse(data);
  if (!result.success) {
    devLog.warn('[Validation] Invalid user preferences:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Parse a pending transaction from database response
 */
export function parseDbPendingTransaction(data: unknown): ValidatedPendingTransaction | null {
  const result = DbPendingTransactionSchema.safeParse(data);
  if (!result.success) {
    devLog.warn('[Validation] Invalid pending transaction:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Parse an activity feed item from database response
 */
export function parseDbActivityFeed(data: unknown): ValidatedActivityFeed | null {
  const result = DbActivityFeedSchema.safeParse(data);
  if (!result.success) {
    devLog.warn('[Validation] Invalid activity feed item:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Parse game statistics from database response
 */
export function parseDbGameStatistics(data: unknown): ValidatedGameStatistics | null {
  const result = DbGameStatisticsSchema.safeParse(data);
  if (!result.success) {
    devLog.warn('[Validation] Invalid game statistics:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Parse pending by tier from database response
 */
export function parseDbPendingByTier(data: unknown): ValidatedPendingByTier | null {
  const result = DbPendingByTierSchema.safeParse(data);
  if (!result.success) {
    devLog.warn('[Validation] Invalid pending by tier:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Parse tier match stats from database response
 */
export function parseDbTierMatchStats(data: unknown): ValidatedTierMatchStats | null {
  const result = DbTierMatchStatsSchema.safeParse(data);
  if (!result.success) {
    devLog.warn('[Validation] Invalid tier match stats:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Parse player stats from RPC response
 */
export function parseDbPlayerStats(data: unknown): ValidatedPlayerStats | null {
  const result = DbPlayerStatsV2Schema.safeParse(data);
  if (!result.success) {
    devLog.warn('[Validation] Invalid player stats:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Parse leaderboard entry from RPC response
 */
export function parseDbLeaderboardEntry(data: unknown): ValidatedLeaderboardEntry | null {
  const result = DbLeaderboardEntrySchema.safeParse(data);
  if (!result.success) {
    devLog.warn('[Validation] Invalid leaderboard entry:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Parse player rank from RPC response
 */
export function parseDbPlayerRank(data: unknown): ValidatedPlayerRank | null {
  const result = DbPlayerRankSchema.safeParse(data);
  if (!result.success) {
    devLog.warn('[Validation] Invalid player rank:', result.error.issues);
    return null;
  }
  return result.data;
}

// ============================================
// ARRAY PARSERS
// ============================================

/**
 * Parse an array of games, filtering out invalid ones
 */
export function parseDbGames(data: unknown[] | null): ValidatedGame[] {
  if (!data) return [];
  return data
    .map(parseDbGame)
    .filter((game): game is ValidatedGame => game !== null);
}

/**
 * Parse an array of tiers, filtering out invalid ones
 */
export function parseDbTiers(data: unknown[] | null): ValidatedTier[] {
  if (!data) return [];
  return data
    .map(parseDbTier)
    .filter((tier): tier is ValidatedTier => tier !== null);
}

/**
 * Parse an array of pending transactions, filtering out invalid ones
 */
export function parseDbPendingTransactions(data: unknown[] | null): ValidatedPendingTransaction[] {
  if (!data) return [];
  return data
    .map(parseDbPendingTransaction)
    .filter((tx): tx is ValidatedPendingTransaction => tx !== null);
}

/**
 * Parse an array of activity feed items, filtering out invalid ones
 */
export function parseDbActivityFeedItems(data: unknown[] | null): ValidatedActivityFeed[] {
  if (!data) return [];
  return data
    .map(parseDbActivityFeed)
    .filter((item): item is ValidatedActivityFeed => item !== null);
}

/**
 * Parse an array of pending by tier, filtering out invalid ones
 */
export function parseDbPendingByTiers(data: unknown[] | null): ValidatedPendingByTier[] {
  if (!data) return [];
  return data
    .map(parseDbPendingByTier)
    .filter((item): item is ValidatedPendingByTier => item !== null);
}

/**
 * Parse an array of tier match stats, filtering out invalid ones
 */
export function parseDbTierMatchStatsList(data: unknown[] | null): ValidatedTierMatchStats[] {
  if (!data) return [];
  return data
    .map(parseDbTierMatchStats)
    .filter((item): item is ValidatedTierMatchStats => item !== null);
}

/**
 * Parse an array of leaderboard entries, filtering out invalid ones
 */
export function parseDbLeaderboardEntries(data: unknown[] | null): ValidatedLeaderboardEntry[] {
  if (!data) return [];
  return data
    .map(parseDbLeaderboardEntry)
    .filter((entry): entry is ValidatedLeaderboardEntry => entry !== null);
}

// ============================================
// STRICT PARSERS (throw on invalid)
// ============================================

/**
 * Parse a game, throwing if invalid
 */
export function parseDbGameStrict(data: unknown): ValidatedGame {
  return DbGameSchema.parse(data);
}

/**
 * Parse game statistics, throwing if invalid
 */
export function parseDbGameStatisticsStrict(data: unknown): ValidatedGameStatistics {
  return DbGameStatisticsSchema.parse(data);
}

/**
 * Parse leaderboard stats, throwing if invalid
 */
export function parseDbLeaderboardStatsStrict(data: unknown): z.infer<typeof DbLeaderboardStatsSchema> {
  return DbLeaderboardStatsSchema.parse(data);
}

// Re-export types for convenience
import type { z } from 'zod';
export type {
  ValidatedGame,
  ValidatedTier,
  ValidatedUserPreferences,
  ValidatedPendingTransaction,
  ValidatedActivityFeed,
  ValidatedGameStatistics,
  ValidatedPendingByTier,
  ValidatedTierMatchStats,
  ValidatedPlayerStats,
  ValidatedLeaderboardEntry,
  ValidatedPlayerRank,
};
