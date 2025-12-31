'use client';

import { Dialog, Flex, Heading, Text, Button, Card, Progress } from '@radix-ui/themes';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { CoinFlip2D } from './CoinFlip2D';
import { Confetti } from '@/components/effects/Confetti';
import { Game } from '@/types/game';
import { formatCurrency, formatGameId, devLog } from '@/lib/utils';
import { CopyableGameId } from '@/components/ui/CopyableGameId';
import { invalidateGameQueries, removeGameFromPendingCache } from '@/lib/queryUtils';
import { Loader2, Users, Trophy, Zap, AlertTriangle, Clock, XCircle, Layers } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { validateGameState } from '@/hooks/useGameSync';
import { useGame } from '@/hooks/useGames';
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
// Game expiry time (5 minutes) - after this, Chainlink Automation will auto-cancel
const GAME_EXPIRY_MS = 5 * 60 * 1000;

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
  const { resetGame, updateActiveGame, removeActiveGame, startCancellingGame, finishCancellingGame, modalQueue, setupQuickRebet } = useGameStore();

  // User preferences from database (skip animation, last game settings)
  const { skipAnimation: alwaysSkipAnimation, setSkipAnimation, saveLastGameSettings } = useUserPreferences();

  // Use refs to prevent duplicate sounds/toasts (more reliable than state)
  const hasPlayedMatchSoundRef = useRef(false);
  const hasPlayedResultSoundRef = useRef(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  // Cancel game hook
  const { cancelGame, isLoading: isCancelling, isSuccess: cancelSuccess, error: cancelError, reset: resetCancel } = useCancelGame();

  // Notification state for tracking sounds in database
  const { shouldPlaySound, markSoundPlayed } = useNotificationState();

  // Fetch fresh game data for auto-refetch on validation errors
  const { data: freshGame, refetch: refetchGame } = useGame(game?.id ?? null);

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
      return;
    }

    const isNewGame = lastGameIdRef.current !== game.id;
    const statusChanged = lastGameStatusRef.current !== game.status;

    // Track game ID and status
    lastGameIdRef.current = game.id;
    lastGameStatusRef.current = game.status;

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
    }

    // Handle status transitions
    if (game.status === 'matched') {
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
    if (game.status === 'resolved' && validation.valid && statusChanged) {
      // Stop VRF timer
      vrfStartTimeRef.current = null;
      if (vrfTimerRef.current) {
        clearInterval(vrfTimerRef.current);
        vrfTimerRef.current = null;
      }

      // Check if user prefers to skip animation (from DB-backed preferences)
      if (alwaysSkipAnimation) {
        // Skip directly to result
        setSkipped(true);
        setShowResult(true);
        setIsFlipping(false);
      } else {
        // Start flip animation
        setIsFlipping(true);
      }
      setVrfTimedOut(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally using specific game fields to prevent re-renders
  }, [game?.id, game?.status, game?.matched_at, validation.valid, alwaysSkipAnimation]);

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
      // Complete the cancellation in store
      if (game?.id) {
        finishCancellingGame(game.id, true);
        removeActiveGame(game.id);

        // Immediately invalidate all game queries to update the UI everywhere
        invalidateGameQueries(queryClient, game.id);

        // Also remove from pending games cache immediately (optimistic)
        removeGameFromPendingCache(queryClient, game.id);
      }
    } else if (cancelError) {
      setCancelStatus('error');
      // Cancel failed, revert optimistic update
      if (game?.id) {
        finishCancellingGame(game.id, false);
      }
    } else if (isCancelling) {
      setCancelStatus('cancelling');
    }
  }, [cancelSuccess, cancelError, isCancelling, game?.id, removeActiveGame, finishCancellingGame, queryClient]);

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
    // Start optimistic update
    startCancellingGame(game.id);
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

  // Quick re-bet: same tier and choice, navigate to play page
  const handleQuickRebet = () => {
    setupQuickRebet();
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

      <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Content
        maxWidth="600px"
        className="backdrop-blur-xl bg-slate-900/95 border-2 border-cyan-500/30 max-h-[90vh] overflow-y-auto fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100vw-2rem)] sm:w-auto"
        aria-describedby={undefined}
      >
        <Dialog.Title>
          <Flex direction="column" gap="2" align="center">
            <Heading size={{ initial: '5', sm: '7' }} className="text-gradient-rainbow text-center">
              {modalType === 'expired' && 'Game Expired'}
              {modalType !== 'expired' && game.status === 'matched' && !vrfTimedOut && 'Game Matched!'}
              {modalType !== 'expired' && game.status === 'matched' && vrfTimedOut && 'VRF Delayed'}
              {modalType !== 'expired' && game.status === 'resolved' && !validation.valid && !showResult && 'Finalizing...'}
              {modalType !== 'expired' && game.status === 'resolved' && validation.valid && !showResult && 'Flipping...'}
              {modalType !== 'expired' && game.status === 'resolved' && showResult && (isWinner ? 'You Won!' : 'Better Luck Next Time')}
              {modalType !== 'expired' && game.status === 'cancelled' && 'Game Cancelled'}
            </Heading>
            <Flex align="center" gap="2">
              <CopyableGameId gameId={game.id} size={{ initial: '1', sm: '2' }} />
              {/* Queue indicator - shows when more games are waiting */}
              {modalQueue.length > 0 && (
                <Flex
                  align="center"
                  gap="1"
                  className="px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/40"
                >
                  <Layers className="w-3 h-3 text-purple-400" />
                  <Text size="1" className="text-purple-400" weight="medium">
                    +{modalQueue.length} more
                  </Text>
                </Flex>
              )}
            </Flex>
          </Flex>
        </Dialog.Title>

        <Flex direction="column" gap="6" mt="4">
          {/* Game Status: Matched - Waiting for VRF */}
          {game.status === 'matched' && (
            <Flex direction="column" gap={{ initial: '4', sm: '5' }} align="center" py={{ initial: '4', sm: '6' }}>
              {!vrfTimedOut ? (
                <>
                  <Loader2 className="w-16 h-16 sm:w-20 sm:h-20 text-cyan-400 animate-spin glow-cyan" />

                  <Flex direction="column" gap="2" align="center" className="px-2">
                    <Heading size={{ initial: '4', sm: '5' }} className="text-gradient-cyan-purple text-center">
                      {vrfElapsedSeconds < 5 && 'Sending VRF Request...'}
                      {vrfElapsedSeconds >= 5 && vrfElapsedSeconds < 15 && 'Awaiting Block Confirmations...'}
                      {vrfElapsedSeconds >= 15 && vrfElapsedSeconds < 25 && 'VRF Nodes Processing...'}
                      {vrfElapsedSeconds >= 25 && vrfElapsedSeconds < 45 && 'Generating Random Number...'}
                      {vrfElapsedSeconds >= 45 && vrfElapsedSeconds < 90 && 'Finalizing Result...'}
                      {vrfElapsedSeconds >= 90 && 'Network Congestion Detected'}
                    </Heading>
                    <Text size={{ initial: '2', sm: '3' }} color="gray" align="center">
                      {vrfElapsedSeconds < 5 && 'Transaction submitted to Chainlink VRF'}
                      {vrfElapsedSeconds >= 5 && vrfElapsedSeconds < 15 && 'Waiting for 3 block confirmations'}
                      {vrfElapsedSeconds >= 15 && vrfElapsedSeconds < 25 && 'Decentralized oracle network at work'}
                      {vrfElapsedSeconds >= 25 && vrfElapsedSeconds < 45 && 'Cryptographically secure randomness'}
                      {vrfElapsedSeconds >= 45 && vrfElapsedSeconds < 90 && 'Almost there, please wait...'}
                      {vrfElapsedSeconds >= 90 && 'High network activity - result incoming'}
                    </Text>
                  </Flex>

                  {/* VRF Progress Steps */}
                  <Flex direction="column" gap="3" className="w-full max-w-xs">
                    {/* Step indicators */}
                    <Flex justify="between" align="center" className="px-1">
                      <Flex direction="column" align="center" gap="1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${vrfElapsedSeconds >= 0 ? 'bg-cyan-500 text-white' : 'bg-gray-600 text-gray-400'}`}>
                          {vrfElapsedSeconds >= 5 ? '✓' : '1'}
                        </div>
                        <Text size="1" color={vrfElapsedSeconds >= 0 ? 'cyan' : 'gray'}>Request</Text>
                      </Flex>
                      <div className={`flex-1 h-0.5 mx-1 ${vrfElapsedSeconds >= 5 ? 'bg-cyan-500' : 'bg-gray-600'}`} />
                      <Flex direction="column" align="center" gap="1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${vrfElapsedSeconds >= 5 ? 'bg-cyan-500 text-white' : 'bg-gray-600 text-gray-400'}`}>
                          {vrfElapsedSeconds >= 15 ? '✓' : '2'}
                        </div>
                        <Text size="1" color={vrfElapsedSeconds >= 5 ? 'cyan' : 'gray'}>Confirm</Text>
                      </Flex>
                      <div className={`flex-1 h-0.5 mx-1 ${vrfElapsedSeconds >= 15 ? 'bg-cyan-500' : 'bg-gray-600'}`} />
                      <Flex direction="column" align="center" gap="1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${vrfElapsedSeconds >= 15 ? 'bg-cyan-500 text-white' : 'bg-gray-600 text-gray-400'}`}>
                          {vrfElapsedSeconds >= 25 ? '✓' : '3'}
                        </div>
                        <Text size="1" color={vrfElapsedSeconds >= 15 ? 'cyan' : 'gray'}>Generate</Text>
                      </Flex>
                      <div className={`flex-1 h-0.5 mx-1 ${vrfElapsedSeconds >= 25 ? 'bg-cyan-500' : 'bg-gray-600'}`} />
                      <Flex direction="column" align="center" gap="1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${vrfElapsedSeconds >= 25 ? 'bg-cyan-500 text-white animate-pulse' : 'bg-gray-600 text-gray-400'}`}>
                          4
                        </div>
                        <Text size="1" color={vrfElapsedSeconds >= 25 ? 'cyan' : 'gray'}>Result</Text>
                      </Flex>
                    </Flex>

                    {/* Progress bar */}
                    <Progress
                      value={Math.min(vrfElapsedSeconds, 30)}
                      max={30}
                      size="2"
                      color={vrfElapsedSeconds > 45 ? 'amber' : 'cyan'}
                    />
                    <Flex justify="between" align="center">
                      <Flex align="center" gap="1" className="text-cyan-400">
                        <Clock className="w-3 h-3" />
                        <Text size="1" weight="bold">{formatTime(vrfElapsedSeconds)}</Text>
                      </Flex>
                      <Text size="1" color={vrfElapsedSeconds > 30 ? 'amber' : 'gray'}>
                        {vrfElapsedSeconds <= 30 ? 'Typical: 15-30s' : `+${vrfElapsedSeconds - 30}s over typical`}
                      </Text>
                    </Flex>
                  </Flex>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-20 h-20 text-yellow-400 animate-pulse" />

                  <Flex direction="column" gap="2" align="center">
                    <Heading size="5" className="text-yellow-400">
                      VRF Response Delayed
                    </Heading>
                    <Text size="3" color="gray" align="center">
                      The random number request is taking longer than expected.
                      This can happen during network congestion.
                    </Text>
                  </Flex>

                  <Flex align="center" gap="2" className="text-yellow-400">
                    <Clock className="w-4 h-4" />
                    <Text size="2" weight="bold">{formatTime(vrfElapsedSeconds)}</Text>
                  </Flex>

                  <Card className="w-full bg-yellow-500/10 border border-yellow-500/30">
                    <Flex direction="column" gap="2" p="3">
                      <Text size="2" className="text-yellow-400">
                        Please wait. The result will appear automatically when VRF responds.
                        You can safely close this modal - the game will complete on-chain.
                      </Text>
                    </Flex>
                  </Card>

                  {/* Manual refresh button */}
                  <Button
                    size="2"
                    variant="soft"
                    onClick={() => refetchGame()}
                    className="touch-target"
                  >
                    <Loader2 className="w-4 h-4" />
                    Check Status
                  </Button>
                </>
              )}

              <Card className="card-simple w-full">
                <Flex direction="column" gap="3" p="4">
                  <Flex justify="between" align="center">
                    <Flex align="center" gap="2">
                      <Users className="w-4 h-4 text-cyan-400" />
                      <Text size="2" weight="bold">Players</Text>
                    </Flex>
                  </Flex>

                  <Flex direction="column" gap="2">
                    <Flex justify="between">
                      <Text size="2" color="gray">
                        Creator: {game.creator_choice === true ? '🪙 Tails' : game.creator_choice === false ? '👑 Heads' : '...'}
                      </Text>
                      <Text size="1" className="font-mono text-gray-500">
                        {game.creator_address?.slice(0, 6)}...{game.creator_address?.slice(-4)}
                        {isCreator && ' (You)'}
                      </Text>
                    </Flex>

                    <Flex justify="between">
                      <Text size="2" color="gray">
                        Joiner: {game.joiner_choice === true ? '🪙 Tails' : game.joiner_choice === false ? '👑 Heads' : '...'}
                      </Text>
                      <Text size="1" className="font-mono text-gray-500">
                        {game.joiner_address?.slice(0, 6)}...{game.joiner_address?.slice(-4)}
                        {isJoiner && ' (You)'}
                      </Text>
                    </Flex>
                  </Flex>

                  <Flex justify="between" pt="2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Text size="2" weight="bold">Total Pot:</Text>
                    <Text size="2" weight="bold" className="text-green-400">
                      {formatCurrency(BigInt(game.amount) * 2n)}
                    </Text>
                  </Flex>
                </Flex>
              </Card>

              {!vrfTimedOut && (
                <Text size="1" color="gray" align="center" style={{ maxWidth: '400px' }}>
                  Typically completes within 30 seconds. The result is cryptographically secure and cannot be manipulated.
                </Text>
              )}
            </Flex>
          )}

          {/* Game Status: Resolved but waiting for complete data - Show loading */}
          {game.status === 'resolved' && !validation.valid && !showResult && (
            <Flex direction="column" gap="5" align="center" py="6">
              {!dataRetryExhausted ? (
                <>
                  <Loader2 className="w-20 h-20 text-green-400 animate-spin glow-cyan" />

                  <Flex direction="column" gap="2" align="center">
                    <Heading size="5" className="text-gradient-cyan-purple">
                      Finalizing Result...
                    </Heading>
                    <Text size="3" color="gray" align="center">
                      Syncing game data from blockchain
                    </Text>
                  </Flex>

                  {/* Retry progress indicator */}
                  <Flex direction="column" gap="2" align="center" className="w-full max-w-xs">
                    <Progress
                      value={currentRetryCount}
                      max={MAX_DATA_RETRIES}
                      size="1"
                      color="green"
                    />
                    <Flex justify="between" className="w-full px-1">
                      <Text size="1" color="gray">
                        {currentRetryCount > 0 ? `Syncing... attempt ${currentRetryCount}/${MAX_DATA_RETRIES}` : 'Starting sync...'}
                      </Text>
                      <Text size="1" color={currentRetryCount > 5 ? 'yellow' : 'gray'}>
                        {currentRetryCount <= 3 && 'Normal'}
                        {currentRetryCount > 3 && currentRetryCount <= 6 && 'Slower than usual'}
                        {currentRetryCount > 6 && 'Almost there...'}
                      </Text>
                    </Flex>
                  </Flex>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-20 h-20 text-yellow-400" />

                  <Flex direction="column" gap="2" align="center">
                    <Heading size="5" className="text-yellow-400">
                      Data Sync Issue
                    </Heading>
                    <Text size="3" color="gray" align="center">
                      Unable to fetch complete game data. The game has resolved on-chain.
                    </Text>
                  </Flex>

                  <Button
                    size="3"
                    variant="soft"
                    onClick={() => {
                      retryCountRef.current = 0;
                      setDataRetryExhausted(false);
                      refetchGame();
                    }}
                    className="glow-cyan"
                  >
                    Retry
                  </Button>
                </>
              )}
            </Flex>
          )}

          {/* Game Status: Resolved - Show Animation */}
          {game.status === 'resolved' && validation.valid && !showResult && (
            <Flex direction="column" gap="4">
              {/* Coin Animation */}
              <div className="relative">
                {skipped ? (
                  <Flex
                    direction="column"
                    align="center"
                    justify="center"
                    className="w-full h-64 sm:h-80 md:h-96 bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/20 rounded-lg"
                  >
                    <div className="text-6xl sm:text-7xl md:text-8xl mb-4">
                      {result ? '🪙' : '👑'}
                    </div>
                    <Text size="4" className="sm:text-lg md:text-xl" weight="bold">
                      {result ? 'Tails' : 'Heads'}
                    </Text>
                  </Flex>
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
                <Flex direction="column" gap="2" align="center">
                  <Flex gap="2">
                    <Button
                      size="3"
                      variant="soft"
                      onClick={() => handleSkip(false)}
                      className="glow-cyan hover:scale-105 transition-transform"
                    >
                      <Zap className="w-4 h-4" />
                      Skip
                    </Button>
                    <Button
                      size="3"
                      variant="soft"
                      color="purple"
                      onClick={() => handleSkip(true)}
                      className="hover:scale-105 transition-transform"
                    >
                      <Zap className="w-4 h-4" />
                      Always Skip
                    </Button>
                  </Flex>
                  <Text size="1" color="gray">
                    {alwaysSkipAnimation ? 'Animation will be skipped automatically' : 'Click "Always Skip" to remember'}
                  </Text>
                </Flex>
              )}
            </Flex>
          )}

          {/* Game Status: Resolved - Show Result */}
          {game.status === 'resolved' && showResult && (
            <Flex direction="column" gap={{ initial: '4', sm: '5' }} align="center">
              {/* Result Display */}
              <Flex
                direction="column"
                align="center"
                justify="center"
                gap={{ initial: '3', sm: '4' }}
                className={`w-full py-6 sm:py-8 bg-gradient-to-b from-slate-900/50 to-slate-950/50 rounded-lg border ${
                  isWinner ? 'border-green-500/40 animate-win-glow' : 'border-red-500/20'
                } ${isWinner ? 'animate-win-entrance' : 'animate-lose-entrance'}`}
              >
                <div className={`text-6xl sm:text-7xl md:text-8xl ${isWinner ? 'animate-result-emoji' : 'animate-defeat-fade'}`}>
                  {result ? '🪙' : '👑'}
                </div>
                <Heading size={{ initial: '5', sm: '6' }} className={isWinner ? 'animate-victory-shimmer' : 'text-gray-400'}>
                  Result: {result ? 'Tails' : 'Heads'}
                </Heading>
              </Flex>

              {/* Winner Card */}
              <Card className={`card-solid w-full ${isWinner ? 'border-green-500/60 animate-win-glow' : 'border-red-500/30 animate-lose-entrance'}`}>
                <Flex direction="column" gap={{ initial: '3', sm: '4' }} p={{ initial: '3', sm: '5' }}>
                  <Flex align="center" gap="2">
                    <Trophy className={`w-5 h-5 ${isWinner ? 'text-green-400 animate-trophy-bounce' : 'text-gray-500'}`} />
                    <Heading size="4" className={isWinner ? 'animate-victory-shimmer' : 'text-gray-400'}>
                      {isWinner ? 'Victory!' : 'Defeat'}
                    </Heading>
                  </Flex>

                  <Flex direction="column" gap="2">
                    <Flex justify="between">
                      <Text size="2" color="gray">Winner:</Text>
                      <Text size="2" weight="bold" className="text-green-400">
                        {game.winner_address?.slice(0, 6)}...{game.winner_address?.slice(-4)}
                        {isWinner && ' (You)'}
                      </Text>
                    </Flex>

                    <Flex justify="between">
                      <Text size="2" color="gray">Winning Choice:</Text>
                      <Text size="2" weight="bold">
                        {result ? '🪙 Tails' : '👑 Heads'}
                      </Text>
                    </Flex>

                    <Flex justify="between">
                      <Text size="2" color="gray">Payout:</Text>
                      <Text size="3" weight="bold" className="text-green-400">
                        {formatCurrency(BigInt(game.payout || 0))}
                      </Text>
                    </Flex>
                  </Flex>

                  {isWinner && (
                    <Flex
                      className="bg-green-500/10 rounded-lg p-3 border border-green-500/30"
                      align="center"
                      gap="2"
                    >
                      <Text size="2" className="text-green-400">
                        Payout has been sent to your wallet
                      </Text>
                    </Flex>
                  )}
                </Flex>
              </Card>

              {/* Action Buttons */}
              <Flex gap={{ initial: '2', sm: '3' }} className="w-full" direction={{ initial: 'column', sm: 'row' }}>
                <Button
                  size={{ initial: '2', sm: '3' }}
                  variant="soft"
                  onClick={handleClose}
                  className="flex-1 touch-target"
                >
                  Close
                </Button>
                <Button
                  size={{ initial: '2', sm: '3' }}
                  onClick={handleQuickRebet}
                  className={`flex-1 hover:scale-105 transition-transform touch-target ${isWinner ? 'glow-resolved bg-green-600 hover:bg-green-500' : 'glow-cyan'}`}
                >
                  <Zap className="w-4 h-4 mr-1" />
                  {isWinner ? 'Play Again & Win More!' : 'Try Again - Same Bet'}
                </Button>
              </Flex>

              {/* Animation preference toggle */}
              <Flex justify="center">
                <button
                  onClick={toggleSkipPreference}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-colors hover:bg-slate-700/50"
                >
                  <div className={`w-8 h-4 rounded-full transition-colors ${alwaysSkipAnimation ? 'bg-purple-500' : 'bg-slate-600'}`}>
                    <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${alwaysSkipAnimation ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`} />
                  </div>
                  <Text size="1" color="gray">
                    {alwaysSkipAnimation ? 'Skip animation: ON' : 'Skip animation: OFF'}
                  </Text>
                </button>
              </Flex>
            </Flex>
          )}

          {/* Game Expired - User needs to manually cancel for refund */}
          {modalType === 'expired' && game.status === 'pending' && (
            <Flex direction="column" gap="5" align="center" py="6">
              {cancelStatus === 'success' ? (
                <>
                  <XCircle className="w-20 h-20 text-green-400" />
                  <Flex direction="column" gap="2" align="center">
                    <Heading size="5" className="text-green-400">
                      Game Cancelled
                    </Heading>
                    <Text size="3" color="gray" align="center">
                      Your bet of {formatCurrency(BigInt(game.amount))} has been refunded to your wallet.
                    </Text>
                  </Flex>
                  <Button
                    size="3"
                    onClick={handleClose}
                    className="w-full glow-cyan hover:scale-105 transition-transform"
                  >
                    Close
                  </Button>
                </>
              ) : (
                <>
                  <Clock className="w-20 h-20 text-yellow-400 animate-pulse" />

                  <Flex direction="column" gap="2" align="center">
                    <Heading size="5" className="text-yellow-400">
                      No Opponent Found
                    </Heading>
                    <Text size="3" color="gray" align="center">
                      Your game has been waiting for {formatTime(expiredElapsedSeconds)} without being matched.
                    </Text>
                  </Flex>

                  {/* Elapsed time indicator */}
                  <Card className="w-full max-w-xs bg-yellow-500/5 border border-yellow-500/20">
                    <Flex direction="column" gap="2" p="3">
                      <Flex justify="between" align="center">
                        <Text size="1" color="gray">Time Waiting</Text>
                        <Text size="2" weight="bold" className="text-yellow-400 font-mono">
                          {formatTime(expiredElapsedSeconds)}
                        </Text>
                      </Flex>
                      <Progress
                        value={Math.min(expiredElapsedSeconds, 600)}
                        max={600}
                        size="1"
                        color="yellow"
                      />
                      <Flex justify="between" align="center">
                        <Text size="1" color="gray">5m expiry</Text>
                        <Text size="1" className={expiredElapsedSeconds > 300 ? 'text-yellow-400' : 'text-gray-500'}>
                          {expiredElapsedSeconds > 300 ? `+${formatTime(expiredElapsedSeconds - 300)} over` : 'Not yet'}
                        </Text>
                      </Flex>
                    </Flex>
                  </Card>

                  <Card className="card-simple w-full">
                    <Flex direction="column" gap="3" p="4">
                      <Flex justify="between" align="center">
                        <Text size="2" color="gray">Game ID:</Text>
                        <CopyableGameId gameId={game.id} size="2" showLabel={false} />
                      </Flex>

                      <Flex justify="between" align="center">
                        <Text size="2" color="gray">Your Bet:</Text>
                        <Text size="2" weight="bold">{formatCurrency(BigInt(game.amount))}</Text>
                      </Flex>

                      {cancelStatus === 'error' && (
                        <Flex
                          className="bg-red-500/10 rounded-lg p-3 border border-red-500/30"
                          direction="column"
                          gap="2"
                        >
                          <Text size="2" className="text-red-400" weight="bold">
                            Cancel Failed
                          </Text>
                          <Text size="2" className="text-red-200">
                            {cancelError?.message || 'Unable to cancel. Please try again.'}
                          </Text>
                        </Flex>
                      )}

                      {cancelStatus !== 'error' && (
                        <Flex
                          className="bg-green-500/10 rounded-lg p-3 border border-green-500/30"
                          direction="column"
                          gap="2"
                        >
                          <Text size="2" className="text-green-400" weight="bold">
                            Get Your Instant Refund
                          </Text>
                          <Text size="2" className="text-green-200">
                            Cancel now to receive your {formatCurrency(BigInt(game.amount))} back immediately.
                          </Text>
                        </Flex>
                      )}

                      {/* Chainlink auto-cancel info */}
                      <Flex
                        className="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20"
                        direction="column"
                        gap="1"
                      >
                        <Text size="1" className="text-cyan-400" weight="bold">
                          Chainlink Automation Active
                        </Text>
                        <Text size="1" className="text-cyan-200">
                          If you don&apos;t cancel manually, Chainlink will auto-cancel and refund you. This may take a few more minutes depending on network activity.
                        </Text>
                      </Flex>
                    </Flex>
                  </Card>

                  <Flex gap="3" style={{ width: '100%' }}>
                    <Button
                      size="3"
                      variant="soft"
                      onClick={handleClose}
                      className="flex-1"
                      disabled={cancelStatus === 'cancelling'}
                    >
                      Keep Waiting
                    </Button>
                    <Button
                      size="3"
                      color="green"
                      onClick={handleCancelGame}
                      disabled={cancelStatus === 'cancelling'}
                      className="flex-1 glow-cyan hover:scale-105 transition-transform"
                    >
                      {cancelStatus === 'cancelling' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Waiting for confirmation...
                        </>
                      ) : cancelStatus === 'error' ? (
                        'Try Again'
                      ) : (
                        'Cancel & Get Refund'
                      )}
                    </Button>
                  </Flex>

                  <Text size="1" color="gray" align="center">
                    Someone could still join your game. Cancel anytime for instant refund.
                  </Text>
                </>
              )}
            </Flex>
          )}

          {/* Game Status: Cancelled (already cancelled on-chain) */}
          {modalType !== 'expired' && game.status === 'cancelled' && (
            <Flex direction="column" gap="5" align="center" py="6">
              <XCircle className="w-20 h-20 text-green-400" />

              <Flex direction="column" gap="2" align="center">
                <Heading size="5" className="text-green-400">
                  Game Cancelled
                </Heading>
                <Text size="3" color="gray" align="center">
                  Your bet has been refunded to your wallet.
                </Text>
              </Flex>

              <Card className="card-simple w-full">
                <Flex direction="column" gap="3" p="4">
                  <Flex justify="between" align="center">
                    <Text size="2" color="gray">Game ID:</Text>
                    <CopyableGameId gameId={game.id} size="2" showLabel={false} />
                  </Flex>

                  <Flex justify="between" align="center">
                    <Text size="2" color="gray">Refund Amount:</Text>
                    <Text size="2" weight="bold" className="text-green-400">{formatCurrency(BigInt(game.amount))}</Text>
                  </Flex>
                </Flex>
              </Card>

              <Button
                size="3"
                onClick={handleClose}
                className="w-full glow-cyan hover:scale-105 transition-transform"
              >
                Close
              </Button>
            </Flex>
          )}

          {/* Not a participant warning */}
          {!isParticipant && game.status !== 'cancelled' && (
            <Card className="card-simple">
              <Flex p="4" align="center" gap="2">
                <Text size="2" color="gray">
                  You are viewing this game as a spectator
                </Text>
              </Flex>
            </Card>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
    </>
  );
}
