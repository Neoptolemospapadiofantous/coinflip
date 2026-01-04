/**
 * Query Cache Configuration
 *
 * Centralized cache timing configuration for React Query.
 * Optimized for different query patterns and data freshness requirements.
 */

// ============================================
// CACHE TIME CONSTANTS (in milliseconds)
// ============================================

/**
 * Real-time data: Very short cache, frequent updates
 * Used for: active games, pending transactions, game status
 */
export const CACHE_REALTIME = {
  staleTime: 2_000,       // 2 seconds - data becomes stale quickly
  gcTime: 30_000,         // 30 seconds - keep in memory briefly
  refetchInterval: 5_000, // 5 seconds - poll for updates
} as const;

/**
 * Active session data: Short cache, user-specific
 * Used for: user preferences, notifications, player active games
 */
export const CACHE_SESSION = {
  staleTime: 30_000,      // 30 seconds
  gcTime: 5 * 60_000,     // 5 minutes
  refetchInterval: false, // No automatic refetch
} as const;

/**
 * Static reference data: Long cache, rarely changes
 * Used for: tiers, contract config, indexer state
 */
export const CACHE_STATIC = {
  staleTime: 5 * 60_000,  // 5 minutes
  gcTime: 30 * 60_000,    // 30 minutes
  refetchInterval: false, // No automatic refetch
} as const;

/**
 * Aggregate/computed data: Medium cache, expensive to compute
 * Used for: leaderboards, statistics, player stats
 */
export const CACHE_AGGREGATE = {
  staleTime: 60_000,      // 1 minute
  gcTime: 10 * 60_000,    // 10 minutes
  refetchInterval: false, // No automatic refetch
} as const;

/**
 * Historical data: Very long cache, immutable once created
 * Used for: completed games, game history, resolved transactions
 */
export const CACHE_HISTORICAL = {
  staleTime: 10 * 60_000, // 10 minutes
  gcTime: 60 * 60_000,    // 1 hour
  refetchInterval: false, // No automatic refetch
} as const;

// ============================================
// QUERY KEY FACTORIES
// ============================================

/**
 * Standardized query keys for consistent caching
 * Using factory pattern for type safety and consistency
 */
export const queryKeys = {
  // Games
  games: {
    all: ['games'] as const,
    lists: () => [...queryKeys.games.all, 'list'] as const,
    list: (filters: { status?: string; tier?: number }) =>
      [...queryKeys.games.lists(), filters] as const,
    details: () => [...queryKeys.games.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.games.details(), id] as const,
    player: (address: string) =>
      [...queryKeys.games.all, 'player', address.toLowerCase()] as const,
    playerActive: (address: string) =>
      [...queryKeys.games.all, 'player-active', address.toLowerCase()] as const,
  },

  // Stats
  stats: {
    all: ['stats'] as const,
    global: () => [...queryKeys.stats.all, 'global'] as const,
    realtime: () => [...queryKeys.stats.all, 'realtime'] as const,
    player: (address: string) =>
      [...queryKeys.stats.all, 'player', address.toLowerCase()] as const,
    pendingByTier: () => [...queryKeys.stats.all, 'pending-by-tier'] as const,
    tierMatch: () => [...queryKeys.stats.all, 'tier-match'] as const,
  },

  // Leaderboard
  leaderboard: {
    all: ['leaderboard'] as const,
    byType: (type: string, options?: { limit?: number; offset?: number; minGames?: number }) =>
      [...queryKeys.leaderboard.all, type, options] as const,
    playerRank: (address: string) =>
      [...queryKeys.leaderboard.all, 'rank', address.toLowerCase()] as const,
    stats: () => [...queryKeys.leaderboard.all, 'stats'] as const,
  },

  // User
  user: {
    all: ['user'] as const,
    preferences: (address: string) =>
      [...queryKeys.user.all, 'preferences', address.toLowerCase()] as const,
    pendingTx: (address: string) =>
      [...queryKeys.user.all, 'pending-tx', address.toLowerCase()] as const,
    notifications: (address: string) =>
      [...queryKeys.user.all, 'notifications', address.toLowerCase()] as const,
  },

  // Static data
  static: {
    tiers: () => ['tiers'] as const,
    contractConfig: () => ['contract-config'] as const,
    indexerState: () => ['indexer-state'] as const,
  },

  // Activity
  activity: {
    all: ['activity'] as const,
    feed: (limit?: number) => [...queryKeys.activity.all, 'feed', limit] as const,
  },
} as const;

// ============================================
// CACHE HELPERS
// ============================================

/**
 * Get cache config based on query type
 */
export function getCacheConfig(queryType: 'realtime' | 'session' | 'static' | 'aggregate' | 'historical') {
  switch (queryType) {
    case 'realtime':
      return CACHE_REALTIME;
    case 'session':
      return CACHE_SESSION;
    case 'static':
      return CACHE_STATIC;
    case 'aggregate':
      return CACHE_AGGREGATE;
    case 'historical':
      return CACHE_HISTORICAL;
    default:
      return CACHE_SESSION;
  }
}

/**
 * Invalidation patterns for related queries
 * When one query updates, these related queries should be invalidated
 */
export const invalidationPatterns = {
  // When a game is created/joined/resolved
  gameUpdate: [
    queryKeys.games.all,
    queryKeys.stats.all,
    queryKeys.activity.all,
  ],

  // When user preferences change
  userPreferencesUpdate: (address: string) => [
    queryKeys.user.preferences(address),
  ],

  // When leaderboard data might be stale
  leaderboardUpdate: [
    queryKeys.leaderboard.all,
    queryKeys.stats.global(),
  ],

  // When player completes a game
  playerGameComplete: (address: string) => [
    queryKeys.games.player(address),
    queryKeys.games.playerActive(address),
    queryKeys.stats.player(address),
    queryKeys.leaderboard.playerRank(address),
  ],
} as const;

// ============================================
// PREFETCH UTILITIES
// ============================================

/**
 * Common queries to prefetch on app load
 * These are frequently accessed and benefit from early loading
 */
export const prefetchPriority = {
  high: [
    queryKeys.static.tiers,
    queryKeys.stats.realtime,
    queryKeys.games.lists,
  ],
  medium: [
    queryKeys.stats.pendingByTier,
    queryKeys.activity.feed,
  ],
  low: [
    queryKeys.leaderboard.stats,
    queryKeys.stats.global,
  ],
} as const;
