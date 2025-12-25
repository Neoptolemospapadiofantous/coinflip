'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Game } from '@/types/game';

/**
 * Hook to subscribe to a specific game's updates
 * Both players subscribe to the SAME channel for consistent state
 * Includes error handling and reconnection logic
 */
export function useGameSync(gameId: string | null, onGameUpdate?: (game: Game) => void) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  // Use ref for callback to avoid subscription recreation
  const onGameUpdateRef = useRef(onGameUpdate);
  onGameUpdateRef.current = onGameUpdate;

  // Track retry attempts
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  useEffect(() => {
    if (!gameId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const createSubscription = () => {
      console.log(`🔄 Subscribing to game ${gameId} updates (attempt ${retryCountRef.current + 1})`);

      channel = supabase
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
                return;
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

            // Update only the specific game in cache
            queryClient.setQueryData(['game', gameId], updatedGame);

            // Trigger callback via ref (stable reference)
            onGameUpdateRef.current?.(updatedGame);
          }
        )
        .subscribe((status, err) => {
          console.log(`📡 Subscription status for game ${gameId}:`, status, err ? `Error: ${err.message}` : '');

          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
            retryCountRef.current = 0; // Reset retry count on success
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setIsConnected(false);
            console.error(`❌ Subscription error for game ${gameId}:`, status, err);

            // Attempt reconnection with exponential backoff
            if (retryCountRef.current < maxRetries) {
              const delay = Math.pow(2, retryCountRef.current) * 1000; // 1s, 2s, 4s
              console.log(`🔄 Retrying subscription in ${delay}ms...`);
              retryCountRef.current++;

              if (channel) {
                channel.unsubscribe();
                channel = null;
              }

              retryTimeout = setTimeout(createSubscription, delay);
            } else {
              console.error(`❌ Max retries reached for game ${gameId} subscription`);
            }
          } else if (status === 'CLOSED') {
            setIsConnected(false);
          }
        });
    };

    createSubscription();

    // Cleanup on unmount
    return () => {
      console.log(`🔌 Unsubscribing from game ${gameId}`);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (channel) {
        channel.unsubscribe();
      }
      setIsConnected(false);
    };
  }, [gameId, queryClient]);

  return { isConnected };
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
