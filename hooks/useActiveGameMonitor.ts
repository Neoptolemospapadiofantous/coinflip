'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { usePlayerGames } from './useGames';
import { validateGameState } from './useGameSync';
import { Game } from '@/types/game';
import { useGameStore } from '@/store/gameStore';

// LocalStorage key for tracking shown games
const SHOWN_GAMES_KEY = 'coinflip_shown_games';
// How long to remember shown games (24 hours in ms)
const SHOWN_GAMES_EXPIRY = 24 * 60 * 60 * 1000;

interface ShownGameEntry {
  gameId: string;
  status: string;
  shownAt: number;
}

function loadShownGames(): Map<string, ShownGameEntry> {
  if (typeof window === 'undefined') return new Map();

  try {
    const stored = localStorage.getItem(SHOWN_GAMES_KEY);
    if (!stored) return new Map();

    const entries: ShownGameEntry[] = JSON.parse(stored);
    const now = Date.now();

    const validEntries = entries.filter(
      (entry) => now - entry.shownAt < SHOWN_GAMES_EXPIRY
    );

    return new Map(validEntries.map((entry) => [entry.gameId, entry]));
  } catch (err) {
    console.error('Error loading shown games:', err);
    return new Map();
  }
}

function saveShownGames(games: Map<string, ShownGameEntry>) {
  if (typeof window === 'undefined') return;

  try {
    const entries = Array.from(games.values());
    localStorage.setItem(SHOWN_GAMES_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Error saving shown games:', err);
  }
}

/**
 * Hook to monitor user's active games and trigger modals for matched/resolved games
 * Now uses modal queue system for handling multiple concurrent games
 *
 * IMPORTANT: This hook only monitors games from usePlayerGames query.
 * Games created in the current session are tracked by useCreatedGameTracking.
 *
 * Deduplication happens at 3 levels (defense in depth):
 * 1. localStorage (shownGamesRef) - Prevents showing same modal after page refresh
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

  // Track which games we've already shown modals for (persisted)
  const shownGamesRef = useRef<Map<string, ShownGameEntry>>(new Map());
  const initializedRef = useRef(false);

  // Track games processed this session to avoid re-processing on every query update
  const processedGamesRef = useRef<Set<string>>(new Set());

  // Initialize from localStorage on mount
  useEffect(() => {
    if (!initializedRef.current) {
      shownGamesRef.current = loadShownGames();
      initializedRef.current = true;
    }
  }, []);

  // Mark a game as shown
  const markGameAsShown = useCallback((gameId: string, status: string) => {
    const entry: ShownGameEntry = {
      gameId,
      status,
      shownAt: Date.now(),
    };
    shownGamesRef.current.set(gameId, entry);
    saveShownGames(shownGamesRef.current);
  }, []);

  // Check if we should show a modal for this game
  const shouldShowModal = useCallback((game: Game): boolean => {
    const entry = shownGamesRef.current.get(game.id);

    if (!entry) {
      return true;
    }

    // If game was shown as 'matched' but now is 'resolved', show again
    if (entry.status === 'matched' && game.status === 'resolved') {
      return true;
    }

    return false;
  }, []);

  // Real-time updates are handled centrally by useRealtimeSync (in Providers)
  // This hook just monitors query data and triggers modals for new matches/resolutions

  // Monitor all player games for new matches/resolutions
  useEffect(() => {
    if (!address || !games || !initializedRef.current) return;

    const lowerAddress = address.toLowerCase();

    // Find games that need processing
    games.forEach((game) => {
      const isParticipant =
        game.creator_address?.toLowerCase() === lowerAddress ||
        game.joiner_address?.toLowerCase() === lowerAddress;

      if (!isParticipant) return;

      // Generate a unique key for this game+status combination
      const processKey = `${game.id}:${game.status}`;

      // Skip if already processed this status for this game
      if (processedGamesRef.current.has(processKey)) {
        return;
      }

      // Add active games to the store (pending or matched)
      if (game.status === 'pending' || game.status === 'matched') {
        // Only add if not already in store (prevents duplicate additions)
        if (!getActiveGame(game.id)) {
          addActiveGame(game);
        } else {
          // Update existing game with latest data
          updateActiveGame(game);
        }
      }

      // Queue modals for games that need display
      if ((game.status === 'matched' || game.status === 'resolved') && shouldShowModal(game)) {
        const validation = validateGameState(game);
        if (!validation.valid) {
          console.warn('⚠️ Skipping invalid game:', validation.errors);
          return;
        }

        console.log(`📢 Queueing modal for game ${game.id} (${game.status})`);
        processedGamesRef.current.add(processKey);
        markGameAsShown(game.id, game.status);
        queueModal(game, game.status === 'matched' ? 'matched' : 'resolved');
      }
    });
  }, [games, address, addActiveGame, updateActiveGame, getActiveGame, queueModal, shouldShowModal, markGameAsShown]);

  const handleCloseModal = useCallback(() => {
    // Mark the current game as shown when closing
    if (currentModalGame) {
      markGameAsShown(currentModalGame.id, currentModalGame.status);
    }
    closeCurrentModal();
  }, [currentModalGame, markGameAsShown, closeCurrentModal]);

  return {
    sessionGame: currentModalGame,
    showSessionModal: showGameModal,
    handleCloseModal,
    isLoading,
  };
}
