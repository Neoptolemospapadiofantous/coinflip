import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Game } from '@/types/game';

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
        return [];
      }

      return data || [];
    },
    staleTime: 5000, // 5 seconds
    refetchInterval: 10000, // Refetch every 10 seconds
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
        return [];
      }

      return data || [];
    },
    staleTime: 3000,
    refetchInterval: 5000, // Refresh often for queue
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
        return [];
      }

      return data || [];
    },
    staleTime: 3000,
    refetchInterval: 5000,
  });
}

// Fetch games by player address
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
        return [];
      }

      return data || [];
    },
    enabled: !!address,
    staleTime: 5000,
    refetchInterval: 10000,
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
    staleTime: 3000,
    refetchInterval: 5000, // Poll for updates
  });
}

// Fetch game statistics
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
    refetchInterval: 60000, // Refresh every minute
  });
}

// Subscribe to real-time game updates
export function useGameSubscription(gameId: string | null, callback: (game: Game) => void) {
  const queryClient = useQueryClient();

  if (!gameId) return;

  const subscription = supabase
    .channel(`game:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        console.log('Game updated:', payload.new);
        callback(payload.new as Game);

        // Invalidate queries to refetch
        queryClient.invalidateQueries({ queryKey: ['game', gameId] });
        queryClient.invalidateQueries({ queryKey: ['games'] });
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

// Subscribe to new pending games
export function usePendingGamesSubscription(callback: () => void) {
  const queryClient = useQueryClient();

  const subscription = supabase
    .channel('pending-games')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'games',
      },
      () => {
        console.log('New game created');
        callback();
        queryClient.invalidateQueries({ queryKey: ['games', 'pending'] });
        queryClient.invalidateQueries({ queryKey: ['games', 'active'] });
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}
