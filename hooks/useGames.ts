import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Game } from '@/types/game';

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

      return data || [];
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

      return data || [];
    },
    staleTime: 30000, // 30 seconds
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

      return data || [];
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: false, // Disabled - central sync handles updates
    retry: 2,
  });
}

// Fetch games by player address
// Real-time updates handled by central sync (useRealtimeSync)
export function usePlayerGames(address: string | undefined) {
  return useQuery({
    queryKey: ['games', 'player', address],
    queryFn: async (): Promise<Game[]> => {
      if (!address) return [];

      const lowerAddress = address.toLowerCase();

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .or(`creator_address.eq.${lowerAddress},joiner_address.eq.${lowerAddress}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching player games:', error);
        throw new Error(`Failed to fetch player games: ${error.message}`);
      }

      return data || [];
    },
    enabled: !!address,
    staleTime: 30000, // 30 seconds
    refetchInterval: false, // Disabled - central sync handles updates
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

      return data;
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
