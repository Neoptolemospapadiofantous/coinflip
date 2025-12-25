'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useWatchContractEvent, useChainId } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { Game } from '@/types/game';
import { COINFLIP_ABI } from '@/lib/contracts/abi';
import { getCoinFlipAddress } from '@/lib/contracts/addresses';

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
  phase: 'waiting_event' | 'waiting_indexer' | 'found' | 'timeout';
}

// Fallback polling interval in ms (faster since event should arrive first)
const POLL_INTERVAL = 1000;
// Timeout for finding game in ms (30 seconds - much shorter since we have events)
const SEARCH_TIMEOUT = 30000;

/**
 * Hook to track a newly created game from transaction to discovery
 *
 * Improved Flow:
 * 1. Listen for GameCreated contract event matching creator address
 * 2. When event arrives, immediately poll DB for the game
 * 3. Fallback polling runs in parallel as backup
 * 4. Much faster discovery since we don't wait for polling interval
 */
export function useCreatedGameTracking({
  txHash,
  creatorAddress,
  onGameFound,
  onGameMatched,
  onGameResolved,
  onGameCancelled,
}: UseCreatedGameTrackingOptions): TrackingState & { cancelTracking: () => void } {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  const [state, setState] = useState<TrackingState>({
    game: null,
    isSearching: false,
    error: null,
    elapsedSeconds: 0,
    phase: 'waiting_event',
  });

  // Refs for lifecycle management
  const mountedRef = useRef(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const currentTxHashRef = useRef<string | null>(null);
  const eventReceivedRef = useRef(false);

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
  }, []);

  // Cancel tracking and reset state
  const cancelTracking = useCallback(() => {
    cleanup();
    gameIdRef.current = null;
    currentTxHashRef.current = null;
    eventReceivedRef.current = false;
    if (mountedRef.current) {
      setState({
        game: null,
        isSearching: false,
        error: null,
        elapsedSeconds: 0,
        phase: 'waiting_event',
      });
    }
  }, [cleanup]);

  // Function to fetch game from DB
  const fetchGameFromDB = useCallback(async (searchTxHash: string): Promise<Game | null> => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('tx_hash', searchTxHash.toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('Error fetching game:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error in fetchGameFromDB:', err);
      return null;
    }
  }, []);

  // Handle game found
  const handleGameFound = useCallback((game: Game) => {
    if (!mountedRef.current || gameIdRef.current) return;

    console.log(`🎮 Found created game:`, game.id, 'status:', game.status);
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
  }, [cleanup]);

  // Watch for GameCreated events from the contract
  useWatchContractEvent({
    address: contractAddress,
    abi: COINFLIP_ABI,
    eventName: 'GameCreated',
    enabled: !!txHash && !!creatorAddress && !gameIdRef.current,
    onLogs: async (logs) => {
      if (!txHash || !creatorAddress || gameIdRef.current) return;

      for (const log of logs) {
        // Check if this event matches our transaction
        if (log.transactionHash?.toLowerCase() === txHash.toLowerCase()) {
          console.log('📡 GameCreated event received for tx:', txHash.slice(0, 10));
          eventReceivedRef.current = true;

          // Update phase
          if (mountedRef.current) {
            setState((prev) => ({
              ...prev,
              phase: 'waiting_indexer',
            }));
          }

          // Immediately try to fetch from DB (indexer may have already processed it)
          const game = await fetchGameFromDB(txHash);
          if (game) {
            handleGameFound(game);
            return;
          }

          // If not in DB yet, poll more aggressively for a few seconds
          let retries = 0;
          const maxRetries = 10;
          const retryInterval = setInterval(async () => {
            if (gameIdRef.current || retries >= maxRetries) {
              clearInterval(retryInterval);
              return;
            }
            retries++;
            const retryGame = await fetchGameFromDB(txHash);
            if (retryGame) {
              clearInterval(retryInterval);
              handleGameFound(retryGame);
            }
          }, 500);

          return;
        }
      }
    },
  });

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
    eventReceivedRef.current = false;
    mountedRef.current = true;

    console.log('🔍 Starting game tracking for tx:', txHash.slice(0, 10));

    setState({
      game: null,
      isSearching: true,
      error: null,
      elapsedSeconds: 0,
      phase: 'waiting_event',
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

      const game = await fetchGameFromDB(txHash);
      if (game && mountedRef.current) {
        handleGameFound(game);
      }
    };

    // Initial poll
    pollForGame();

    // Continue polling until found
    pollIntervalRef.current = setInterval(pollForGame, POLL_INTERVAL);

    // Timeout
    timeoutRef.current = setTimeout(() => {
      if (!gameIdRef.current && mountedRef.current) {
        console.warn('Timeout waiting for game to be indexed');
        setState((prev) => ({
          ...prev,
          isSearching: false,
          phase: 'timeout',
          error: eventReceivedRef.current
            ? 'Game event received but database sync is slow. Please refresh.'
            : 'Timeout waiting for game. Please check your transaction.',
        }));
        cleanup();
      }
    }, SEARCH_TIMEOUT);

    return () => {
      // Don't cleanup on every re-render, only on unmount or txHash change
    };
  }, [txHash, creatorAddress, cleanup, fetchGameFromDB, handleGameFound]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    cancelTracking,
  };
}
