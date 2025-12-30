'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { usePlayerGames } from './useGames';
import { validateGameState } from './useGameSync';
import { Game } from '@/types/game';
import { useGameStore } from '@/store/gameStore';
import { useNotificationState } from './useNotificationState';
import { devLog } from '@/lib/utils';

/**
 * Hook to monitor user's active games and trigger modals for matched/resolved games
 * Uses database-backed notification state to prevent duplicate modals/sounds
 *
 * IMPORTANT: This hook only monitors games from usePlayerGames query.
 * Games created in the current session are tracked by useCreatedGameTracking.
 *
 * Deduplication happens at 3 levels (defense in depth):
 * 1. Database (user_game_notifications) - Prevents showing same modal across devices/sessions
 * 2. processedGamesRef - Prevents re-processing on query updates within a session
 * 3. gameStore.queueModal - Final safety net with built-in duplicate check
 */
export function useActiveGameMonitor() {
  const { address } = useAccount();
  const { data: games, isLoading } = usePlayerGames(address);
  const {
    queueModal,
    closeCurrentModal,
    showGameModal,
    currentModalGame,
    addActiveGame,
    updateActiveGame,
    getActiveGame,
  } = useGameStore();

  const {
    shouldShowModal,
    markModalShown,
    prefetchNotifications,
  } = useNotificationState();

  // Track games processed this session to avoid re-processing on every query update
  const processedGamesRef = useRef<Set<string>>(new Set());
  const knownGameIdsRef = useRef<Set<string>>(new Set());
  const prefetchedRef = useRef(false);

  // Prefetch notification states when games load
  useEffect(() => {
    if (!games || games.length === 0 || prefetchedRef.current) return;

    const gameIds = games.map(g => g.id);
    prefetchNotifications(gameIds);
    prefetchedRef.current = true;
  }, [games, prefetchNotifications]);

  // Reset prefetch flag when address changes
  useEffect(() => {
    prefetchedRef.current = false;
    processedGamesRef.current.clear();
    knownGameIdsRef.current.clear();
  }, [address]);

  // Monitor all player games for new matches/resolutions
  useEffect(() => {
    if (!address || !games) return;

    const lowerAddress = address.toLowerCase();

    // Collect current game IDs for cleanup
    const currentGameIds = new Set(games.map(g => g.id));

    // Cleanup processedGamesRef entries for games that no longer exist
    // This prevents memory growth and stale entries
    for (const processKey of processedGamesRef.current) {
      const gameId = processKey.split(':')[0];
      if (!currentGameIds.has(gameId)) {
        processedGamesRef.current.delete(processKey);
        devLog.log(`🧹 [ActiveGameMonitor] Cleaned up processed entry: ${processKey}`);
      }
    }

    // Update known game IDs
    knownGameIdsRef.current = currentGameIds;

    // Process games asynchronously
    const processGames = async () => {
      for (const game of games) {
        const isParticipant =
          game.creator_address?.toLowerCase() === lowerAddress ||
          game.joiner_address?.toLowerCase() === lowerAddress;

        if (!isParticipant) continue;

        // Generate a unique key for this game+status combination
        const processKey = `${game.id}:${game.status}`;

        // Skip if already processed this status for this game
        if (processedGamesRef.current.has(processKey)) {
          continue;
        }

        // Add active games to the store (pending or matched)
        if (game.status === 'pending' || game.status === 'matched') {
          if (!getActiveGame(game.id)) {
            addActiveGame(game);
          } else {
            updateActiveGame(game);
          }
        }

        // Queue modals for games that need display
        if (game.status === 'matched' || game.status === 'resolved') {
          const modalType = game.status === 'matched' ? 'matched' : 'resolved';

          // Check database for whether modal was already shown
          const shouldShow = await shouldShowModal(game.id, modalType);

          if (shouldShow) {
            const validation = validateGameState(game);
            if (!validation.valid) {
              devLog.warn('⚠️ Skipping invalid game:', validation.errors);
              continue;
            }

            devLog.log(`📢 Queueing modal for game ${game.id} (${game.status})`);
            processedGamesRef.current.add(processKey);

            // Mark as shown in database BEFORE queuing to prevent race conditions
            await markModalShown(game.id, modalType);

            queueModal(game, modalType);
          } else {
            // Already shown, just mark as processed for this session
            processedGamesRef.current.add(processKey);
          }
        }
      }
    };

    processGames();
  }, [games, address, addActiveGame, updateActiveGame, getActiveGame, queueModal, shouldShowModal, markModalShown]);

  const handleCloseModal = useCallback(async () => {
    // Mark the current game as shown when closing (redundant but safe)
    if (currentModalGame) {
      const modalType = currentModalGame.status === 'matched' ? 'matched' :
                        currentModalGame.status === 'resolved' ? 'resolved' : 'expired';
      await markModalShown(currentModalGame.id, modalType as 'matched' | 'resolved' | 'expired');
    }
    closeCurrentModal();
  }, [currentModalGame, markModalShown, closeCurrentModal]);

  return {
    sessionGame: currentModalGame,
    showSessionModal: showGameModal,
    handleCloseModal,
    isLoading,
  };
}
