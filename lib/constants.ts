/**
 * Centralized timing and configuration constants
 *
 * All timing values are synchronized across the app to ensure consistency
 * between the smart contract, indexer, and frontend.
 */

// ============================================
// BLOCKCHAIN CONSTANTS (from smart contract)
// ============================================

/**
 * Number of blocks before Chainlink Automation auto-cancels unmatched games.
 * Note: Creator can cancel immediately - this is only for auto-cancel.
 * ~5 min on Sepolia at 12s/block
 */
export const TIMEOUT_BLOCKS = 25;

/** Number of blocks before VRF timeout can be claimed (~40 min on Sepolia) */
export const VRF_TIMEOUT_BLOCKS = 200;

/** Average block time in seconds (Ethereum/Sepolia) */
export const AVG_BLOCK_TIME_SECONDS = 12;

// ============================================
// GAME TIMEOUT CONSTANTS
// ============================================

/**
 * Auto-cancel timeout in milliseconds (5 minutes) - matches TIMEOUT_BLOCKS.
 * Creator can cancel immediately; Chainlink auto-cancels after this time.
 */
export const GAME_TIMEOUT_MS = 5 * 60 * 1000;

/** Game timeout in seconds */
export const GAME_TIMEOUT_SECONDS = GAME_TIMEOUT_MS / 1000;

/** VRF timeout in seconds (for UI display) */
export const VRF_TIMEOUT_SECONDS = 120;

/** VRF timeout in milliseconds */
export const VRF_TIMEOUT_MS = VRF_TIMEOUT_SECONDS * 1000;

// ============================================
// POLLING INTERVALS
// ============================================

/** Standard polling interval for game search (1 second) */
export const POLL_INTERVAL_MS = 1000;

/** Polling interval for checking expired games (30 seconds) */
export const EXPIRED_GAMES_CHECK_INTERVAL_MS = 30 * 1000;

/** Timeout for searching for newly created games (30 seconds) */
export const GAME_SEARCH_TIMEOUT_MS = 30000;

/** Fallback polling intervals with exponential backoff [5s, 10s, 20s, 30s] */
export const FALLBACK_POLL_INTERVALS_MS = [5000, 10000, 20000, 30000] as const;

/** Default refetch interval for react-query game data */
export const DEFAULT_REFETCH_INTERVAL_MS = 5000;

/** Refetch interval for checking VRF timeout status */
export const VRF_CHECK_INTERVAL_MS = 10000;

// ============================================
// UI COOLDOWNS & DELAYS
// ============================================

/** Cooldown between cancel operations (5 seconds) - prevents spam */
export const CANCEL_COOLDOWN_MS = 5000;

/** Delay before auto-removing resolved games from active list */
export const RESOLVED_GAME_REMOVAL_DELAY_MS = 5000;

/** Initial delay before first fallback poll */
export const INITIAL_FALLBACK_POLL_DELAY_MS = 1000;

/** Fast retry interval when waiting for indexer after event */
export const POST_EVENT_RETRY_INTERVAL_MS = 500;

/** Maximum retries when waiting for indexer after event */
export const POST_EVENT_MAX_RETRIES = 10;

// NOTE: OPTIMISTIC_GAME_TIMEOUT_MS removed - optimistic games are no longer used
// All game tracking is now DB-backed via pending_transactions table

// ============================================
// REALTIME SYNC CONSTANTS
// ============================================

/** Debounce delay for realtime event processing (ms) */
export const REALTIME_DEBOUNCE_MS = 100;

/** Max listeners for connection status (prevents memory leaks) */
export const MAX_CONNECTION_LISTENERS = 100;

/** Debounce delay for connection status updates (ms) */
export const CONNECTION_STATUS_DEBOUNCE_MS = 50;

// ============================================
// TOAST CONSTANTS
// ============================================

/** Toast deduplication window (ms) */
export const TOAST_DEDUPE_WINDOW_MS = 2000;

/** Toast cleanup interval (ms) */
export const TOAST_CLEANUP_INTERVAL_MS = 5000;

// ============================================
// PENDING TRANSACTION CONSTANTS
// ============================================

/** Periodic cleanup interval for expired pending transactions (ms) */
export const PENDING_TX_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** Stale time for pending transactions query (ms) */
export const PENDING_TX_STALE_TIME_MS = 5000;

// ============================================
// QUERY CACHE CONSTANTS
// ============================================

/** Stale time for pending games query (ms) */
export const PENDING_GAMES_STALE_TIME_MS = 15000;

/** Stale time for active games query (ms) */
export const ACTIVE_GAMES_STALE_TIME_MS = 15000;

/** Stale time for player games query (ms) */
export const PLAYER_GAMES_STALE_TIME_MS = 30000;

/** Stale time for user active games query (ms) */
export const USER_ACTIVE_GAMES_STALE_TIME_MS = 5000;

/** Stale time for game stats query (ms) */
export const GAME_STATS_STALE_TIME_MS = 30000;

/** Stale time for player stats query (ms) */
export const PLAYER_STATS_STALE_TIME_MS = 60000;

/** Stale time for all games query (ms) */
export const ALL_GAMES_STALE_TIME_MS = 60000;

/** Stale time for single game query (ms) */
export const SINGLE_GAME_STALE_TIME_MS = 60000;

// ============================================
// LIMITS
// ============================================

/** Maximum concurrent games per player */
export const MAX_CONCURRENT_GAMES = 5;

/** Maximum games to prefetch notifications for */
export const MAX_PREFETCH_GAMES = 100;

/** Maximum entries in notification cache (LRU) */
export const MAX_NOTIFICATION_CACHE_SIZE = 100;

/** Maximum RPC response cache entries */
export const MAX_RPC_CACHE_SIZE = 1000;

/** Rate limit: requests per minute per IP */
export const RATE_LIMIT_REQUESTS_PER_MINUTE = 100;

/** RPC proxy request timeout (ms) */
export const RPC_TIMEOUT_MS = 15000;

// ============================================
// PLATFORM FEE
// ============================================

/** Platform fee percentage on wins */
export const PLATFORM_FEE_PERCENT = 3;

/** Winner payout percentage (100 - fee) */
export const WINNER_PAYOUT_PERCENT = 100 - PLATFORM_FEE_PERCENT;

// ============================================
// GAS LIMITS
// ============================================

/** Static gas limits - safe values that work on Sepolia */
export const GAS_LIMITS = {
  createGame: BigInt(300_000),
  joinGame: BigInt(500_000),
  cancelGame: BigInt(200_000),
  claimVrfTimeout: BigInt(200_000),
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Format milliseconds to human-readable time string */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0:00';

  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
