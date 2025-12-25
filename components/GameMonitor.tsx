'use client';

import { useActiveGameMonitor } from '@/hooks/useActiveGameMonitor';
import { useGameTimeout } from '@/hooks/useGameTimeout';
import { GameSessionModal } from './game/GameSessionModal';
import { useAccount } from 'wagmi';
import { useGameStore } from '@/store/gameStore';

/**
 * Global game monitor component
 * Displays game session modal when user's games are matched or resolved
 * Also handles timeout notifications for games (20 minutes - matches contract TIMEOUT_BLOCKS)
 */
export function GameMonitor() {
  const { address } = useAccount();
  const { sessionGame, showSessionModal, handleCloseModal } = useActiveGameMonitor();
  const currentModalType = useGameStore((state) => state.currentModalType);

  // Show notification for games that haven't been matched after 20 minutes
  useGameTimeout();

  return (
    <GameSessionModal
      game={sessionGame}
      open={showSessionModal}
      onClose={handleCloseModal}
      userAddress={address}
      modalType={currentModalType}
    />
  );
}
