/**
 * Realtime Subscription Registry
 *
 * Central registry of all realtime channels and their configurations.
 * Provides consistent naming and helps prevent duplicate subscriptions.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { devLog } from '@/lib/utils';

// ============================================
// CHANNEL NAMES
// ============================================

/**
 * All realtime channel names used in the application
 */
export const REALTIME_CHANNELS = {
  /** Central game state synchronization */
  GLOBAL_GAME_SYNC: 'global-game-sync',

  /** Activity feed for new events */
  ACTIVITY_FEED: 'activity-feed-realtime',

  /** Indexer state updates */
  INDEXER_STATE: 'indexer-state-realtime',

  /** Pending games by tier sync */
  PENDING_BY_TIER: 'pending-by-tier-sync',

  /** Match time stats sync */
  MATCH_TIMES: 'match-times-sync',

  /** Pending transactions for specific user */
  pendingTransactions: (address: string) => `pending_tx_${address.toLowerCase()}`,
} as const;

// ============================================
// CHANNEL CONFIGURATIONS
// ============================================

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface ChannelConfig {
  table: string;
  events: readonly PostgresEvent[];
  description: string;
  filter?: string;
}

/**
 * Configuration for each realtime channel
 */
export const CHANNEL_CONFIG: Record<string, ChannelConfig> = {
  [REALTIME_CHANNELS.GLOBAL_GAME_SYNC]: {
    table: 'games',
    events: ['INSERT', 'UPDATE', 'DELETE'],
    description: 'Central game state synchronization for all game queries',
  },
  [REALTIME_CHANNELS.ACTIVITY_FEED]: {
    table: 'activity_feed',
    events: ['INSERT'],
    description: 'New activity notifications for the feed',
  },
  [REALTIME_CHANNELS.INDEXER_STATE]: {
    table: 'indexer_state',
    events: ['UPDATE'],
    description: 'Indexer sync status updates',
  },
  [REALTIME_CHANNELS.PENDING_BY_TIER]: {
    table: 'games',
    events: ['*'],
    description: 'Invalidates pending counts when games change status',
  },
  [REALTIME_CHANNELS.MATCH_TIMES]: {
    table: 'games',
    events: ['UPDATE'],
    description: 'Refreshes match time stats when games are matched',
  },
} as const;

// ============================================
// SUBSCRIPTION TRACKING
// ============================================

/**
 * Track active subscriptions to prevent duplicates
 */
const activeChannels = new Map<string, RealtimeChannel>();

/**
 * Register an active channel
 */
export function registerChannel(name: string, channel: RealtimeChannel): void {
  if (activeChannels.has(name)) {
    devLog.warn(`[Realtime] Channel "${name}" already registered, replacing...`);
  }
  activeChannels.set(name, channel);
}

/**
 * Unregister a channel
 */
export function unregisterChannel(name: string): void {
  activeChannels.delete(name);
}

/**
 * Check if a channel is already active
 */
export function isChannelActive(name: string): boolean {
  return activeChannels.has(name);
}

/**
 * Get all active channel names
 */
export function getActiveChannels(): string[] {
  return Array.from(activeChannels.keys());
}

/**
 * Get count of active channels
 */
export function getActiveChannelCount(): number {
  return activeChannels.size;
}

// ============================================
// QUERY KEY MAPPINGS
// ============================================

/**
 * Maps realtime events to query keys that should be invalidated
 * This helps centralize the invalidation logic
 */
export const EVENT_TO_QUERY_KEYS = {
  'games:INSERT': [
    ['games'],
    ['games', 'pending'],
    ['games', 'active'],
    ['pending-by-tier'],
    ['game-stats'],
  ],
  'games:UPDATE': [
    ['games'],
    ['games', 'pending'],
    ['games', 'active'],
    ['pending-by-tier'],
    ['tier-match-times'],
    ['game-stats'],
  ],
  'games:DELETE': [
    ['games'],
    ['games', 'pending'],
    ['games', 'active'],
    ['pending-by-tier'],
    ['game-stats'],
  ],
  'activity_feed:INSERT': [
    ['activity-feed'],
  ],
  'indexer_state:UPDATE': [
    ['indexer-state'],
  ],
} as const;

/**
 * Get query keys to invalidate for a given table/event
 */
export function getQueryKeysToInvalidate(
  table: string,
  event: PostgresEvent
): readonly (readonly string[])[] {
  const key = `${table}:${event}` as keyof typeof EVENT_TO_QUERY_KEYS;
  return EVENT_TO_QUERY_KEYS[key] || [];
}

