'use client';

import { useActiveGameMonitor } from '@/hooks/useActiveGameMonitor';
import { GameSessionModal } from './game/GameSessionModal';
import { useAccount } from 'wagmi';

/**
 * Global game monitor component
 * Displays game session modal when user's games are matched or resolved
 */
export function GameMonitor() {
  const { address } = useAccount();
  const { sessionGame, showSessionModal, handleCloseModal } = useActiveGameMonitor();

  return (
    <GameSessionModal
      game={sessionGame}
      open={showSessionModal}
      onClose={handleCloseModal}
      userAddress={address}
    />
  );
}
