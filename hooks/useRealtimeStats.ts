'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { devLog } from '@/lib/utils';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { REALTIME_CHANNELS } from '@/lib/realtime';
import { queryPendingByTier, queryTierMatchStats, queryActivityFeed, queryIndexerState, queryRealtimeStats } from '@/lib/queries';
import type { DbPendingByTier, DbTierMatchStats, DbActivityFeed, DbRealtimeStats } from '@/types/database';

// ============================================
// TYPES (Re-export from database types for backwards compatibility)
// ============================================

export type PendingByTier = DbPendingByTier;
export type TierMatchStats = DbTierMatchStats;
export type ActivityFeedItem = DbActivityFeed;

export interface IndexerState {
  last_block: string;
  updated_at: string;
}

export interface RealtimeStats {
  pending_by_tier: PendingByTier[] | null;
  match_times: TierMatchStats[] | null;
  recent_activity: ActivityFeedItem[] | null;
  indexer_state: IndexerState | null;
}

// ============================================
// QUERY KEYS
// ============================================

export const realtimeStatsKeys = {
  all: ['realtime-stats'] as const,
  pendingByTier: ['pending-by-tier'] as const,
  matchTimes: ['tier-match-times'] as const,
  activityFeed: ['activity-feed'] as const,
  indexerState: ['indexer-state'] as const,
};

// ============================================
// HOOKS
// ============================================

/**
 * Get all realtime stats in a single RPC call
 * Use this for initial load, then subscribe to individual updates
 */
export function useRealtimeStats() {
  return useQuery({
    queryKey: realtimeStatsKeys.all,
    queryFn: async (): Promise<RealtimeStats> => {
      const { data, error } = await supabase.rpc('get_realtime_stats');

      if (error) {
        devLog.warn('[RealtimeStats] Error fetching:', error.message);
        return {
          pending_by_tier: null,
          match_times: null,
          recent_activity: null,
          indexer_state: null,
        };
      }

      return data as RealtimeStats;
    },
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Fallback poll every 30s
  });
}

/**
 * Get pending game counts per tier
 * Updates via realtime when games table changes
 */
export function usePendingByTier() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: realtimeStatsKeys.pendingByTier,
    queryFn: async (): Promise<PendingByTier[]> => {
      const { data, error } = await queryPendingByTier();

      if (error) {
        devLog.warn('[PendingByTier] Error fetching:', error.message);
        return [];
      }

      return data || [];
    },
    staleTime: 5000, // 5 seconds - invalidated by realtime
  });

  // Listen to ALL game changes (INSERT, UPDATE, DELETE) to catch:
  // - New pending games created
  // - Games leaving pending status (matched/cancelled)
  useEffect(() => {
    const channel = supabase
      .channel(REALTIME_CHANNELS.PENDING_BY_TIER)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
        },
        (payload: RealtimePostgresChangesPayload<{ status?: string }>) => {
          // Only invalidate if status is or was 'pending'
          const newStatus = payload.new && 'status' in payload.new ? payload.new.status : null;
          const oldStatus = payload.old && 'status' in payload.old ? payload.old.status : null;

          if (newStatus === 'pending' || oldStatus === 'pending') {
            devLog.log('[PendingByTier] Pending game change detected, invalidating...');
            queryClient.invalidateQueries({ queryKey: realtimeStatsKeys.pendingByTier });
          }
        }
      )
      .subscribe((status) => {
        devLog.log('[PendingByTier] Subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  return query;
}

/**
 * Get tier match time statistics for ETA estimation
 * Updates when games are matched (affects match time averages)
 */
export function useTierMatchTimes() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: realtimeStatsKeys.matchTimes,
    queryFn: async (): Promise<TierMatchStats[]> => {
      const { data, error } = await queryTierMatchStats();

      if (error) {
        devLog.warn('[TierMatchTimes] Error fetching:', error.message);
        return [];
      }

      return data || [];
    },
    staleTime: 60000, // 1 minute - match times don't change rapidly
    refetchInterval: 120000, // Refresh every 2 minutes
  });

  // Update match times when games get matched
  useEffect(() => {
    const channel = supabase
      .channel(REALTIME_CHANNELS.MATCH_TIMES)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
        },
        (payload: RealtimePostgresChangesPayload<{ status?: string }>) => {
          const newStatus = payload.new && 'status' in payload.new ? payload.new.status : null;
          // Refresh when a game gets matched (affects match time stats)
          if (newStatus === 'matched') {
            devLog.log('[TierMatchTimes] Game matched, invalidating...');
            queryClient.invalidateQueries({ queryKey: realtimeStatsKeys.matchTimes });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  return query;
}

/**
 * Get activity feed with realtime subscription
 * Provides instant updates when new activity is detected
 */
export function useActivityFeed(limit: number = 10) {
  const [realtimeItems, setRealtimeItems] = useState<ActivityFeedItem[]>([]);

  // Initial fetch
  const query = useQuery({
    queryKey: [...realtimeStatsKeys.activityFeed, limit],
    queryFn: async (): Promise<ActivityFeedItem[]> => {
      const { data, error } = await queryActivityFeed(limit);

      if (error) {
        devLog.warn('[ActivityFeed] Error fetching:', error.message);
        return [];
      }

      devLog.log('[ActivityFeed] Fetched', data?.length || 0, 'items');
      return data || [];
    },
    staleTime: 10000, // 10 seconds
    refetchInterval: 60000, // Fallback poll every 60s
  });

  // Realtime subscription for new items - instant updates
  useEffect(() => {
    devLog.log('[ActivityFeed] Setting up realtime subscription...');

    const channel = supabase
      .channel(REALTIME_CHANNELS.ACTIVITY_FEED)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
        },
        (payload) => {
          const newItem = payload.new as ActivityFeedItem;
          devLog.log('[ActivityFeed] 🔔 New activity received:', newItem.event_type, newItem.id);

          // Add to realtime items immediately for instant UI update
          setRealtimeItems((prev) => {
            // Avoid duplicates
            if (prev.some((item) => item.id === newItem.id)) {
              devLog.log('[ActivityFeed] Duplicate item, skipping');
              return prev;
            }
            // Keep only latest items
            const updated = [newItem, ...prev].slice(0, limit);
            devLog.log('[ActivityFeed] Added to realtime items, now have', updated.length);
            return updated;
          });
        }
      )
      .subscribe((status, err) => {
        devLog.log('[ActivityFeed] Subscription status:', status, err?.message || '');
      });

    return () => {
      devLog.log('[ActivityFeed] Cleaning up subscription');
      channel.unsubscribe();
    };
  }, [limit]);

  // Clear realtime items when query data refreshes to avoid stale duplicates
  useEffect(() => {
    if (query.data && query.data.length > 0) {
      setRealtimeItems([]);
    }
  }, [query.dataUpdatedAt]);

  // Merge realtime items with query data using useMemo
  const mergedData = useMemo(() => {
    const queryData = query.data || [];
    const allItems = [...realtimeItems, ...queryData];

    // Deduplicate and sort by created_at
    const seen = new Set<number>();
    const result = allItems
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return result;
  }, [query.data, realtimeItems, limit]);

  return {
    ...query,
    data: mergedData,
  };
}

/**
 * Get indexer sync status with realtime updates
 */
export function useIndexerStatus() {
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const query = useQuery({
    queryKey: realtimeStatsKeys.indexerState,
    queryFn: async (): Promise<IndexerState | null> => {
      const { data, error } = await queryIndexerState();

      if (error) {
        devLog.warn('[IndexerStatus] Error fetching:', error.message);
        return null;
      }

      return {
        last_block: data.last_processed_block,
        updated_at: data.updated_at,
      };
    },
    staleTime: 10000, // 10 seconds
  });

  // Realtime subscription for indexer updates
  useEffect(() => {
    const channel = supabase
      .channel(REALTIME_CHANNELS.INDEXER_STATE)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'indexer_state',
        },
        (payload) => {
          devLog.log('[IndexerStatus] Indexer updated:', payload.new);
          setLastUpdate(new Date());
          queryClient.invalidateQueries({ queryKey: realtimeStatsKeys.indexerState });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  // Calculate sync status
  const getSyncStatus = useCallback(() => {
    if (!query.data) return 'unknown';

    const updatedAt = new Date(query.data.updated_at);
    const now = new Date();
    const secondsSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000;

    if (secondsSinceUpdate < 30) return 'synced';
    if (secondsSinceUpdate < 120) return 'syncing';
    return 'stale';
  }, [query.data]);

  return {
    ...query,
    lastUpdate,
    syncStatus: getSyncStatus(),
    lastBlock: query.data?.last_block || null,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format match time for display
 */
export function formatMatchTime(seconds: number | null): string {
  if (seconds === null || seconds === 0) return 'N/A';

  if (seconds < 60) {
    return `~${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `~${minutes}m`;
  } else {
    const hours = Math.round(seconds / 3600);
    return `~${hours}h`;
  }
}

/**
 * Get estimated match time for a tier
 */
export function getEstimatedMatchTime(
  matchTimes: TierMatchStats[] | null,
  tierId: number
): { estimate: string; confidence: 'high' | 'medium' | 'low' } {
  if (!matchTimes) return { estimate: 'N/A', confidence: 'low' };

  const tierStats = matchTimes.find((t) => t.tier === tierId);
  if (!tierStats) return { estimate: 'N/A', confidence: 'low' };

  // Prefer recent average if we have enough recent matches
  if (tierStats.recent_match_count >= 5 && tierStats.recent_avg_match_time_seconds) {
    return {
      estimate: formatMatchTime(tierStats.recent_avg_match_time_seconds),
      confidence: 'high',
    };
  }

  // Fall back to median if available
  if (tierStats.median_match_time_seconds) {
    const confidence = tierStats.total_resolved >= 10 ? 'medium' : 'low';
    return {
      estimate: formatMatchTime(tierStats.median_match_time_seconds),
      confidence,
    };
  }

  // Fall back to average
  if (tierStats.avg_match_time_seconds) {
    return {
      estimate: formatMatchTime(tierStats.avg_match_time_seconds),
      confidence: 'low',
    };
  }

  return { estimate: 'N/A', confidence: 'low' };
}
