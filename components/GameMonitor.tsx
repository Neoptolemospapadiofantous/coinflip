'use client';

import { useActiveGameMonitor } from '@/hooks/useActiveGameMonitor';
import { GameSessionModal } from './game/GameSessionModal';
import { useAccount } from 'wagmi';
import { useGameStore } from '@/store/gameStore';

/**
 * Global game monitor component
 * Displays game session modal when user's games are matched or resolved
 * Note: Auto-cancellation after 5 minutes is handled by Chainlink Automation on-chain
 */
export function GameMonitor() {
  const { address } = useAccount();
  const { sessionGame, showSessionModal, handleCloseModal } = useActiveGameMonitor();
  const currentModalType = useGameStore((state) => state.currentModalType);

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
