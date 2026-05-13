'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Game, parseGame } from '@/types/game';
import { devLog } from '@/lib/utils';
import { useIsLoggedIn } from '@/lib/data';
import { getBlockchainDataSource } from '@/lib/data/blockchain';

interface UseCreatedGameTrackingOptions {
  txHash: string | undefined;
  creatorAddress: string | undefined;
  onGameFound?: (game: Game) => void;
  onGameMatched?: (game: Game) => void;
  onGameResolved?: (game: Game) => void;
  onGameCancelled?: (game: Game) => void;
}

interface TrackingState {
  game: Game | null;
  isSearching: boolean;
  error: string | null;
  elapsedSeconds: number;
  phase: 'waiting_indexer' | 'found' | 'timeout';
}

// Polling interval in ms - fast since we're just checking DB/blockchain
const POLL_INTERVAL = 1000;
// Timeout for finding game in ms (reduced from 30s for faster feedback)
// Modern indexers should pick up events within 5-10 seconds
const SEARCH_TIMEOUT = 15000;

/**
 * Hook to track a newly created game from transaction to discovery
 *
 * In centralized mode: Uses DB polling to find the game after transaction is confirmed.
 * In decentralized mode: Uses blockchain polling to find the game.
 *
 * Contract event watching is handled globally by useContractEventSync.
 */
export function useCreatedGameTracking({
  txHash,
  creatorAddress,
  onGameFound,
  onGameMatched,
  onGameResolved,
  onGameCancelled,
}: UseCreatedGameTrackingOptions): TrackingState & { cancelTracking: () => void } {
  const [state, setState] = useState<TrackingState>({
    game: null,
    isSearching: false,
    error: null,
    elapsedSeconds: 0,
    phase: 'waiting_indexer',
  });

  // Check if we're in centralized mode (logged in)
  const isLoggedIn = useIsLoggedIn();
  const isLoggedInRef = useRef(isLoggedIn);
  isLoggedInRef.current = isLoggedIn;

  // Refs for lifecycle management
  const mountedRef = useRef(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const currentTxHashRef = useRef<string | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Callback refs to avoid re-running effect
  const onGameFoundRef = useRef(onGameFound);
  const onGameMatchedRef = useRef(onGameMatched);
  const onGameResolvedRef = useRef(onGameResolved);
  const onGameCancelledRef = useRef(onGameCancelled);
  onGameFoundRef.current = onGameFound;
  onGameMatchedRef.current = onGameMatched;
  onGameResolvedRef.current = onGameResolved;
  onGameCancelledRef.current = onGameCancelled;

  // Cleanup all resources
  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  }, []);

  // Cancel tracking and reset state
  const cancelTracking = useCallback(() => {
    cleanup();
    // Cleanup subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
    gameIdRef.current = null;
    currentTxHashRef.current = null;
    if (mountedRef.current) {
      setState({
        game: null,
        isSearching: false,
        error: null,
        elapsedSeconds: 0,
        phase: 'waiting_indexer',
      });
    }
  }, [cleanup]);

  // Function to fetch game - uses DB in centralized mode, blockchain in decentralized mode
  const fetchGame = useCallback(async (searchTxHash: string, searchCreatorAddress: string): Promise<Game | null> => {
    try {
      if (isLoggedIn) {
        // Centralized mode: fetch from Supabase
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .eq('tx_hash', searchTxHash.toLowerCase())
          .maybeSingle();

        if (error) {
          devLog.error('Error fetching game from DB:', error);
          return null;
        }

        return data ? parseGame(data) : null;
      } else {
        // Decentralized mode: fetch from blockchain
        devLog.log('[GameTracking] Decentralized mode - polling blockchain');
        const blockchainSource = getBlockchainDataSource();

        // Force a scan for new events first to ensure we have latest data
        // This is a private method, so we call getGames which triggers the scan
        await blockchainSource.getGames(100);

        // Get all games for the creator (not just active - game might already be matched/resolved)
        const allGames = await blockchainSource.getPlayerGames(searchCreatorAddress, 50);

        // Primary match: Find game by exact txHash match (most reliable)
        const txHashMatch = allGames.find(g =>
          g.tx_hash?.toLowerCase() === searchTxHash.toLowerCase()
        );

        if (txHashMatch) {
          devLog.log('[GameTracking] Found game by txHash on blockchain:', txHashMatch.id);
          return txHashMatch;
        }

        // Secondary match: Find the most recent pending game by this creator
        // Only use this if txHash match fails AND there's exactly one pending game
        // This avoids the race condition of matching the wrong game
        const pendingGames = allGames.filter(g =>
          g.status === 'pending' &&
          g.creator_address?.toLowerCase() === searchCreatorAddress.toLowerCase()
        );

        if (pendingGames.length === 1) {
          // Safe to return - only one pending game
          devLog.log('[GameTracking] Found single pending game on blockchain:', pendingGames[0].id);
          return pendingGames[0];
        } else if (pendingGames.length > 1) {
          // Multiple pending games - can't reliably determine which one is new
          // Keep polling until txHash match is found
          devLog.log('[GameTracking] Multiple pending games found, waiting for txHash match...');
          return null;
        }

        return null;
      }
    } catch (err) {
      devLog.error('Error in fetchGame:', err);
      return null;
    }
  }, [isLoggedIn]);

  // Handle game found
  const handleGameFound = useCallback((game: Game) => {
    if (!mountedRef.current || gameIdRef.current) return;

    devLog.log(`🎮 Found created game:`, game.id, 'status:', game.status);
    gameIdRef.current = game.id;

    // Stop polling
    cleanup();

    // Update state
    setState((prev) => ({
      ...prev,
      game,
      isSearching: false,
      phase: 'found',
    }));

    // Notify game found
    onGameFoundRef.current?.(game);

    // Trigger immediate callbacks based on current status
    if (game.status === 'matched') {
      onGameMatchedRef.current?.(game);
    } else if (game.status === 'resolved') {
      onGameResolvedRef.current?.(game);
    } else if (game.status === 'cancelled') {
      onGameCancelledRef.current?.(game);
    }

    // Subscribe to status changes if game is still active (pending or matched)
    // Only subscribe in centralized mode - decentralized mode uses polling
    // We need to track matched games to catch the resolved status
    if ((game.status === 'pending' || game.status === 'matched') && isLoggedInRef.current) {
      devLog.log(`📡 Subscribing to status changes for game ${game.id}`);
      subscriptionRef.current = supabase
        .channel(`game-tracking-${game.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'games',
            filter: `id=eq.${game.id}`,
          },
          (payload) => {
            if (!mountedRef.current) return;
            const updatedGame = parseGame(payload.new);
            if (!updatedGame) {
              devLog.warn(`📡 Game ${game.id} received invalid payload`);
              return;
            }
            devLog.log(`📡 Game ${game.id} status changed to:`, updatedGame.status);

            // Update local state
            setState((prev) => ({
              ...prev,
              game: updatedGame,
            }));

            // Trigger callbacks based on new status
            if (updatedGame.status === 'matched') {
              onGameMatchedRef.current?.(updatedGame);
            } else if (updatedGame.status === 'resolved') {
              onGameResolvedRef.current?.(updatedGame);
            } else if (updatedGame.status === 'cancelled') {
              onGameCancelledRef.current?.(updatedGame);
            }

            // Game is now resolved or cancelled - cleanup subscription
            if ((updatedGame.status === 'resolved' || updatedGame.status === 'cancelled') && subscriptionRef.current) {
              devLog.log(`📡 Game ${game.id} finished (${updatedGame.status}) - cleaning up subscription`);
              supabase.removeChannel(subscriptionRef.current);
              subscriptionRef.current = null;
            }
          }
        )
        .subscribe((status, err) => {
          if (err) {
            devLog.error(`[GameTracking] Subscription error for game ${game.id}:`, err.message);
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            devLog.warn(`[GameTracking] Subscription ${status} for game ${game.id}`);
          }
        });
    } else if (game.status === 'pending' || game.status === 'matched') {
      // Decentralized mode: Use polling instead of subscriptions
      devLog.log(`⚡ Decentralized mode: Using polling for game ${game.id} status updates`);

      // Set up dedicated polling for this game's status
      const blockchainSource = getBlockchainDataSource();
      let lastStatus: string = game.status;

      retryIntervalRef.current = setInterval(async () => {
        if (!mountedRef.current || !gameIdRef.current) return;

        try {
          const updatedGame = await blockchainSource.getGame(gameIdRef.current);
          if (updatedGame && updatedGame.status !== lastStatus) {
            lastStatus = updatedGame.status;
            devLog.log(`⚡ Game ${gameIdRef.current} status changed to:`, updatedGame.status);

            // Update local state
            setState((prev) => ({
              ...prev,
              game: updatedGame,
            }));

            // Trigger callbacks based on new status
            if (updatedGame.status === 'matched') {
              onGameMatchedRef.current?.(updatedGame);
            } else if (updatedGame.status === 'resolved') {
              onGameResolvedRef.current?.(updatedGame);
              // Stop polling - game is finished
              if (retryIntervalRef.current) {
                clearInterval(retryIntervalRef.current);
                retryIntervalRef.current = null;
              }
            } else if (updatedGame.status === 'cancelled') {
              onGameCancelledRef.current?.(updatedGame);
              // Stop polling - game is finished
              if (retryIntervalRef.current) {
                clearInterval(retryIntervalRef.current);
                retryIntervalRef.current = null;
              }
            }
          }
        } catch (error) {
          devLog.warn(`⚡ Error polling game ${gameIdRef.current}:`, error);
        }
      }, 3000); // Poll every 3 seconds for active game tracking
    }
  }, [cleanup]);

  // Main effect: Start tracking when txHash is provided
  useEffect(() => {
    // Skip if no txHash or if same txHash already being tracked
    if (!txHash || !creatorAddress) {
      return;
    }

    // If same txHash, don't restart tracking
    if (currentTxHashRef.current === txHash) {
      return;
    }

    // New txHash - cleanup previous and start fresh
    cleanup();
    currentTxHashRef.current = txHash;
    gameIdRef.current = null;
    mountedRef.current = true;

    devLog.log('🔍 Starting game tracking for tx:', txHash.slice(0, 10));

    setState({
      game: null,
      isSearching: true,
      error: null,
      elapsedSeconds: 0,
      phase: 'waiting_indexer',
    });

    const startTime = Date.now();

    // Start elapsed time counter
    elapsedIntervalRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        elapsedSeconds: Math.floor((Date.now() - startTime) / 1000),
      }));
    }, 1000);

    // Fallback polling (in case event is missed)
    const pollForGame = async () => {
      if (!mountedRef.current || gameIdRef.current) return;

      try {
        const game = await fetchGame(txHash, creatorAddress);
        if (game && mountedRef.current) {
          handleGameFound(game);
        }
      } catch (error) {
        // Log but don't throw - polling will retry
        devLog.warn('🔍 [GameTracking] Poll error:', error instanceof Error ? error.message : 'Unknown error');
      }
    };

    // Initial poll (fire-and-forget with error handling built in)
    void pollForGame();

    // Continue polling until found
    pollIntervalRef.current = setInterval(() => {
      void pollForGame();
    }, POLL_INTERVAL);

    // Timeout
    timeoutRef.current = setTimeout(() => {
      if (!gameIdRef.current && mountedRef.current) {
        devLog.warn('Timeout waiting for game to be indexed');
        setState((prev) => ({
          ...prev,
          isSearching: false,
          phase: 'timeout',
          error: 'Timeout waiting for game. Please check your transaction or refresh.',
        }));
        cleanup();
      }
    }, SEARCH_TIMEOUT);

    return () => {
      // Don't cleanup on every re-render, only on unmount or txHash change
    };
  }, [txHash, creatorAddress, cleanup, fetchGame, handleGameFound]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
      // Cleanup subscription
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [cleanup]);

  return {
    ...state,
    cancelTracking,
  };
}
