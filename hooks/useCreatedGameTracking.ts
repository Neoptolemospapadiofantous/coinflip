'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Game } from '@/types/game';

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
}

// Polling interval in ms
const POLL_INTERVAL = 2000;
// Timeout for finding game in ms (2 minutes)
const SEARCH_TIMEOUT = 120000;

/**
 * Hook to track a newly created game from transaction to discovery
 *
 * Flow:
 * 1. After tx confirmation, polls DB to find the game by tx_hash
 * 2. Once found, triggers onGameFound callback
 * 3. Triggers immediate callbacks if game is already matched/resolved
 *
 * Real-time updates after discovery are handled by useRealtimeSync (central sync).
 * This hook only handles the initial polling phase until the game is indexed.
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
  });

  // Refs for lifecycle management
  const mountedRef = useRef(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const currentTxHashRef = useRef<string | null>(null);

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
    if (mountedRef.current) {
      setState({
        game: null,
        isSearching: false,
        error: null,
        elapsedSeconds: 0,
      });
    }
  }, [cleanup]);

  // Main effect: Poll for game until found
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

    console.log('🔍 Starting game tracking for tx:', txHash.slice(0, 10));

    setState({
      game: null,
      isSearching: true,
      error: null,
      elapsedSeconds: 0,
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

    // Poll for game
    const pollForGame = async () => {
      if (!mountedRef.current || gameIdRef.current) return;

      try {
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .eq('tx_hash', txHash.toLowerCase())
          .maybeSingle();

        if (error) {
          console.error('Error polling for game:', error);
          return;
        }

        if (data && mountedRef.current) {
          console.log(`🎮 Found created game:`, data.id, 'status:', data.status);
          gameIdRef.current = data.id;

          // Stop polling
          cleanup();

          // Update state
          setState((prev) => ({
            ...prev,
            game: data,
            isSearching: false,
          }));

          // Notify game found
          onGameFoundRef.current?.(data);

          // Trigger immediate callbacks based on current status
          // (central sync will handle future updates)
          if (data.status === 'matched') {
            onGameMatchedRef.current?.(data);
          } else if (data.status === 'resolved') {
            onGameResolvedRef.current?.(data);
          } else if (data.status === 'cancelled') {
            onGameCancelledRef.current?.(data);
          }
        }
      } catch (err) {
        console.error('Error in game poll:', err);
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
          error: 'Timeout waiting for game to be indexed. Please check your transaction.',
        }));
        cleanup();
      }
    }, SEARCH_TIMEOUT);

    return () => {
      // Don't cleanup on every re-render, only on unmount or txHash change
    };
  }, [txHash, creatorAddress, cleanup]);

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
