'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { usePlayerGames } from './useGames';
import { useGameSync, validateGameState } from './useGameSync';
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

/**
 * Load shown games from localStorage, filtering out expired entries
 */
function loadShownGames(): Map<string, ShownGameEntry> {
  if (typeof window === 'undefined') return new Map();

  try {
    const stored = localStorage.getItem(SHOWN_GAMES_KEY);
    if (!stored) return new Map();

    const entries: ShownGameEntry[] = JSON.parse(stored);
    const now = Date.now();

    // Filter out expired entries and convert to Map
    const validEntries = entries.filter(
      (entry) => now - entry.shownAt < SHOWN_GAMES_EXPIRY
    );

    return new Map(validEntries.map((entry) => [entry.gameId, entry]));
  } catch (err) {
    console.error('Error loading shown games:', err);
    return new Map();
  }
}

/**
 * Save shown games to localStorage
 */
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
 */
export function useActiveGameMonitor() {
  const { address } = useAccount();
  const { data: games, isLoading } = usePlayerGames(address);
  const { setShowMatchModal, setActiveGame, setActiveGameId } = useGameStore();

  const [sessionGame, setSessionGame] = useState<Game | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);

  // Track which games we've already shown modals for (persisted)
  const shownGamesRef = useRef<Map<string, ShownGameEntry>>(new Map());
  const initializedRef = useRef(false);

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

    // Never shown before - show it
    if (!entry) {
      return true;
    }

    // If game was shown as 'matched' but now is 'resolved', show again
    if (entry.status === 'matched' && game.status === 'resolved') {
      return true;
    }

    // Already shown in current status - don't show again
    return false;
  }, []);

  // Subscribe to the active session game using game-specific channel
  useGameSync(sessionGame?.id ?? null, (updatedGame) => {
    console.log('🎮 Active game updated:', updatedGame.status);

    // Validate state before updating
    const validation = validateGameState(updatedGame);
    if (!validation.valid) {
      console.error('❌ Invalid game state:', validation.errors);
      return;
    }

    // Update session game with validated data
    setSessionGame(updatedGame);
    setActiveGame(updatedGame);

    // If game transitioned to resolved, mark it
    if (updatedGame.status === 'resolved') {
      markGameAsShown(updatedGame.id, 'resolved');
    }
  });

  // Monitor all player games for new matches/resolutions
  useEffect(() => {
    if (!address || !games || !initializedRef.current) return;

    const lowerAddress = address.toLowerCase();

    // Find games that need modal display
    const activeGames = games.filter((game) => {
      const isParticipant =
        game.creator_address?.toLowerCase() === lowerAddress ||
        game.joiner_address?.toLowerCase() === lowerAddress;

      if (!isParticipant) return false;

      // Only consider matched or resolved games
      if (game.status !== 'matched' && game.status !== 'resolved') {
        return false;
      }

      return shouldShowModal(game);
    });

    if (activeGames.length > 0) {
      // Show the most recent game that hasn't been shown
      const game = activeGames[0];

      // Validate before showing
      const validation = validateGameState(game);
      if (!validation.valid) {
        console.warn('⚠️ Skipping invalid game:', validation.errors);
        return;
      }

      console.log(`📢 Showing modal for game ${game.id} (${game.status})`);

      // Mark as shown with current status
      markGameAsShown(game.id, game.status);

      // Update store
      setActiveGame(game);
      setActiveGameId(game.id);
      setSessionGame(game);
      setShowSessionModal(true);

      if (game.status === 'matched') {
        setShowMatchModal(true);
      }
    }
  }, [games, address, setActiveGame, setActiveGameId, setShowMatchModal, shouldShowModal, markGameAsShown]);

  const handleCloseModal = useCallback(() => {
    // Make sure the game is marked as shown when closing
    if (sessionGame) {
      markGameAsShown(sessionGame.id, sessionGame.status);
    }

    setShowSessionModal(false);
    setSessionGame(null);
    setShowMatchModal(false);
    setActiveGame(null);
    setActiveGameId(null);
  }, [sessionGame, markGameAsShown, setShowMatchModal, setActiveGame, setActiveGameId]);

  return {
    sessionGame,
    showSessionModal,
    handleCloseModal,
    isLoading,
  };
}
