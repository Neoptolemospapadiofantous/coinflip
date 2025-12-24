'use client';

import { useEffect, useState, useRef } from 'react';
import { useAccount } from 'wagmi';
import { usePlayerGames, useGameSubscription } from './useGames';
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

  // Subscribe to real-time updates for user's games
  useEffect(() => {
    if (!address) return;

    const channel = supabase
      .channel(`player-games:${address}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
        },
        (payload) => {
          const game = payload.new as Game;
          const lowerAddress = address.toLowerCase();

          // Check if this game belongs to the user
          if (
            game.creator_address?.toLowerCase() === lowerAddress ||
            game.joiner_address?.toLowerCase() === lowerAddress
          ) {
            // If game is matched or resolved, show modal
            if (game.status === 'matched' || game.status === 'resolved') {
              setSessionGame(game);
              setActiveGame(game);
              setActiveGameId(game.id);
              setShowSessionModal(true);

              if (game.status === 'matched') {
                setShowMatchModal(true);
              }
            }
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      channel.unsubscribe();
    };
  }, [address, setActiveGame, setActiveGameId, setShowMatchModal]);

  // Initial check for existing active games
  useEffect(() => {
    if (!games || games.length === 0) return;

    // Find games that are matched or recently resolved
    const activeGames = games.filter((game) =>
      (game.status === 'matched' || game.status === 'resolved') &&
      !shownGamesRef.current.has(game.id)
    );

    if (activeGames.length > 0) {
      // Show the most recent active game
      const game = activeGames[0];

      // Mark as shown
      shownGamesRef.current.add(game.id);

      // Update store
      setActiveGame(game);
      setActiveGameId(game.id);

      // Show modal
      setSessionGame(game);
      setShowSessionModal(true);

      // If game is matched, also set the match modal flag for other components
      if (game.status === 'matched') {
        setShowMatchModal(true);
      }
    }
  }, [games, setActiveGame, setActiveGameId, setShowMatchModal]);

  // Update the session game when the status changes (e.g., matched → resolved)
  useEffect(() => {
    if (!sessionGame || !games) return;

    const updatedGame = games.find((g) => g.id === sessionGame.id);
    if (updatedGame && updatedGame.status !== sessionGame.status) {
      // Game status changed, update the session game
      setSessionGame(updatedGame);
    }
  }, [games, sessionGame]);

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
