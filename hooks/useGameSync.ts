'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Game } from '@/types/game';

/**
 * Hook to subscribe to a specific game's updates
 * Both players subscribe to the SAME channel for consistent state
 */
export function useGameSync(gameId: string | null, onGameUpdate?: (game: Game) => void) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!gameId) return;

    console.log(`🔄 Subscribing to game ${gameId} updates`);

    // Subscribe to game-specific channel (both players use the same channel)
    const channel = supabase
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
          const updatedGame = payload.new as Game;

          console.log(`✅ Game ${gameId} updated:`, {
            status: updatedGame.status,
            coin_result: updatedGame.coin_result,
            winner: updatedGame.winner_address,
          });

          // Validate state consistency
          if (updatedGame.status === 'resolved') {
            if (updatedGame.coin_result === null) {
              console.warn('⚠️ Game resolved but coin_result is null - waiting for next update');
              return; // Don't trigger update until coin_result is available
            }

            if (!updatedGame.winner_address) {
              console.warn('⚠️ Game resolved but no winner_address - waiting for next update');
              return;
            }

            // Verify winner's choice matches coin result
            const winnerIsCreator = updatedGame.winner_address.toLowerCase() === updatedGame.creator_address.toLowerCase();
            const winnerChoice = winnerIsCreator ? updatedGame.creator_choice : updatedGame.joiner_choice;

            if (winnerChoice !== updatedGame.coin_result) {
              console.error('❌ STATE MISMATCH: Winner choice does not match coin result!', {
                winner: updatedGame.winner_address,
                winnerChoice,
                coinResult: updatedGame.coin_result,
              });
            }
          }

          // Update query cache with new data
          queryClient.setQueryData(['game', gameId], updatedGame);
          queryClient.invalidateQueries({ queryKey: ['games'] });
          queryClient.invalidateQueries({ queryKey: ['games', 'player'] });

          // Trigger callback
          if (onGameUpdate) {
            onGameUpdate(updatedGame);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Subscription status for game ${gameId}:`, status);
      });

    // Cleanup on unmount
    return () => {
      console.log(`🔌 Unsubscribing from game ${gameId}`);
      channel.unsubscribe();
    };
  }, [gameId, queryClient, onGameUpdate]);
}

/**
 * Validate game state consistency
 */
export function validateGameState(game: Game): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Resolved game validations
  if (game.status === 'resolved') {
    if (game.coin_result === null) {
      errors.push('Resolved game missing coin_result');
    }

    if (!game.winner_address) {
      errors.push('Resolved game missing winner_address');
    }

    if (!game.payout) {
      errors.push('Resolved game missing payout');
    }

    // Verify winner's choice matches result
    if (game.winner_address && game.coin_result !== null) {
      const winnerIsCreator = game.winner_address.toLowerCase() === game.creator_address.toLowerCase();
      const winnerChoice = winnerIsCreator ? game.creator_choice : game.joiner_choice;

      if (winnerChoice !== game.coin_result) {
        errors.push(`Winner choice (${winnerChoice}) does not match coin result (${game.coin_result})`);
      }
    }
  }

  // Matched game validations
  if (game.status === 'matched') {
    if (!game.joiner_address) {
      errors.push('Matched game missing joiner_address');
    }

    if (game.joiner_choice === null) {
      errors.push('Matched game missing joiner_choice');
    }

    // Verify players chose different sides
    if (game.joiner_choice !== null && game.creator_choice === game.joiner_choice) {
      errors.push('Both players chose the same side (should be impossible)');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
