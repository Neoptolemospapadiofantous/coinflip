'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { useCallback } from 'react';
import { Game } from '@/types/game';
import { useGameStore } from '@/store/gameStore';
import { devLog } from '@/lib/utils';

/**
 * Hook for optimistic UI updates
 *
 * Provides instant UI feedback when transactions are sent,
 * before blockchain confirmation and database sync.
 */
export function useOptimisticUpdates() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { addActiveGame, updateActiveGame, removeActiveGame } = useGameStore();

  /**
   * Optimistically add a new game to the pending list
   * Called when createGame transaction is sent
   */
  const optimisticCreateGame = useCallback((
    txHash: string,
    tier: number,
    choice: boolean,
    amount: string
  ) => {
    if (!address) return null;

    // Create optimistic game with temporary ID (use lowercase to match DB format)
    const lowerTxHash = txHash.toLowerCase();
    const optimisticGame: Game = {
      id: `optimistic-${lowerTxHash.slice(0, 10)}`,
      tx_hash: lowerTxHash,
      tier,
      amount,
      creator_address: address.toLowerCase(),
      creator_choice: choice,
      joiner_address: null,
      joiner_choice: null,
      winner_address: null,
      coin_result: null,
      payout: null,
      fee: null,
      status: 'pending',
      block_number: '0', // Will be updated by real data
      matched_tx_hash: null,
      matched_block_number: null,
      resolved_tx_hash: null,
      resolved_block_number: null,
      cancelled_tx_hash: null,
      cancelled_block_number: null,
      created_at: new Date().toISOString(),
      matched_at: null,
      resolved_at: null,
      cancelled_at: null,
      updated_at: new Date().toISOString(),
    };

    devLog.log(`⚡ [Optimistic] Created game with tx: ${txHash.slice(0, 10)}...`);

    // Add to pending games cache (with deduplication)
    queryClient.setQueryData(['games', 'pending'], (old: Game[] | undefined) => {
      if (!old) return [optimisticGame];
      // Check if this optimistic game already exists to prevent duplicates
      const existingIndex = old.findIndex(g => g.id === optimisticGame.id);
      if (existingIndex >= 0) {
        // Already exists, don't add duplicate
        return old;
      }
      return [optimisticGame, ...old];
    });

    // Add to active games in store
    addActiveGame(optimisticGame);

    return optimisticGame;
  }, [address, queryClient, addActiveGame]);

  /**
   * Remove optimistic game when real game arrives
   * Called by RealtimeSync when INSERT with matching tx_hash is received
   */
  const removeOptimisticGame = useCallback((txHash: string) => {
    const optimisticId = `optimistic-${txHash.toLowerCase().slice(0, 10)}`;

    devLog.log(`⚡ [Optimistic] Removing optimistic game: ${optimisticId}`);

    // Remove from pending games cache
    queryClient.setQueryData(['games', 'pending'], (old: Game[] | undefined) => {
      if (!old) return [];
      return old.filter(g => g.id !== optimisticId);
    });

    // Remove from active games
    removeActiveGame(optimisticId);
  }, [queryClient, removeActiveGame]);

  /**
   * Optimistically update a game to matched status
   * Called when joinGame transaction is sent
   */
  const optimisticJoinGame = useCallback((
    gameId: string,
    joinerAddress: string
  ) => {
    devLog.log(`⚡ [Optimistic] Joining game: ${gameId}`);

    // Get current game from cache
    const cachedPendingGames = queryClient.getQueryData(['games', 'pending']) as Game[] | undefined;
    const existingGame = cachedPendingGames?.find(g => g.id === gameId);

    if (existingGame) {
      const optimisticGame: Game = {
        ...existingGame,
        joiner_address: joinerAddress.toLowerCase(),
        joiner_choice: !existingGame.creator_choice,
        status: 'matched',
        matched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Remove from pending cache
      queryClient.setQueryData(['games', 'pending'], (old: Game[] | undefined) =>
        old?.filter(g => g.id !== gameId) || []
      );

      // Update individual game cache
      queryClient.setQueryData(['game', gameId], optimisticGame);

      // Add to active games
      addActiveGame(optimisticGame);

      return optimisticGame;
    }

    return null;
  }, [queryClient, addActiveGame]);

  /**
   * Optimistically remove a game (cancelled)
   * Called when cancelGame transaction is sent
   */
  const optimisticCancelGame = useCallback((gameId: string) => {
    devLog.log(`⚡ [Optimistic] Cancelling game: ${gameId}`);

    // Remove from pending games cache
    queryClient.setQueryData(['games', 'pending'], (old: Game[] | undefined) =>
      old?.filter(g => g.id !== gameId) || []
    );

    // Remove from active games
    removeActiveGame(gameId);
  }, [queryClient, removeActiveGame]);

  /**
   * Rollback optimistic create if transaction fails
   */
  const rollbackOptimisticCreate = useCallback((txHash: string) => {
    const optimisticId = `optimistic-${txHash.toLowerCase().slice(0, 10)}`;

    devLog.log(`⚡ [Optimistic] Rolling back create: ${optimisticId}`);

    queryClient.setQueryData(['games', 'pending'], (old: Game[] | undefined) =>
      old?.filter(g => g.id !== optimisticId) || []
    );

    removeActiveGame(optimisticId);
  }, [queryClient, removeActiveGame]);

  /**
   * Rollback optimistic join if transaction fails
   */
  const rollbackOptimisticJoin = useCallback((gameId: string, originalGame: Game) => {
    devLog.log(`⚡ [Optimistic] Rolling back join: ${gameId}`);

    // Restore to pending cache
    queryClient.setQueryData(['games', 'pending'], (old: Game[] | undefined) => {
      if (!old) return [originalGame];
      if (old.some(g => g.id === gameId)) return old;
      return [originalGame, ...old];
    });

    // Update individual game cache
    queryClient.setQueryData(['game', gameId], originalGame);

    // Remove from active games
    removeActiveGame(gameId);
  }, [queryClient, removeActiveGame]);

  /**
   * Rollback optimistic cancel if transaction fails
   */
  const rollbackOptimisticCancel = useCallback((game: Game) => {
    devLog.log(`⚡ [Optimistic] Rolling back cancel: ${game.id}`);

    // Restore to pending cache
    queryClient.setQueryData(['games', 'pending'], (old: Game[] | undefined) => {
      if (!old) return [game];
      if (old.some(g => g.id === game.id)) return old;
      return [game, ...old];
    });

    // Add back to active games
    addActiveGame(game);
  }, [queryClient, addActiveGame]);

  return {
    optimisticCreateGame,
    optimisticJoinGame,
    optimisticCancelGame,
    removeOptimisticGame,
    rollbackOptimisticCreate,
    rollbackOptimisticJoin,
    rollbackOptimisticCancel,
  };
}
