'use client';

import { useActiveGameMonitor } from '@/hooks/useActiveGameMonitor';
import { useWalletChangeDetection } from '@/hooks/useWalletChangeDetection';
import { useGameTimeout } from '@/hooks/useGameTimeout';
import { GameSessionModal } from './game/GameSessionModal';
import { useAccount } from 'wagmi';
import { useGameStore } from '@/store/gameStore';

/**
 * Global game monitor component
 * Displays game session modal when user's games are matched or resolved
 * Detects wallet changes and clears active games when user switches wallets
 * Auto-triggers expired modal when games pass 5-minute threshold
 * Note: Auto-cancellation after 5 minutes is handled by Chainlink Automation on-chain
 */
export function GameMonitor() {
  const { address } = useAccount();
  const { sessionGame, showSessionModal, handleCloseModal } = useActiveGameMonitor();
  const currentModalType = useGameStore((state) => state.currentModalType);

  // Monitor wallet changes
  useWalletChangeDetection();

  // Monitor game timeouts and auto-trigger expired modal
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
