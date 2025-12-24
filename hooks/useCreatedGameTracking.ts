'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  isSubscribed: boolean;
  error: string | null;
  elapsedSeconds: number;
}

// Polling interval in ms
const POLL_INTERVAL = 2000;
// Timeout for finding game in ms (2 minutes)
const SEARCH_TIMEOUT = 120000;

/**
 * Hook to track a newly created game from transaction to completion
 *
 * Flow:
 * 1. After tx confirmation, polls DB to find the game by tx_hash
 * 2. Once found, establishes real-time subscription
 * 3. Triggers callbacks on status changes (matched, resolved, cancelled)
 */
export function useCreatedGameTracking({
  txHash,
  creatorAddress,
  onGameFound,
  onGameMatched,
  onGameResolved,
  onGameCancelled,
}: UseCreatedGameTrackingOptions): TrackingState & { cancelTracking: () => void } {
  const queryClient = useQueryClient();
  const [state, setState] = useState<TrackingState>({
    game: null,
    isSearching: false,
    isSubscribed: false,
    error: null,
    elapsedSeconds: 0,
  });

  // Refs for lifecycle management
  const mountedRef = useRef(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const currentTxHashRef = useRef<string | null>(null);

  // Cleanup all resources
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      console.log('🔌 Cleaning up game tracking subscription');
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
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
    lastStatusRef.current = null;
    currentTxHashRef.current = null;
    if (mountedRef.current) {
      setState({
        game: null,
        isSearching: false,
        isSubscribed: false,
        error: null,
        elapsedSeconds: 0,
      });
    }
  }, [cleanup]);

  // Subscribe to game updates
  const subscribeToGame = useCallback((gameId: string, initialGame: Game) => {
    if (channelRef.current || !mountedRef.current) return;

    console.log(`🔄 Subscribing to created game ${gameId}`);
    gameIdRef.current = gameId;
    lastStatusRef.current = initialGame.status;

    const channel = supabase
      .channel(`created-game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          if (!mountedRef.current) return;

          const updatedGame = payload.new as Game;
          console.log(`✅ Created game ${gameId} updated:`, updatedGame.status);

          // Update state
          setState((prev) => ({ ...prev, game: updatedGame }));

          // Trigger callbacks only on status change
          if (updatedGame.status !== lastStatusRef.current) {
            const prevStatus = lastStatusRef.current;
            lastStatusRef.current = updatedGame.status;

            switch (updatedGame.status) {
              case 'matched':
                console.log('🎮 Triggering onGameMatched callback');
                onGameMatched?.(updatedGame);
                break;
              case 'resolved':
                console.log('🎮 Triggering onGameResolved callback');
                onGameResolved?.(updatedGame);
                // Cleanup after resolved
                cleanup();
                break;
              case 'cancelled':
                console.log('🎮 Triggering onGameCancelled callback');
                onGameCancelled?.(updatedGame);
                // Cleanup after cancelled
                cleanup();
                break;
            }
          }

          // Update query cache
          queryClient.setQueryData(['game', gameId], updatedGame);
          queryClient.invalidateQueries({ queryKey: ['games'] });
          queryClient.invalidateQueries({ queryKey: ['games', 'player'] });
        }
      )
      .subscribe((status) => {
        if (!mountedRef.current) return;
        console.log(`📡 Created game subscription status:`, status);
        setState((prev) => ({ ...prev, isSubscribed: status === 'SUBSCRIBED' }));
      });

    channelRef.current = channel;
  }, [cleanup, queryClient, onGameMatched, onGameResolved, onGameCancelled]);

  // Main effect: Poll for game and subscribe
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
    lastStatusRef.current = null;
    mountedRef.current = true;

    console.log('🔍 Starting game tracking for tx:', txHash.slice(0, 10));

    setState({
      game: null,
      isSearching: true,
      isSubscribed: false,
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

          // Stop polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          // Update state
          setState((prev) => ({
            ...prev,
            game: data,
            isSearching: false,
          }));

          // Notify game found
          onGameFound?.(data);

          // Handle if game is already in a terminal state
          if (data.status === 'matched') {
            onGameMatched?.(data);
          } else if (data.status === 'resolved') {
            onGameResolved?.(data);
            return; // Don't subscribe to resolved games
          } else if (data.status === 'cancelled') {
            onGameCancelled?.(data);
            return; // Don't subscribe to cancelled games
          }

          // Subscribe for future updates if game is still active
          if (data.status === 'pending' || data.status === 'matched') {
            subscribeToGame(data.id, data);
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
  }, [txHash, creatorAddress, cleanup, subscribeToGame, onGameFound, onGameMatched, onGameResolved, onGameCancelled]);

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
