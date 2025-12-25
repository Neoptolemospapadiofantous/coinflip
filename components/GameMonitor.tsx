'use client';

import { useActiveGameMonitor } from '@/hooks/useActiveGameMonitor';
import { useGameTimeout } from '@/hooks/useGameTimeout';
import { GameSessionModal } from './game/GameSessionModal';
import { useAccount } from 'wagmi';

/**
 * Global game monitor component
 * Displays game session modal when user's games are matched or resolved
 * Also handles auto-cancellation of games that timeout (15 minutes)
 */
export function GameMonitor() {
  const { address } = useAccount();
  const { sessionGame, showSessionModal, handleCloseModal } = useActiveGameMonitor();

  // Auto-cancel games that haven't been matched after 15 minutes
  useGameTimeout();

  return (
    <GameSessionModal
      game={sessionGame}
      open={showSessionModal}
      onClose={handleCloseModal}
      userAddress={address}
    />
  );
}
