import { QueryClient } from '@tanstack/react-query';
import { Game } from '@/types/game';

/**
 * Invalidate all game-related queries
 * Use after game state changes (create, join, cancel, resolve)
 */
export function invalidateGameQueries(
  queryClient: QueryClient,
  gameId?: string
): void {
  // Invalidate list queries
  queryClient.invalidateQueries({ queryKey: ['games', 'pending'] });
  queryClient.invalidateQueries({ queryKey: ['games', 'active'] });
  queryClient.invalidateQueries({ queryKey: ['games', 'player'] });
  queryClient.invalidateQueries({ queryKey: ['game-stats'] });
  queryClient.invalidateQueries({ queryKey: ['player-stats'] });

  // Invalidate specific game query if provided
  if (gameId) {
    queryClient.invalidateQueries({ queryKey: ['game', gameId] });
  }
}

/**
 * Optimistically remove a game from pending cache
 * Use when canceling a game for instant UI feedback
 */
export function removeGameFromPendingCache(
  queryClient: QueryClient,
  gameId: string
): void {
  queryClient.setQueryData(['games', 'pending'], (old: Game[] | undefined) =>
    old?.filter((g) => g.id !== gameId) || []
  );
}
