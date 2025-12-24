'use client';

import { useEffect, useState, useRef } from 'react';
import { useAccount } from 'wagmi';
import { usePlayerGames } from './useGames';
import { useGameSync, validateGameState } from './useGameSync';
import { Game } from '@/types/game';
import { useGameStore } from '@/store/gameStore';
import { supabase } from '@/lib/supabase';

/**
 * Hook to monitor user's active games and trigger modals for matched/resolved games
 */
export function useActiveGameMonitor() {
  const { address } = useAccount();
  const { data: games, isLoading } = usePlayerGames(address);
  const { setShowMatchModal, setActiveGame, setActiveGameId } = useGameStore();

  const [sessionGame, setSessionGame] = useState<Game | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);

  // Track which games we've already shown modals for
  const shownGamesRef = useRef<Set<string>>(new Set());

  // Subscribe to the active session game using game-specific channel
  useGameSync(sessionGame?.id ?? null, (updatedGame) => {
    console.log('🎮 Active game updated:', updatedGame.status);

    // Validate state before updating
    const validation = validateGameState(updatedGame);
    if (!validation.valid) {
      console.error('❌ Invalid game state:', validation.errors);
      // Don't update UI with invalid state
      return;
    }

    // Update session game with validated data
    setSessionGame(updatedGame);
    setActiveGame(updatedGame);
  });

  // Monitor all player games for new matches/resolutions
  useEffect(() => {
    if (!address || !games) return;

    const lowerAddress = address.toLowerCase();

    // Find games that need modal display
    const activeGames = games.filter((game) => {
      const isParticipant =
        game.creator_address?.toLowerCase() === lowerAddress ||
        game.joiner_address?.toLowerCase() === lowerAddress;

      const needsDisplay =
        (game.status === 'matched' || game.status === 'resolved') &&
        !shownGamesRef.current.has(game.id);

      return isParticipant && needsDisplay;
    });

    if (activeGames.length > 0) {
      // Show the most recent game
      const game = activeGames[0];

      // Validate before showing
      const validation = validateGameState(game);
      if (!validation.valid) {
        console.warn('⚠️ Skipping invalid game:', validation.errors);
        return;
      }

      console.log(`📢 Showing modal for game ${game.id} (${game.status})`);

      // Mark as shown
      shownGamesRef.current.add(game.id);

      // Update store
      setActiveGame(game);
      setActiveGameId(game.id);
      setSessionGame(game);
      setShowSessionModal(true);

      if (game.status === 'matched') {
        setShowMatchModal(true);
      }
    }
  }, [games, address, setActiveGame, setActiveGameId, setShowMatchModal]);

  const handleCloseModal = () => {
    setShowSessionModal(false);
    setSessionGame(null);
    setShowMatchModal(false);
    setActiveGame(null);
    setActiveGameId(null);
  };

  return {
    sessionGame,
    showSessionModal,
    handleCloseModal,
    isLoading,
  };
}
