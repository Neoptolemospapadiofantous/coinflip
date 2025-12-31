'use client';

import dynamic from 'next/dynamic';
import { useActiveGameMonitor } from '@/hooks/useActiveGameMonitor';
import { useWalletChangeDetection } from '@/hooks/useWalletChangeDetection';
import { useGameTimeout } from '@/hooks/useGameTimeout';
import { useAccount } from 'wagmi';
import { useGameStore } from '@/store/gameStore';

// Lazy load GameSessionModal - only loaded when modal is shown
// This reduces initial bundle size by ~50KB (modal is 1000+ lines)
const GameSessionModal = dynamic(
  () => import('./game/GameSessionModal').then(mod => ({ default: mod.GameSessionModal })),
  { ssr: false }
);

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
