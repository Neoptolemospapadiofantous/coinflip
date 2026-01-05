import { useQuery } from '@tanstack/react-query';
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
import { useIsLoggedIn } from '@/lib/data';
import { getBlockchainDataSource } from '@/lib/data/blockchain';
import {
  queryAllGames,
  queryPendingGames,
  queryActiveGames,
  queryPlayerGames,
  queryUserActiveGames,
  queryGameById,
  queryGameStats,
  queryPlayerStats,
  queryPlayerStatsBasic,
} from '@/lib/queries';

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
export function useGames() {
  return useQuery({
    queryKey: queryKeys.games.all,
    queryFn: async (): Promise<Game[]> => {
      const { data, error } = await queryAllGames();

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
// Uses blockchain for wallet-only users (decentralized), Supabase for registered users (centralized)
export function usePendingGames() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: [...queryKeys.games.pending, isLoggedIn ? 'supabase' : 'blockchain'],
    queryFn: async (): Promise<Game[]> => {
      // Wallet-only users (decentralized mode): fetch from blockchain
      if (!isLoggedIn) {
        devLog.log('[usePendingGames] Using blockchain data source (decentralized mode)');
        try {
          const blockchainSource = getBlockchainDataSource();
          return await blockchainSource.getPendingGames();
        } catch (err) {
          devLog.error('[usePendingGames] Blockchain fetch failed:', err);
          return [];
        }
      }

      // Registered users (centralized mode): fetch from Supabase
      devLog.log('[usePendingGames] Using Supabase data source (centralized mode)');
      const { data, error } = await queryPendingGames();

      if (error) {
        devLog.error('Error fetching pending games:', error);
        throw new Error(`Failed to fetch pending games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    staleTime: isLoggedIn ? PENDING_GAMES_STALE_TIME_MS : 30000,
    refetchInterval: isLoggedIn ? false : 15000, // Poll every 15s in decentralized mode
    retry: 2,
  });
}

// Fetch active games (pending + matched)
// Uses blockchain for wallet-only users, Supabase for registered users
export function useActiveGames() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: [...queryKeys.games.active, isLoggedIn ? 'supabase' : 'blockchain'],
    queryFn: async (): Promise<Game[]> => {
      // Wallet-only users: fetch from blockchain
      if (!isLoggedIn) {
        devLog.log('[useActiveGames] Using blockchain data source');
        try {
          const blockchainSource = getBlockchainDataSource();
          return await blockchainSource.getActiveGames();
        } catch (err) {
          devLog.error('[useActiveGames] Blockchain fetch failed:', err);
          return [];
        }
      }

      // Registered users: fetch from Supabase
      const { data, error} = await queryActiveGames();

      if (error) {
        devLog.error('Error fetching active games:', error);
        throw new Error(`Failed to fetch active games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    staleTime: isLoggedIn ? ACTIVE_GAMES_STALE_TIME_MS : 30000,
    refetchInterval: isLoggedIn ? false : 15000,
    retry: 2,
  });
}

// Fetch games by player address
// Uses blockchain for wallet-only users, Supabase for registered users
export function usePlayerGames(address: string | undefined, limit: number = 50) {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: [...queryKeys.games.player(address || ''), limit, isLoggedIn ? 'supabase' : 'blockchain'],
    queryFn: async (): Promise<Game[]> => {
      if (!address) return [];

      // Validate address format before querying
      if (!isValidAddress(address)) {
        devLog.warn('Invalid address format for player games query:', address);
        return [];
      }

      // Wallet-only users: fetch from blockchain
      if (!isLoggedIn) {
        devLog.log('[usePlayerGames] Using blockchain data source');
        try {
          const blockchainSource = getBlockchainDataSource();
          return await blockchainSource.getPlayerGames(address, limit);
        } catch (err) {
          devLog.error('[usePlayerGames] Blockchain fetch failed:', err);
          return [];
        }
      }

      // Registered users: fetch from Supabase
      const { data, error } = await queryPlayerGames(address, limit);

      if (error) {
        devLog.error('Error fetching player games:', error);
        throw new Error(`Failed to fetch player games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    enabled: !!address,
    staleTime: isLoggedIn ? PLAYER_GAMES_STALE_TIME_MS : 30000,
    refetchInterval: isLoggedIn ? false : 15000,
    retry: 2,
  });
}

// Fetch user's active games (pending/matched)
// Uses blockchain for wallet-only users, Supabase for registered users
export function useUserActiveGames(address: string | undefined) {
  const isLoggedIn = useIsLoggedIn();
  const normalizedAddress = address?.toLowerCase() || '';

  return useQuery({
    queryKey: [...queryKeys.games.userActive(normalizedAddress), isLoggedIn ? 'supabase' : 'blockchain'],
    queryFn: async (): Promise<Game[]> => {
      if (!address) return [];

      // Validate address format before querying
      if (!isValidAddress(address)) {
        devLog.warn('Invalid address format for user active games query:', address);
        return [];
      }

      // Wallet-only users: fetch from blockchain
      if (!isLoggedIn) {
        devLog.log('[useUserActiveGames] Using blockchain data source');
        try {
          const blockchainSource = getBlockchainDataSource();
          return await blockchainSource.getPlayerActiveGames(address);
        } catch (err) {
          devLog.error('[useUserActiveGames] Blockchain fetch failed:', err);
          return [];
        }
      }

      // Registered users: fetch from Supabase
      const { data, error } = await queryUserActiveGames(address);

      if (error) {
        devLog.error('Error fetching user active games:', error);
        throw new Error(`Failed to fetch user active games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    enabled: !!address,
    staleTime: isLoggedIn ? USER_ACTIVE_GAMES_STALE_TIME_MS : 30000,
    refetchInterval: isLoggedIn ? false : 15000,
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

      // Use enhanced RPC that returns everything in one query
      // (basic stats + tier breakdown + pending count)
      const { data: rpcData, error: rpcError } = await queryPlayerStats(address);

      if (rpcError) {
        devLog.error('Error fetching player stats via RPC:', rpcError);
        // Fallback to basic RPC if v2 doesn't exist yet
        if (rpcError.code === '42883') { // function does not exist
          devLog.warn('get_player_stats_v2 not found, falling back to basic stats');
          const { data: fallbackData } = await queryPlayerStatsBasic(address);
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
// Uses blockchain for wallet-only users, Supabase for registered users
export function useGame(gameId: string | null) {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: [...queryKeys.games.single(gameId || ''), isLoggedIn ? 'supabase' : 'blockchain'],
    queryFn: async (): Promise<Game | null> => {
      if (!gameId) return null;

      // Wallet-only users: fetch from blockchain
      if (!isLoggedIn) {
        devLog.log('[useGame] Using blockchain data source');
        try {
          const blockchainSource = getBlockchainDataSource();
          return await blockchainSource.getGame(gameId);
        } catch (err) {
          devLog.error('[useGame] Blockchain fetch failed:', err);
          return null;
        }
      }

      // Registered users: fetch from Supabase
      const { data, error } = await queryGameById(gameId);

      if (error) {
        devLog.error('Error fetching game:', error);
        return null;
      }

      return data ? parseGame(data) : null;
    },
    enabled: !!gameId,
    staleTime: isLoggedIn ? SINGLE_GAME_STALE_TIME_MS : 15000,
    refetchInterval: isLoggedIn ? false : 10000, // Poll more frequently for single game
  });
}

// Fetch game statistics
// Uses blockchain for wallet-only users, Supabase for registered users
export function useGameStats() {
  const isLoggedIn = useIsLoggedIn();

  return useQuery({
    queryKey: [...queryKeys.stats.game, isLoggedIn ? 'supabase' : 'blockchain'],
    queryFn: async () => {
      // Wallet-only users: fetch from blockchain
      if (!isLoggedIn) {
        devLog.log('[useGameStats] Using blockchain data source');
        try {
          const blockchainSource = getBlockchainDataSource();
          const stats = await blockchainSource.getGameStats();
          // Convert to match Supabase format
          return {
            total_games: stats.totalGames,
            pending_games: stats.pendingGames,
            matched_games: stats.matchedGames,
            resolved_games: stats.resolvedGames,
            cancelled_games: stats.cancelledGames,
            total_volume_wei: stats.totalVolume,
            total_unique_players: stats.uniquePlayers,
            avg_game_duration_seconds: null,
            games_by_tier: null,
          };
        } catch (err) {
          devLog.error('[useGameStats] Blockchain fetch failed:', err);
          return null;
        }
      }

      // Registered users: fetch from Supabase
      const { data, error } = await queryGameStats();

      if (error) {
        devLog.error('Error fetching game stats:', error);
        return null;
      }

      return data;
    },
    staleTime: isLoggedIn ? GAME_STATS_STALE_TIME_MS : 60000,
    refetchInterval: isLoggedIn ? false : 30000,
  });
}
