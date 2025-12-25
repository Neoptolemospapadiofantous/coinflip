'use client';

import { Game } from '@/types/game';

/**
 * NOTE: The per-game subscription hook was removed to avoid duplicate subscriptions.
 * All real-time updates are now handled centrally by useRealtimeSync in Providers.
 * This file only exports the validateGameState utility function.
 */

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
