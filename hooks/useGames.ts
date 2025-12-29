import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Game, parseGame } from '@/types/game';

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

// Fetch all games
export function useGames() {
  return useQuery({
    queryKey: ['games'],
    queryFn: async (): Promise<Game[]> => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching games:', error);
        throw new Error(`Failed to fetch games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    staleTime: 60000, // 1 minute - central sync handles freshness
    refetchInterval: false, // Disabled - central sync invalidates when needed
    retry: 2,
  });
}

// Fetch pending games (waiting for second player)
export function usePendingGames() {
  return useQuery({
    queryKey: ['games', 'pending'],
    queryFn: async (): Promise<Game[]> => {
      const { data, error } = await supabase
        .from('active_games')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending games:', error);
        throw new Error(`Failed to fetch pending games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    staleTime: 15000, // 15 seconds - kept short for active game updates
    refetchInterval: false, // Disabled - central sync handles updates
    retry: 2,
  });
}

// Fetch active games (pending + matched)
export function useActiveGames() {
  return useQuery({
    queryKey: ['games', 'active'],
    queryFn: async (): Promise<Game[]> => {
      const { data, error} = await supabase
        .from('active_games')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching active games:', error);
        throw new Error(`Failed to fetch active games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    staleTime: 15000, // 15 seconds - kept short for active game updates
    refetchInterval: false, // Disabled - central sync handles updates
    retry: 2,
  });
}

// Fetch games by player address
// Real-time updates handled by central sync (useRealtimeSync)
export function usePlayerGames(address: string | undefined, limit: number = 50) {
  return useQuery({
    queryKey: ['games', 'player', address, limit],
    queryFn: async (): Promise<Game[]> => {
      if (!address) return [];

      const lowerAddress = address.toLowerCase();

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .or(`creator_address.ilike.${lowerAddress},joiner_address.ilike.${lowerAddress}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching player games:', error);
        throw new Error(`Failed to fetch player games: ${error.message}`);
      }

      return normalizeGames(data);
    },
    enabled: !!address,
    staleTime: 30000, // 30 seconds
    refetchInterval: false, // Disabled - central sync handles updates
    retry: 2,
  });
}

// Fetch player statistics (aggregated server-side)
export function usePlayerStats(address: string | undefined) {
  return useQuery({
    queryKey: ['player-stats', address],
    queryFn: async () => {
      if (!address) return null;

      const lowerAddress = address.toLowerCase();

      // Use a single query with aggregations
      const { data, error } = await supabase
        .from('games')
        .select('status, amount, payout, fee, winner_address, tier')
        .or(`creator_address.ilike.${lowerAddress},joiner_address.ilike.${lowerAddress}`);

      if (error) {
        console.error('Error fetching player stats:', error);
        return null;
      }

      if (!data || data.length === 0) {
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

      // Calculate stats from data
      let wins = 0, losses = 0, pending = 0;
      let totalWagered = BigInt(0), totalWon = BigInt(0), totalLost = BigInt(0), totalFees = BigInt(0);
      const gamesByTier = [0, 0, 0, 0, 0];
      const winsByTier = [0, 0, 0, 0, 0];

      for (const game of data) {
        totalWagered += BigInt(game.amount);
        gamesByTier[game.tier] = (gamesByTier[game.tier] || 0) + 1;

        if (game.status === 'pending' || game.status === 'matched') {
          pending++;
        } else if (game.status === 'resolved') {
          const isWin = game.winner_address?.toLowerCase() === lowerAddress;
          if (isWin) {
            wins++;
            totalWon += game.payout ? BigInt(game.payout) : BigInt(0);
            // Add fee to total fees (fee is stored in database for each resolved game)
            totalFees += game.fee ? BigInt(game.fee) : BigInt(0);
            winsByTier[game.tier] = (winsByTier[game.tier] || 0) + 1;
          } else {
            losses++;
            totalLost += BigInt(game.amount);
          }
        }
      }

      return {
        totalGames: data.length,
        wins,
        losses,
        pending,
        totalWagered,
        totalWon,
        totalLost,
        totalFees,
        gamesByTier,
        winsByTier,
      };
    },
    enabled: !!address,
    staleTime: 60000, // 1 minute - stats don't need to be super fresh
    refetchInterval: false,
    retry: 2,
  });
}

// Fetch single game by ID
export function useGame(gameId: string | null) {
  return useQuery({
    queryKey: ['game', gameId],
    queryFn: async (): Promise<Game | null> => {
      if (!gameId) return null;

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error) {
        console.error('Error fetching game:', error);
        return null;
      }

      return data ? parseGame(data) : null;
    },
    enabled: !!gameId,
    staleTime: 60000, // 1 minute
    refetchInterval: false, // Disabled - useGameSync handles real-time updates
  });
}

// Fetch game statistics
// Real-time updates handled by central sync (useRealtimeSync)
export function useGameStats() {
  return useQuery({
    queryKey: ['game-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('game_statistics')
        .select('*')
        .single();

      if (error) {
        console.error('Error fetching game stats:', error);
        return null;
      }

      return data;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: false, // Disabled - central sync handles updates
  });
}
