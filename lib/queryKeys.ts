/**
 * Centralized query key constants
 * Prevents typos and makes refactoring easier
 */

export const queryKeys = {
  // Game queries
  games: {
    all: ['games'] as const,
    pending: ['games', 'pending'] as const,
    active: ['games', 'active'] as const,
    player: (address: string) => ['games', 'player', address] as const,
    userActive: (address: string) => ['games', 'user-active', address] as const,
    single: (id: string) => ['game', id] as const,
  },

  // Stats queries
  stats: {
    game: ['game-stats'] as const,
    player: (address: string) => ['player-stats', address] as const,
  },

  // Pending transactions
  pendingTx: (address: string) => ['pending-transactions', address] as const,

  // Tiers
  tiers: ['tiers'] as const,
} as const;

/**
 * Helper to batch multiple query invalidations into one operation
 * Reduces React re-renders from multiple invalidations
 */
export function batchInvalidate(
  queryClient: { invalidateQueries: (options: { queryKey: readonly unknown[] }) => void },
  keys: readonly (readonly unknown[])[]
): void {
  // React Query batches updates within the same tick
  // But we can use Promise.all pattern for clarity
  keys.forEach(queryKey => {
    queryClient.invalidateQueries({ queryKey });
  });
}
