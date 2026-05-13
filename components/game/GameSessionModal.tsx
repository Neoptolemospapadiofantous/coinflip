'use client';

import { Dialog, Progress } from '@radix-ui/themes';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { CoinFlip2D } from './CoinFlip2D';
import { Confetti } from '@/components/effects/Confetti';
import { Game } from '@/types/game';
import { formatCurrency, devLog } from '@/lib/utils';
import { CopyableGameId } from '@/components/ui/CopyableGameId';
import { invalidateGameQueries, removeGameFromPendingCache } from '@/lib/queryUtils';
import { Loader2, Users, Trophy, Zap, AlertTriangle, Clock, XCircle, Layers } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { validateGameState } from '@/hooks/useGameSync';
import { useGame, useGameStats } from '@/hooks/useGames';
import { useCancelGame } from '@/hooks/useContract';
import { showToast } from '@/lib/toast';
import { playSound } from '@/lib/sounds';
import { useNotificationState } from '@/hooks/useNotificationState';
import { useUserPreferences } from '@/hooks/useUserPreferences';

interface GameSessionModalProps {
  game: Game | null;
  open: boolean;
  onClose: () => void;
  userAddress?: string;
  modalType?: 'matched' | 'resolved' | 'expired' | null;
}

// VRF timeout in seconds (2 minutes)
const VRF_TIMEOUT_SECONDS = 120;
// Max retries for fetching complete game data
const MAX_DATA_RETRIES = 10;

export function GameSessionModal({ game, open, onClose, userAddress, modalType }: GameSessionModalProps) {
  const [isFlipping, setIsFlipping] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [vrfElapsedSeconds, setVrfElapsedSeconds] = useState(0);
  const [vrfTimedOut, setVrfTimedOut] = useState(false);
  const [dataRetryExhausted, setDataRetryExhausted] = useState(false);
  const [cancelStatus, setCancelStatus] = useState<'idle' | 'cancelling' | 'success' | 'error'>('idle');
  const [showConfetti, setShowConfetti] = useState(false);
  const [expiredElapsedSeconds, setExpiredElapsedSeconds] = useState(0);
  const [currentRetryCount, setCurrentRetryCount] = useState(0);
  const { resetGame, updateActiveGame, removeActiveGame, modalQueue, skipAllModals } = useGameStore();

  // User preferences from database (skip animation, last game settings)
  const { skipAnimation: alwaysSkipAnimation, setSkipAnimation, saveLastGameSettings, isLoading: preferencesLoading } = useUserPreferences();

  // Use refs to prevent duplicate sounds/toasts (more reliable than state)
  const hasPlayedMatchSoundRef = useRef(false);
  const hasPlayedResultSoundRef = useRef(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  // Cancel game hook
  const { cancelGame, isLoading: isCancelling, isSuccess: cancelSuccess, error: cancelError, reset: resetCancel } = useCancelGame();

  // Notification state for tracking sounds in database
  const { shouldPlaySound, markSoundPlayed, markMultipleModalsShown } = useNotificationState();

  // Fetch fresh game data for auto-refetch on validation errors
  const { data: freshGame, refetch: refetchGame } = useGame(game?.id ?? null);

  // Fetch game stats to get actual average VRF resolution time
  const { data: gameStats } = useGameStats();
  // Calculate typical VRF time from actual game data (default to 25s if no data)
  // avg_game_duration_seconds includes wait time + VRF, so VRF portion is ~60-80% of it
  const typicalVrfSeconds = useMemo(() => {
    if (gameStats?.avg_game_duration_seconds) {
      // Use 80% of average game duration as VRF expectation (conservative estimate)
      return Math.round(gameStats.avg_game_duration_seconds * 0.8);
    }
    return 25; // Default if no data
  }, [gameStats?.avg_game_duration_seconds]);

  // Refs for tracking
  const vrfTimerRef = useRef<NodeJS.Timeout | null>(null);
  const vrfStartTimeRef = useRef<number | null>(null);
  const expiredTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastGameIdRef = useRef<string | null>(null);
  const lastGameStatusRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);

  // Memoize user role calculations to avoid recalculating on every render
  const { isCreator, isJoiner, isParticipant, isWinner } = useMemo(() => {
    const creator = game?.creator_address?.toLowerCase() === userAddress?.toLowerCase();
    const joiner = game?.joiner_address?.toLowerCase() === userAddress?.toLowerCase();
    return {
      isCreator: creator,
      isJoiner: joiner,
      isParticipant: creator || joiner,
      isWinner: game?.winner_address?.toLowerCase() === userAddress?.toLowerCase(),
    };
  }, [game?.creator_address, game?.joiner_address, game?.winner_address, userAddress]);

  // Validate game state with error handling
  const validation = useMemo(() => {
    if (!game) return { valid: false, errors: ['No game data'] };
    try {
      return validateGameState(game);
    } catch (error) {
      devLog.error('Game validation error:', error);
      return { valid: false, errors: ['Validation failed - please refresh'] };
    }
  }, [game]);

  // Track if we've handled the resolved animation for this game
  const resolvedAnimationHandledRef = useRef<string | null>(null);

  // Handle game changes and status transitions
  useEffect(() => {
    if (!game) {
      // Reset all state when game is null
      setIsFlipping(false);
      setShowResult(false);
      setSkipped(false);
      setVrfElapsedSeconds(0);
      setVrfTimedOut(false);
      lastGameIdRef.current = null;
      lastGameStatusRef.current = null;
      resolvedAnimationHandledRef.current = null;
      return;
    }

    const isNewGame = lastGameIdRef.current !== game.id;

    // Track game ID
    lastGameIdRef.current = game.id;

    // Reset state for new game
    if (isNewGame) {
      setSkipped(false);
      setShowResult(false);
      setIsFlipping(false);
      setVrfElapsedSeconds(0);
      setVrfTimedOut(false);
      setShowConfetti(false);
      hasPlayedMatchSoundRef.current = false;
      hasPlayedResultSoundRef.current = false;
      resolvedAnimationHandledRef.current = null;
      lastGameStatusRef.current = null;
    }

    // Handle status transitions
    if (game.status === 'matched') {
      lastGameStatusRef.current = 'matched';

      // Use matched_at from DB as the VRF start time (persists across refreshes)
      // Fall back to Date.now() if matched_at is not yet available
      const matchedTime = game.matched_at ? new Date(game.matched_at).getTime() : Date.now();

      if (!vrfStartTimeRef.current || vrfStartTimeRef.current !== matchedTime) {
        vrfStartTimeRef.current = matchedTime;
        // Calculate initial elapsed time from DB timestamp
        const initialElapsed = Math.floor((Date.now() - matchedTime) / 1000);
        setVrfElapsedSeconds(initialElapsed);
        setVrfTimedOut(initialElapsed >= VRF_TIMEOUT_SECONDS);
      }

      // Play match sound and show toast once (check DB to prevent repeats across refreshes)
      if (!hasPlayedMatchSoundRef.current && isParticipant && game.id) {
        hasPlayedMatchSoundRef.current = true;
        // Check DB and play sound if not already played
        shouldPlaySound(game.id, 'matched').then((shouldPlay) => {
          if (shouldPlay) {
            playSound.match();
            showToast.gameMatched();
            markSoundPlayed(game.id, 'matched');
          }
        });
      }
    }

    // If game is resolved AND state is valid, start animation (only once)
    // Wait for preferences to load before deciding on animation
    // Use resolvedAnimationHandledRef to track whether we've handled this specific game's resolved state
    if (game.status === 'resolved' && validation.valid && !preferencesLoading) {
      const resolvedKey = `${game.id}-resolved`;

      if (resolvedAnimationHandledRef.current !== resolvedKey) {
        resolvedAnimationHandledRef.current = resolvedKey;
        lastGameStatusRef.current = 'resolved';

        // Stop VRF timer
        vrfStartTimeRef.current = null;
        if (vrfTimerRef.current) {
          clearInterval(vrfTimerRef.current);
          vrfTimerRef.current = null;
        }

        // Check if user prefers to skip animation (from DB-backed preferences)
        if (alwaysSkipAnimation) {
          // Skip directly to result
          devLog.log('⏭️ Auto-skipping animation (user preference)');
          setSkipped(true);
          setShowResult(true);
          setIsFlipping(false);
          // Trigger result effects when auto-skipping
          playResultEffects();
        } else {
          // Start flip animation
          setIsFlipping(true);
        }
        setVrfTimedOut(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally using specific game fields to prevent re-renders
  }, [game?.id, game?.status, game?.matched_at, validation.valid, alwaysSkipAnimation, preferencesLoading]);

  // Auto-refetch on validation errors (incomplete VRF data)
  useEffect(() => {
    if (!game || game.status !== 'resolved' || validation.valid) {
      retryCountRef.current = 0;
      setDataRetryExhausted(false);
      setCurrentRetryCount(0);
      return;
    }

    // If resolved but invalid, try to refetch aggressively (max retries)
    if (retryCountRef.current < MAX_DATA_RETRIES) {
      const timeout = setTimeout(() => {
        // Check if still mounted before updating state
        if (!mountedRef.current) return;
        devLog.log(`🔄 Auto-refetching game ${game.id} due to validation errors (attempt ${retryCountRef.current + 1}/${MAX_DATA_RETRIES})`);
        retryCountRef.current++;
        setCurrentRetryCount(retryCountRef.current);
        refetchGame();
      }, 1000); // Retry every 1 second (more aggressive)

      return () => clearTimeout(timeout);
    } else {
      // Exhausted retries
      if (mountedRef.current) {
        setDataRetryExhausted(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally using game?.id to prevent infinite re-renders
  }, [game?.id, game?.status, validation.valid, refetchGame]);

  // Update game in store when fresh data arrives
  useEffect(() => {
    if (freshGame && game && freshGame.id === game.id) {
      const freshValidation = validateGameState(freshGame);
      if (freshValidation.valid && !validation.valid) {
        devLog.log('✅ Fresh game data is valid, updating store');
        updateActiveGame(freshGame);
      }
    }
  }, [freshGame, game, validation.valid, updateActiveGame]);

  // VRF elapsed timer
  useEffect(() => {
    if (game?.status === 'matched' && vrfStartTimeRef.current) {
      vrfTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - vrfStartTimeRef.current!) / 1000);
        setVrfElapsedSeconds(elapsed);

        if (elapsed >= VRF_TIMEOUT_SECONDS) {
          setVrfTimedOut(true);
        }
      }, 1000);

      return () => {
        if (vrfTimerRef.current) {
          clearInterval(vrfTimerRef.current);
        }
      };
    }
  }, [game?.status]);

  // Expired game elapsed timer - track how long past the 5 min expiry
  useEffect(() => {
    if (modalType === 'expired' && game?.status === 'pending' && game?.created_at) {
      // Calculate initial elapsed time since game creation
      const updateElapsed = () => {
        const createdAt = new Date(game.created_at).getTime();
        const elapsed = Math.floor((Date.now() - createdAt) / 1000);
        setExpiredElapsedSeconds(elapsed);
      };

      updateElapsed(); // Set initial value
      expiredTimerRef.current = setInterval(updateElapsed, 1000);

      return () => {
        if (expiredTimerRef.current) {
          clearInterval(expiredTimerRef.current);
          expiredTimerRef.current = null;
        }
      };
    }
  }, [modalType, game?.status, game?.created_at]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (vrfTimerRef.current) {
        clearInterval(vrfTimerRef.current);
      }
      if (expiredTimerRef.current) {
        clearInterval(expiredTimerRef.current);
      }
    };
  }, []);

  // Track cancel status
  useEffect(() => {
    if (cancelSuccess) {
      setCancelStatus('success');
      // Complete the cancellation - remove from active games
      if (game?.id) {
        removeActiveGame(game.id);

        // Immediately invalidate all game queries to update the UI everywhere
        invalidateGameQueries(queryClient, game.id);

        // Also remove from pending games cache immediately (optimistic)
        removeGameFromPendingCache(queryClient, game.id);
      }
    } else if (cancelError) {
      setCancelStatus('error');
      // Cancel failed - nothing to revert since we use local state
    } else if (isCancelling) {
      setCancelStatus('cancelling');
    }
  }, [cancelSuccess, cancelError, isCancelling, game?.id, removeActiveGame, queryClient]);

  // Reset cancel status when modal closes or game changes
  useEffect(() => {
    if (!open || !game) {
      setCancelStatus('idle');
      resetCancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally using game?.id to prevent re-renders on every game update
  }, [open, game?.id, resetCancel]);

  const handleCancelGame = async () => {
    if (!game?.id) return;
    setCancelStatus('cancelling');
    await cancelGame(game.id);
  };

  /// Extracted: Play result effects (sound, confetti, toast)
  const playResultEffects = useCallback(() => {
    if (hasPlayedResultSoundRef.current || !isParticipant || !game?.id) return;
    hasPlayedResultSoundRef.current = true;

    // Save game settings for quick re-bet (to DB for cross-device sync)
    if (game) {
      const userChoice = isCreator ? game.creator_choice : game.joiner_choice;
      if (userChoice !== undefined && userChoice !== null && game.tier !== undefined) {
        saveLastGameSettings({
          tier: game.tier,
          choice: userChoice,
          wasWin: isWinner,
          amount: game.amount,
        });
      }
    }

    // Check DB and play sound if not already played (prevents repeats across refreshes)
    shouldPlaySound(game.id, 'resolved').then((shouldPlay) => {
      if (shouldPlay) {
        if (isWinner) {
          playSound.win();
          setShowConfetti(true);
          showToast.gameWon(formatCurrency(BigInt(game?.payout || 0)));
        } else {
          playSound.loss();
          showToast.gameLost();
        }
        markSoundPlayed(game.id, 'resolved');
      }
    });
  }, [isParticipant, isWinner, isCreator, game, saveLastGameSettings, shouldPlaySound, markSoundPlayed]);

  const handleFlipComplete = useCallback(() => {
    setShowResult(true);
    playResultEffects();
  }, [playResultEffects]);

  const handleSkip = useCallback((savePreference: boolean = false) => {
    if (savePreference) {
      setSkipAnimation(true);
    }
    setSkipped(true);
    setIsFlipping(false);
    setShowResult(true);
    playResultEffects();
  }, [playResultEffects, setSkipAnimation]);

  const toggleSkipPreference = useCallback(() => {
    setSkipAnimation(!alwaysSkipAnimation);
  }, [alwaysSkipAnimation, setSkipAnimation]);

  const handleClose = () => {
    // Cleanup
    vrfStartTimeRef.current = null;
    if (vrfTimerRef.current) {
      clearInterval(vrfTimerRef.current);
      vrfTimerRef.current = null;
    }
    resetGame();
    onClose();
  };

  // Skip all modals: mark all as shown in database, then clear local state
  const handleSkipAll = useCallback(async () => {
    // Collect all games to mark as shown (current + queued)
    const gamesToMark: Array<{ gameId: string; type: 'matched' | 'resolved' | 'expired' }> = [];

    // Add current modal game
    if (game && modalType) {
      gamesToMark.push({ gameId: game.id, type: modalType });
    }

    // Add all queued games
    for (const entry of modalQueue) {
      gamesToMark.push({ gameId: entry.game.id, type: entry.type });
    }

    // Mark all as shown in database first
    if (gamesToMark.length > 0) {
      await markMultipleModalsShown(gamesToMark);
    }

    // Then clear local state
    skipAllModals();
    onClose();
  }, [game, modalType, modalQueue, markMultipleModalsShown, skipAllModals, onClose]);

  // Quick re-bet: same tier and choice, navigate to play page
  // Settings are already saved to DB in playResultEffects via saveLastGameSettings
  const handleQuickRebet = () => {
    handleClose();
    router.push('/play?quickRebet=true');
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!game) return null;

  const result = game.coin_result ?? false; // false = heads, true = tails

  return (
    <>
      {/* Confetti on win */}
      <Confetti show={showConfetti} duration={5000} onComplete={() => setShowConfetti(false)} />

      <Dialog.Root open={open} onOpenChange={(_isOpen) => { /* Prevent auto-close on outside click/Escape - only close via explicit buttons */ }}>
      <Dialog.Content
        maxWidth="600px"
        style={{
          background: 'rgba(5,8,22,0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
        }}
        className="max-h-[90vh] overflow-y-auto fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100vw-2rem)] sm:w-auto"
        aria-describedby={undefined}
      >
        <Dialog.Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <h2 style={{ fontSize: 'clamp(18px,4vw,28px)', fontWeight: 700, textAlign: 'center' }} className="text-gradient-rainbow">
              {modalType === 'expired' && 'Game Expired'}
              {modalType !== 'expired' && game.status === 'matched' && !vrfTimedOut && 'Game Matched!'}
              {modalType !== 'expired' && game.status === 'matched' && vrfTimedOut && 'VRF Delayed'}
              {modalType !== 'expired' && game.status === 'resolved' && !validation.valid && !showResult && 'Finalizing...'}
              {modalType !== 'expired' && game.status === 'resolved' && validation.valid && !showResult && 'Flipping...'}
              {modalType !== 'expired' && game.status === 'resolved' && showResult && (isWinner ? 'You Won!' : 'Better Luck Next Time')}
              {modalType !== 'expired' && game.status === 'cancelled' && 'Game Cancelled'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CopyableGameId gameId={game.id} size={{ initial: '1', sm: '2' }} />
              {/* Queue indicator - shows when more games are waiting */}
              {modalQueue.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '999px',
                      background: 'rgba(168,85,247,0.2)',
                      border: '1px solid rgba(168,85,247,0.4)',
                    }}
                  >
                    <Layers style={{ width: '12px', height: '12px', color: '#c4b5fd' }} />
                    <span style={{ fontSize: '11px', color: '#c4b5fd', fontWeight: 500 }}>
                      +{modalQueue.length} more
                    </span>
                  </div>
                  <button
                    onClick={handleSkipAll}
                    style={{
                      padding: '3px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.4)',
                      borderRadius: '6px',
                      color: '#fca5a5',
                      cursor: 'pointer',
                    }}
                  >
                    Skip All
                  </button>
                </div>
              )}
            </div>
          </div>
        </Dialog.Title>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
          {/* Game Status: Matched - Waiting for VRF */}
          {game.status === 'matched' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', paddingTop: '24px', paddingBottom: '24px' }}>
              {!vrfTimedOut ? (
                <>
                  <Loader2 className="w-16 h-16 sm:w-20 sm:h-20 text-cyan-400 animate-spin glow-cyan" />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', padding: '0 8px' }}>
                    <h3 style={{ fontSize: 'clamp(16px,3vw,20px)', fontWeight: 700, textAlign: 'center' }} className="text-gradient-cyan-purple">
                      {vrfElapsedSeconds < 5 && 'Sending VRF Request...'}
                      {vrfElapsedSeconds >= 5 && vrfElapsedSeconds < 15 && 'Awaiting Block Confirmations...'}
                      {vrfElapsedSeconds >= 15 && vrfElapsedSeconds < 25 && 'VRF Nodes Processing...'}
                      {vrfElapsedSeconds >= 25 && vrfElapsedSeconds < 45 && 'Generating Random Number...'}
                      {vrfElapsedSeconds >= 45 && vrfElapsedSeconds < 90 && 'Finalizing Result...'}
                      {vrfElapsedSeconds >= 90 && 'Network Congestion Detected'}
                    </h3>
                    <p style={{ fontSize: 'clamp(12px,2vw,14px)', color: 'rgba(156,163,175,1)', textAlign: 'center' }}>
                      {vrfElapsedSeconds < 5 && 'Transaction submitted to Chainlink VRF'}
                      {vrfElapsedSeconds >= 5 && vrfElapsedSeconds < 15 && 'Waiting for 3 block confirmations'}
                      {vrfElapsedSeconds >= 15 && vrfElapsedSeconds < 25 && 'Decentralized oracle network at work'}
                      {vrfElapsedSeconds >= 25 && vrfElapsedSeconds < 45 && 'Cryptographically secure randomness'}
                      {vrfElapsedSeconds >= 45 && vrfElapsedSeconds < 90 && 'Almost there, please wait...'}
                      {vrfElapsedSeconds >= 90 && 'High network activity - result incoming'}
                    </p>
                  </div>

                  {/* VRF Progress Steps */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '320px' }}>
                    {/* Step indicators */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, background: vrfElapsedSeconds >= 0 ? '#06b6d4' : '#4b5563', color: vrfElapsedSeconds >= 0 ? '#fff' : '#9ca3af' }}>
                          {vrfElapsedSeconds >= 5 ? '✓' : '1'}
                        </div>
                        <span style={{ fontSize: '10px', color: vrfElapsedSeconds >= 0 ? '#67e8f9' : 'rgba(156,163,175,1)' }}>Request</span>
                      </div>
                      <div style={{ flex: 1, height: '2px', margin: '0 4px', background: vrfElapsedSeconds >= 5 ? '#06b6d4' : '#4b5563' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, background: vrfElapsedSeconds >= 5 ? '#06b6d4' : '#4b5563', color: vrfElapsedSeconds >= 5 ? '#fff' : '#9ca3af' }}>
                          {vrfElapsedSeconds >= 15 ? '✓' : '2'}
                        </div>
                        <span style={{ fontSize: '10px', color: vrfElapsedSeconds >= 5 ? '#67e8f9' : 'rgba(156,163,175,1)' }}>Confirm</span>
                      </div>
                      <div style={{ flex: 1, height: '2px', margin: '0 4px', background: vrfElapsedSeconds >= 15 ? '#06b6d4' : '#4b5563' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, background: vrfElapsedSeconds >= 15 ? '#06b6d4' : '#4b5563', color: vrfElapsedSeconds >= 15 ? '#fff' : '#9ca3af' }}>
                          {vrfElapsedSeconds >= 25 ? '✓' : '3'}
                        </div>
                        <span style={{ fontSize: '10px', color: vrfElapsedSeconds >= 15 ? '#67e8f9' : 'rgba(156,163,175,1)' }}>Generate</span>
                      </div>
                      <div style={{ flex: 1, height: '2px', margin: '0 4px', background: vrfElapsedSeconds >= 25 ? '#06b6d4' : '#4b5563' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, background: vrfElapsedSeconds >= 25 ? '#06b6d4' : '#4b5563', color: vrfElapsedSeconds >= 25 ? '#fff' : '#9ca3af' }} className={vrfElapsedSeconds >= 25 ? 'animate-pulse' : ''}>
                          4
                        </div>
                        <span style={{ fontSize: '10px', color: vrfElapsedSeconds >= 25 ? '#67e8f9' : 'rgba(156,163,175,1)' }}>Result</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <Progress
                      value={Math.min(vrfElapsedSeconds, typicalVrfSeconds)}
                      max={typicalVrfSeconds}
                      size="2"
                      color={vrfElapsedSeconds > typicalVrfSeconds * 1.5 ? 'amber' : 'cyan'}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#67e8f9' }}>
                        <Clock style={{ width: '12px', height: '12px' }} />
                        <span style={{ fontSize: '11px', fontWeight: 700 }}>{formatTime(vrfElapsedSeconds)}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: vrfElapsedSeconds > typicalVrfSeconds ? '#fbbf24' : 'rgba(156,163,175,1)' }}>
                        {vrfElapsedSeconds <= typicalVrfSeconds
                          ? `Typical: ~${typicalVrfSeconds}s`
                          : `+${vrfElapsedSeconds - typicalVrfSeconds}s over typical`}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-20 h-20 text-yellow-400 animate-pulse" />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24' }}>
                      VRF Response Delayed
                    </h3>
                    <p style={{ fontSize: '14px', color: 'rgba(156,163,175,1)', textAlign: 'center' }}>
                      The random number request is taking longer than expected.
                      This can happen during network congestion.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24' }}>
                    <Clock style={{ width: '16px', height: '16px' }} />
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>{formatTime(vrfElapsedSeconds)}</span>
                  </div>

                  <div style={{
                    width: '100%',
                    background: 'rgba(234,179,8,0.1)',
                    border: '1px solid rgba(234,179,8,0.3)',
                    borderRadius: '12px',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
                      <p style={{ fontSize: '12px', color: '#fbbf24' }}>
                        Please wait. The result will appear automatically when VRF responds.
                        You can safely close this modal - the game will complete on-chain.
                      </p>
                    </div>
                  </div>

                  {/* Manual refresh button */}
                  <button
                    onClick={() => refetchGame()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 20px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: 'rgba(209,213,219,1)',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                    className="touch-target"
                  >
                    <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" />
                    Check Status
                  </button>
                </>
              )}

              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '16px',
                width: '100%',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users style={{ width: '16px', height: '16px', color: '#67e8f9' }} />
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>Players</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>
                        Creator: {game.creator_choice === true ? '🪙 Tails' : game.creator_choice === false ? '👑 Heads' : '...'}
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280' }}>
                        {game.creator_address?.slice(0, 6)}...{game.creator_address?.slice(-4)}
                        {isCreator && ' (You)'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>
                        Joiner: {game.joiner_choice === true ? '🪙 Tails' : game.joiner_choice === false ? '👑 Heads' : '...'}
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6b7280' }}>
                        {game.joiner_address?.slice(0, 6)}...{game.joiner_address?.slice(-4)}
                        {isJoiner && ' (You)'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(51,65,85,0.5)' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>Total Pot:</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#86efac' }}>
                      {formatCurrency(BigInt(game.amount) * 2n)}
                    </span>
                  </div>
                </div>
              </div>

              {!vrfTimedOut && (
                <p style={{ fontSize: '11px', color: 'rgba(156,163,175,1)', textAlign: 'center', maxWidth: '400px' }}>
                  Typically completes within ~{typicalVrfSeconds} seconds. The result is cryptographically secure and cannot be manipulated.
                </p>
              )}
            </div>
          )}

          {/* Game Status: Resolved but waiting for complete data - Show loading */}
          {game.status === 'resolved' && !validation.valid && !showResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', paddingTop: '24px', paddingBottom: '24px' }}>
              {!dataRetryExhausted ? (
                <>
                  <Loader2 className="w-20 h-20 text-green-400 animate-spin glow-cyan" />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 700 }} className="text-gradient-cyan-purple">
                      Finalizing Result...
                    </h3>
                    <p style={{ fontSize: '14px', color: 'rgba(156,163,175,1)', textAlign: 'center' }}>
                      Syncing game data from blockchain
                    </p>
                  </div>

                  {/* Retry progress indicator */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', width: '100%', maxWidth: '320px' }}>
                    <Progress
                      value={currentRetryCount}
                      max={MAX_DATA_RETRIES}
                      size="1"
                      color="green"
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 4px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(156,163,175,1)' }}>
                        {currentRetryCount > 0 ? `Syncing... attempt ${currentRetryCount}/${MAX_DATA_RETRIES}` : 'Starting sync...'}
                      </span>
                      <span style={{ fontSize: '11px', color: currentRetryCount > 5 ? '#fbbf24' : 'rgba(156,163,175,1)' }}>
                        {currentRetryCount <= 3 && 'Normal'}
                        {currentRetryCount > 3 && currentRetryCount <= 6 && 'Slower than usual'}
                        {currentRetryCount > 6 && 'Almost there...'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-20 h-20 text-yellow-400" />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24' }}>
                      Data Sync Issue
                    </h3>
                    <p style={{ fontSize: '14px', color: 'rgba(156,163,175,1)', textAlign: 'center' }}>
                      Unable to fetch complete game data. The game has resolved on-chain.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      retryCountRef.current = 0;
                      setDataRetryExhausted(false);
                      refetchGame();
                    }}
                    style={{
                      padding: '10px 24px',
                      fontSize: '14px',
                      fontWeight: 600,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: 'rgba(209,213,219,1)',
                      cursor: 'pointer',
                    }}
                    className="glow-cyan"
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          )}

          {/* Game Status: Resolved - Show Animation */}
          {game.status === 'resolved' && validation.valid && !showResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Coin Animation */}
              <div className="relative">
                {skipped ? (
                  <div
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '320px', background: 'linear-gradient(to bottom, rgba(15,23,42,1), rgba(2,6,23,1))', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '8px' }}
                  >
                    <div style={{ fontSize: 'clamp(48px,8vw,64px)', marginBottom: '16px' }}>
                      {result ? '🪙' : '👑'}
                    </div>
                    <span style={{ fontSize: 'clamp(14px,3vw,18px)', fontWeight: 700 }}>
                      {result ? 'Tails' : 'Heads'}
                    </span>
                  </div>
                ) : (
                  <CoinFlip2D
                    isFlipping={isFlipping}
                    result={result}
                    onFlipComplete={handleFlipComplete}
                  />
                )}
              </div>

              {/* Skip Button */}
              {!skipped && isFlipping && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleSkip(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        color: 'rgba(209,213,219,1)',
                        cursor: 'pointer',
                      }}
                      className="glow-cyan hover:scale-105 transition-transform"
                    >
                      <Zap style={{ width: '16px', height: '16px' }} />
                      Skip
                    </button>
                    <button
                      onClick={() => handleSkip(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        background: 'rgba(124,58,237,0.15)',
                        border: '1px solid rgba(124,58,237,0.4)',
                        borderRadius: '10px',
                        color: '#c4b5fd',
                        cursor: 'pointer',
                      }}
                      className="hover:scale-105 transition-transform"
                    >
                      <Zap style={{ width: '16px', height: '16px' }} />
                      Always Skip
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(156,163,175,1)' }}>
                    {alwaysSkipAnimation ? 'Animation will be skipped automatically' : 'Click "Always Skip" to remember'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Game Status: Resolved - Show Result */}
          {game.status === 'resolved' && showResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
              {/* Result Display */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  width: '100%',
                  paddingTop: '24px',
                  paddingBottom: '24px',
                  background: 'linear-gradient(to bottom, rgba(15,23,42,0.5), rgba(2,6,23,0.5))',
                  borderRadius: '8px',
                  border: isWinner ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(239,68,68,0.2)',
                }}
                className={isWinner ? 'animate-win-glow animate-win-entrance' : 'animate-lose-entrance'}
              >
                <div style={{ fontSize: 'clamp(48px,8vw,64px)' }} className={isWinner ? 'animate-result-emoji' : 'animate-defeat-fade'}>
                  {result ? '🪙' : '👑'}
                </div>
                <h3 style={{ fontSize: 'clamp(18px,4vw,22px)', fontWeight: 700 }} className={isWinner ? 'animate-victory-shimmer' : 'text-gray-400'}>
                  Result: {result ? 'Tails' : 'Heads'}
                </h3>
              </div>

              {/* Winner Card */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: isWinner ? '1px solid rgba(34,197,94,0.6)' : '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '16px',
                  width: '100%',
                }}
                className={isWinner ? 'animate-win-glow' : 'animate-lose-entrance'}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trophy style={{ width: '20px', height: '20px' }} className={isWinner ? 'text-green-400 animate-trophy-bounce' : 'text-gray-500'} />
                    <h4 style={{ fontSize: '18px', fontWeight: 700 }} className={isWinner ? 'animate-victory-shimmer' : 'text-gray-400'}>
                      {isWinner ? 'Victory!' : 'Defeat'}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>Winner:</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#86efac' }}>
                        {game.winner_address?.slice(0, 6)}...{game.winner_address?.slice(-4)}
                        {isWinner && ' (You)'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>Winning Choice:</span>
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>
                        {result ? '🪙 Tails' : '👑 Heads'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>Payout:</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#86efac' }}>
                        {formatCurrency(BigInt(game.payout || 0))}
                      </span>
                    </div>
                  </div>

                  {isWinner && (
                    <div style={{
                      background: 'rgba(34,197,94,0.1)',
                      borderRadius: '8px',
                      padding: '12px',
                      border: '1px solid rgba(34,197,94,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '12px', color: '#86efac' }}>
                        Payout has been sent to your wallet
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', width: '100%', flexWrap: 'wrap' }}>
                <button
                  onClick={handleClose}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    color: 'rgba(209,213,219,1)',
                    cursor: 'pointer',
                    minWidth: '120px',
                  }}
                  className="touch-target"
                >
                  Close
                </button>
                <button
                  onClick={handleQuickRebet}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    cursor: 'pointer',
                    minWidth: '120px',
                  }}
                  className={`hover:scale-105 transition-transform touch-target ${isWinner ? 'glow-resolved' : 'glow-cyan'}`}
                >
                  <Zap style={{ width: '16px', height: '16px' }} />
                  {isWinner ? 'Play Again & Win More!' : 'Try Again - Same Bet'}
                </button>
              </div>

              {/* Animation preference toggle */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={toggleSkipPreference}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  className="hover:bg-slate-700/50"
                >
                  <div style={{ width: '32px', height: '16px', borderRadius: '999px', background: alwaysSkipAnimation ? '#8b5cf6' : '#4b5563', transition: 'background 0.2s', position: 'relative' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: alwaysSkipAnimation ? '18px' : '2px', transition: 'left 0.2s' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(156,163,175,1)' }}>
                    {alwaysSkipAnimation ? 'Skip animation: ON' : 'Skip animation: OFF'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Game Expired - User needs to manually cancel for refund */}
          {modalType === 'expired' && game.status === 'pending' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', paddingTop: '24px', paddingBottom: '24px' }}>
              {cancelStatus === 'success' ? (
                <>
                  <XCircle className="w-20 h-20 text-green-400" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#86efac' }}>
                      Game Cancelled
                    </h3>
                    <p style={{ fontSize: '14px', color: 'rgba(156,163,175,1)', textAlign: 'center' }}>
                      Your bet of {formatCurrency(BigInt(game.amount))} has been refunded to your wallet.
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    style={{
                      width: '100%',
                      padding: '12px 24px',
                      fontSize: '14px',
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                    className="glow-cyan hover:scale-105 transition-transform"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <Clock className="w-20 h-20 text-yellow-400 animate-pulse" />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24' }}>
                      No Opponent Found
                    </h3>
                    <p style={{ fontSize: '14px', color: 'rgba(156,163,175,1)', textAlign: 'center' }}>
                      Your game has been waiting for {formatTime(expiredElapsedSeconds)} without being matched.
                    </p>
                  </div>

                  {/* Elapsed time indicator */}
                  <div style={{
                    width: '100%',
                    maxWidth: '320px',
                    background: 'rgba(234,179,8,0.05)',
                    border: '1px solid rgba(234,179,8,0.2)',
                    borderRadius: '16px',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(156,163,175,1)' }}>Time Waiting</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>
                          {formatTime(expiredElapsedSeconds)}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(expiredElapsedSeconds, 600)}
                        max={600}
                        size="1"
                        color="yellow"
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(156,163,175,1)' }}>5m expiry</span>
                        <span style={{ fontSize: '11px', color: expiredElapsedSeconds > 300 ? '#fbbf24' : '#6b7280' }}>
                          {expiredElapsedSeconds > 300 ? `+${formatTime(expiredElapsedSeconds - 300)} over` : 'Not yet'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '16px',
                    width: '100%',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>Game ID:</span>
                        <CopyableGameId gameId={game.id} size="2" showLabel={false} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>Your Bet:</span>
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>{formatCurrency(BigInt(game.amount))}</span>
                      </div>

                      {cancelStatus === 'error' && (
                        <div style={{
                          background: 'rgba(239,68,68,0.1)',
                          borderRadius: '8px',
                          padding: '12px',
                          border: '1px solid rgba(239,68,68,0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}>
                          <span style={{ fontSize: '12px', color: '#fca5a5', fontWeight: 700 }}>
                            Cancel Failed
                          </span>
                          <span style={{ fontSize: '12px', color: '#fecaca' }}>
                            {cancelError?.message || 'Unable to cancel. Please try again.'}
                          </span>
                        </div>
                      )}

                      {cancelStatus !== 'error' && (
                        <div style={{
                          background: 'rgba(34,197,94,0.1)',
                          borderRadius: '8px',
                          padding: '12px',
                          border: '1px solid rgba(34,197,94,0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}>
                          <span style={{ fontSize: '12px', color: '#86efac', fontWeight: 700 }}>
                            Get Your Instant Refund
                          </span>
                          <span style={{ fontSize: '12px', color: '#bbf7d0' }}>
                            Cancel now to receive your {formatCurrency(BigInt(game.amount))} back immediately.
                          </span>
                        </div>
                      )}

                      {/* Chainlink auto-cancel info */}
                      <div style={{
                        background: 'rgba(6,182,212,0.1)',
                        borderRadius: '8px',
                        padding: '12px',
                        border: '1px solid rgba(6,182,212,0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}>
                        <span style={{ fontSize: '11px', color: '#67e8f9', fontWeight: 700 }}>
                          Chainlink Automation Active
                        </span>
                        <span style={{ fontSize: '11px', color: '#a5f3fc' }}>
                          If you don&apos;t cancel manually, Chainlink will auto-cancel and refund you. This may take a few more minutes depending on network activity.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                    <button
                      onClick={handleClose}
                      disabled={cancelStatus === 'cancelling'}
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        color: 'rgba(209,213,219,1)',
                        cursor: cancelStatus === 'cancelling' ? 'not-allowed' : 'pointer',
                        opacity: cancelStatus === 'cancelling' ? 0.5 : 1,
                      }}
                    >
                      Keep Waiting
                    </button>
                    <button
                      onClick={handleCancelGame}
                      disabled={cancelStatus === 'cancelling'}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                        border: 'none',
                        borderRadius: '10px',
                        color: '#fff',
                        cursor: cancelStatus === 'cancelling' ? 'not-allowed' : 'pointer',
                        opacity: cancelStatus === 'cancelling' ? 0.8 : 1,
                      }}
                      className="glow-cyan hover:scale-105 transition-transform"
                    >
                      {cancelStatus === 'cancelling' ? (
                        <>
                          <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" />
                          Confirming...
                        </>
                      ) : cancelStatus === 'error' ? (
                        'Try Again'
                      ) : (
                        'Cancel & Get Refund'
                      )}
                    </button>
                  </div>

                  <p style={{ fontSize: '11px', color: 'rgba(156,163,175,1)', textAlign: 'center' }}>
                    Someone could still join your game. Cancel anytime for instant refund.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Game Status: Cancelled (already cancelled on-chain) */}
          {modalType !== 'expired' && game.status === 'cancelled' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', paddingTop: '24px', paddingBottom: '24px' }}>
              <XCircle className="w-20 h-20 text-green-400" />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#86efac' }}>
                  Game Cancelled
                </h3>
                <p style={{ fontSize: '14px', color: 'rgba(156,163,175,1)', textAlign: 'center' }}>
                  Your bet has been refunded to your wallet.
                </p>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '16px',
                width: '100%',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>Game ID:</span>
                    <CopyableGameId gameId={game.id} size="2" showLabel={false} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>Refund Amount:</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#86efac' }}>{formatCurrency(BigInt(game.amount))}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleClose}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  cursor: 'pointer',
                }}
                className="glow-cyan hover:scale-105 transition-transform"
              >
                Close
              </button>
            </div>
          )}

          {/* Not a participant warning */}
          {!isParticipant && game.status !== 'cancelled' && (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
            }}>
              <div style={{ display: 'flex', padding: '16px', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>
                  You are viewing this game as a spectator
                </span>
              </div>
            </div>
          )}
        </div>
      </Dialog.Content>
    </Dialog.Root>
    </>
  );
}
