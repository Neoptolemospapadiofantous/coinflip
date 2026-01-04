'use client';

import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { queryKeys, LeaderboardType, LeaderboardPeriod } from '@/lib/queryKeys';
import { devLog } from '@/lib/utils';

// Leaderboard entry returned from RPC functions
export interface LeaderboardEntry {
  rank: number;
  player_address: string;
  wins: number;
  losses: number;
  total_games: number;
  win_rate: number;
  total_profit: string; // Wei string for precision
  total_wagered: string; // Wei string for precision
}

// Player rank across all categories
export interface PlayerRank {
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

// Leaderboard aggregate stats
export interface LeaderboardStats {
  total_players: number;
  total_games: number;
  total_volume: string;
  avg_win_rate: number;
}

// RPC function name mapping
const rpcFunctions: Record<LeaderboardType, string> = {
  wins: 'get_leaderboard_by_wins',
  profit: 'get_leaderboard_by_profit',
  winrate: 'get_leaderboard_by_winrate',
  volume: 'get_leaderboard_by_volume',
};

/**
 * Hook to fetch leaderboard data by type
 */
export function useLeaderboard(
  type: LeaderboardType,
  options?: {
    limit?: number;
    offset?: number;
    minGames?: number; // Only for winrate
    period?: LeaderboardPeriod;
    enabled?: boolean;
  }
) {
  const {
    limit = 50,
    offset = 0,
    minGames = 10,
    period = 'all',
    enabled = true,
  } = options ?? {};

  return useQuery({
    queryKey: [...queryKeys.leaderboard.byType(type, period), limit, offset, minGames],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const functionName = rpcFunctions[type];

      // Build params based on function type
      const params: Record<string, number> = {
        p_limit: limit,
        p_offset: offset,
      };

      // Add min_games param for winrate function
      if (type === 'winrate') {
        params.p_min_games = minGames;
      }

      const { data, error } = await supabase.rpc(functionName, params);

      if (error) {
        devLog.error(`[Leaderboard] Error fetching ${type}:`, error.message);
        throw error;
      }

      // Transform data to ensure consistent types
      return (data || []).map((entry: Record<string, unknown>) => ({
        rank: Number(entry.rank),
        player_address: String(entry.player_address),
        wins: Number(entry.wins),
        losses: Number(entry.losses),
        total_games: Number(entry.total_games),
        win_rate: Number(entry.win_rate),
        total_profit: String(entry.total_profit ?? '0'),
        total_wagered: String(entry.total_wagered ?? '0'),
      }));
    },
    enabled,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch current user's rank across all categories
 */
export function usePlayerRank(playerAddress?: string) {
  const { address: connectedAddress } = useAccount();
  const address = playerAddress ?? connectedAddress;

  return useQuery({
    queryKey: queryKeys.leaderboard.playerRank(address?.toLowerCase() ?? ''),
    queryFn: async (): Promise<PlayerRank | null> => {
      if (!address) return null;

      const { data, error } = await supabase.rpc('get_player_rank', {
        p_player_address: address.toLowerCase(),
      });

      if (error) {
        devLog.error('[Leaderboard] Error fetching player rank:', error.message);
        throw error;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const entry = data[0];
      return {
        rank_by_wins: Number(entry.rank_by_wins),
        rank_by_profit: Number(entry.rank_by_profit),
        rank_by_winrate: Number(entry.rank_by_winrate),
        rank_by_volume: Number(entry.rank_by_volume),
        total_players: Number(entry.total_players),
        player_wins: Number(entry.player_wins),
        player_losses: Number(entry.player_losses),
        player_total_games: Number(entry.player_total_games),
        player_win_rate: Number(entry.player_win_rate),
        player_total_profit: String(entry.player_total_profit ?? '0'),
        player_total_wagered: String(entry.player_total_wagered ?? '0'),
      };
    },
    enabled: !!address,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch aggregate leaderboard stats
 */
export function useLeaderboardStats() {
  return useQuery({
    queryKey: queryKeys.leaderboard.stats,
    queryFn: async (): Promise<LeaderboardStats> => {
      const { data, error } = await supabase.rpc('get_leaderboard_stats');

      if (error) {
        devLog.error('[Leaderboard] Error fetching stats:', error.message);
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          total_players: 0,
          total_games: 0,
          total_volume: '0',
          avg_win_rate: 50,
        };
      }

      const entry = data[0];
      return {
        total_players: Number(entry.total_players ?? 0),
        total_games: Number(entry.total_games ?? 0),
        total_volume: String(entry.total_volume ?? '0'),
        avg_win_rate: Number(entry.avg_win_rate ?? 50),
      };
    },
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Helper to format leaderboard values for display
 */
export function formatLeaderboardValue(
  value: string | number,
  type: 'eth' | 'usd' | 'percent' | 'number'
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  switch (type) {
    case 'eth': {
      // Convert from wei to ETH
      const eth = num / 1e18;
      if (eth >= 1000) return `${(eth / 1000).toFixed(2)}K`;
      if (eth >= 1) return eth.toFixed(2);
      return eth.toFixed(4);
    }
    case 'usd':
      if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
      if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
      return `$${num.toFixed(2)}`;
    case 'percent':
      return `${num.toFixed(1)}%`;
    case 'number':
    default:
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return num.toLocaleString();
  }
}
