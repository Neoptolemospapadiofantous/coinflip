import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Game, parseGame } from '@/types/game';
import { devLog, isValidAddress } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import {
  PENDING_GAMES_STALE_TIME_MS,
  ACTIVE_GAMES_STALE_TIME_MS,
  PLAYER_GAMES_STALE_TIME_MS,
  USER_ACTIVE_GAMES_STALE_TIME_MS,
  GAME_STATS_STALE_TIME_MS,
  PLAYER_STATS_STALE_TIME_MS,
  ALL_GAMES_STALE_TIME_MS,
  SINGLE_GAME_STALE_TIME_MS,
} from '@/lib/constants';

// Columns needed for game list displays (lobby, active games panel, history)
// Optimized to fetch only what's needed instead of SELECT *
// Note: block_number and updated_at are required by isValidGame validation
const GAME_LIST_COLUMNS = `
  id, tx_hash, tier, amount, creator_address, creator_choice,
  joiner_address, joiner_choice, status, winner_address, coin_result,
  payout, fee, block_number, created_at, updated_at, matched_at, resolved_at
`;

// Minimal columns for pending games in lobby (don't need resolution data)
// Note: block_number and updated_at are required by isValidGame validation
const PENDING_GAME_COLUMNS = `
  id, tx_hash, tier, amount, creator_address, creator_choice, status,
  block_number, created_at, updated_at
`;

/**
 * Normalize an array of games from Supabase
 * Filters out any invalid games and ensures all IDs are strings
 */
function normalizeGames(data: unknown[] | null): Game[] {
  if (!data) return [];
  return data
    .map(item => parseGame(item))
    .filter((game): game is Game => game !== null);
}

/**
 * Game data hooks
 *
 * These hooks fetch data from Supabase.
 * Real-time updates are handled centrally by useRealtimeSync (in Providers).
 * No individual subscriptions needed - the central sync invalidates these queries automatically.
 */

// Fetch all games (limited to 100 most recent for performance)
// TODO: Use games_public view after migration 029 is applied
export function useGames() {
  return useQuery({
    queryKey: queryKeys.games.all,
    queryFn: async (): Promise<Game[]> => {
      const { data, error } = await supabase
        .from('games')
        .select(GAME_LIST_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        devLog.error('Error fetching games:', error);
        throw new Error(`Failed to fetch games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    staleTime: ALL_GAMES_STALE_TIME_MS,
    refetchInterval: false, // Disabled - central sync invalidates when needed
    retry: 2,
  });
}

// Fetch pending games (waiting for second player)
export function usePendingGames() {
  return useQuery({
    queryKey: queryKeys.games.pending,
    queryFn: async (): Promise<Game[]> => {
      const { data, error } = await supabase
        .from('games')
        .select(PENDING_GAME_COLUMNS)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        devLog.error('Error fetching pending games:', error);
        throw new Error(`Failed to fetch pending games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    staleTime: PENDING_GAMES_STALE_TIME_MS,
    refetchInterval: false, // Disabled - central sync handles updates
    retry: 2,
  });
}

// Fetch active games (pending + matched)
export function useActiveGames() {
  return useQuery({
    queryKey: queryKeys.games.active,
    queryFn: async (): Promise<Game[]> => {
      const { data, error} = await supabase
        .from('games')
        .select(GAME_LIST_COLUMNS)
        .in('status', ['pending', 'matched'])
        .order('created_at', { ascending: false });

      if (error) {
        devLog.error('Error fetching active games:', error);
        throw new Error(`Failed to fetch active games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    staleTime: ACTIVE_GAMES_STALE_TIME_MS,
    refetchInterval: false, // Disabled - central sync handles updates
    retry: 2,
  });
}

// Fetch games by player address
// TODO: Use games_public view after migration 029 is applied
// Real-time updates handled by central sync (useRealtimeSync)
export function usePlayerGames(address: string | undefined, limit: number = 50) {
  return useQuery({
    queryKey: [...queryKeys.games.player(address || ''), limit],
    queryFn: async (): Promise<Game[]> => {
      if (!address) return [];

      // Validate address format before querying
      if (!isValidAddress(address)) {
        devLog.warn('Invalid address format for player games query:', address);
        return [];
      }

      const lowerAddress = address.toLowerCase();

      const { data, error } = await supabase
        .from('games')
        .select(GAME_LIST_COLUMNS)
        .or(`creator_address.ilike.${lowerAddress},joiner_address.ilike.${lowerAddress}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        devLog.error('Error fetching player games:', error);
        throw new Error(`Failed to fetch player games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    enabled: !!address,
    staleTime: PLAYER_GAMES_STALE_TIME_MS,
    refetchInterval: false, // Disabled - central sync handles updates
    retry: 2,
  });
}

// Fetch user's active games (pending/matched) from database
// This is the source of truth for the Active Games panel
// TODO: Use games_public view after migration 029 is applied
export function useUserActiveGames(address: string | undefined) {
  const normalizedAddress = address?.toLowerCase() || '';
  return useQuery({
    queryKey: queryKeys.games.userActive(normalizedAddress),
    queryFn: async (): Promise<Game[]> => {
      if (!address) return [];

      // Validate address format before querying
      if (!isValidAddress(address)) {
        devLog.warn('Invalid address format for user active games query:', address);
        return [];
      }

      const lowerAddress = address.toLowerCase();

      const { data, error } = await supabase
        .from('games')
        .select(GAME_LIST_COLUMNS)
        .or(`creator_address.ilike.${lowerAddress},joiner_address.ilike.${lowerAddress}`)
        .in('status', ['pending', 'matched'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        devLog.error('Error fetching user active games:', error);
        throw new Error(`Failed to fetch user active games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    enabled: !!address,
    staleTime: USER_ACTIVE_GAMES_STALE_TIME_MS,
    refetchInterval: false, // Realtime sync handles updates
    retry: 2,
  });
}

// Fetch player statistics using server-side RPC for optimal performance
// Uses get_player_stats_v2 which returns all data in a single query (3 queries → 1)
export function usePlayerStats(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.stats.player(address || ''),
    queryFn: async () => {
      if (!address) return null;

      // Validate address format before querying
      if (!isValidAddress(address)) {
        devLog.warn('Invalid address format for player stats query:', address);
        return null;
      }

      const lowerAddress = address.toLowerCase();

      // Use enhanced RPC that returns everything in one query
      // (basic stats + tier breakdown + pending count)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_player_stats_v2', { player_address: lowerAddress });

      if (rpcError) {
        devLog.error('Error fetching player stats via RPC:', rpcError);
        // Fallback to basic RPC if v2 doesn't exist yet
        if (rpcError.code === '42883') { // function does not exist
          devLog.warn('get_player_stats_v2 not found, falling back to basic stats');
          const { data: fallbackData } = await supabase
            .rpc('get_player_stats', { player_address: lowerAddress });
          const stats = Array.isArray(fallbackData) ? fallbackData[0] : fallbackData;
          return {
            totalGames: Number(stats?.total_games) || 0,
            wins: Number(stats?.wins) || 0,
            losses: Number(stats?.losses) || 0,
            pending: 0,
            totalWagered: BigInt(stats?.total_wagered || 0),
            totalWon: BigInt(stats?.total_won || 0),
            totalLost: BigInt(stats?.total_lost || 0),
            totalFees: BigInt(0),
            gamesByTier: [0, 0, 0, 0, 0],
            winsByTier: [0, 0, 0, 0, 0],
          };
        }
        return null;
      }

      // RPC returns array with single row
      const stats = Array.isArray(rpcData) ? rpcData[0] : rpcData;

      if (!stats) {
        return {
          totalGames: 0,
          wins: 0,
          losses: 0,
          pending: 0,
          totalWagered: BigInt(0),
          totalWon: BigInt(0),
          totalLost: BigInt(0),
          totalFees: BigInt(0),
          gamesByTier: [0, 0, 0, 0, 0],
          winsByTier: [0, 0, 0, 0, 0],
        };
      }

      // Parse tier arrays from JSON (already numbers from PostgreSQL)
      const gamesByTier = stats.games_by_tier || [0, 0, 0, 0, 0];
      const winsByTier = stats.wins_by_tier || [0, 0, 0, 0, 0];

      // RPC returns numeric values, convert to BigInt for wei amounts
      return {
        totalGames: Number(stats.total_games) || 0,
        wins: Number(stats.wins) || 0,
        losses: Number(stats.losses) || 0,
        pending: Number(stats.pending_games) || 0,
        totalWagered: BigInt(stats.total_wagered || 0),
        totalWon: BigInt(stats.total_won || 0),
        totalLost: BigInt(stats.total_lost || 0),
        totalFees: BigInt(0), // Fee tracking not in RPC, can add if needed
        gamesByTier: gamesByTier.map(Number),
        winsByTier: winsByTier.map(Number),
      };
    },
    enabled: !!address,
    staleTime: PLAYER_STATS_STALE_TIME_MS,
    refetchInterval: false,
    retry: 2,
  });
}

// Fetch single game by ID
// TODO: Use games_public view after migration 029 is applied
export function useGame(gameId: string | null) {
  return useQuery({
    queryKey: queryKeys.games.single(gameId || ''),
    queryFn: async (): Promise<Game | null> => {
      if (!gameId) return null;

      const { data, error } = await supabase
        .from('games')
        .select(GAME_LIST_COLUMNS)
        .eq('id', gameId)
        .single();

      if (error) {
        devLog.error('Error fetching game:', error);
        return null;
      }

      return data ? parseGame(data) : null;
    },
    enabled: !!gameId,
    staleTime: SINGLE_GAME_STALE_TIME_MS,
    refetchInterval: false, // Disabled - useGameSync handles real-time updates
  });
}

// Columns for game statistics - must match the game_statistics view exactly
const GAME_STATS_COLUMNS = `
  total_games, pending_games, matched_games, resolved_games, cancelled_games,
  avg_game_duration_seconds, total_volume_wei, total_unique_players, games_by_tier
`;

// Fetch game statistics
// Real-time updates handled by central sync (useRealtimeSync)
export function useGameStats() {
  return useQuery({
    queryKey: queryKeys.stats.game,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('game_statistics')
        .select(GAME_STATS_COLUMNS)
        .single();

      if (error) {
        devLog.error('Error fetching game stats:', error);
        return null;
      }

      return data;
    },
    staleTime: GAME_STATS_STALE_TIME_MS,
    refetchInterval: false, // Disabled - central sync handles updates
  });
}
