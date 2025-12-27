'use client';

import { Dialog, Flex, Heading, Text, Button, Card, Callout, Progress } from '@radix-ui/themes';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { CoinFlip2D } from './CoinFlip3D';
import { Confetti } from '@/components/effects/Confetti';
import { Game } from '@/types/game';
import { formatCurrency, formatGameId } from '@/lib/utils';
import { invalidateGameQueries, removeGameFromPendingCache } from '@/lib/queryUtils';
import { Loader2, Users, Trophy, Zap, AlertTriangle, Clock, XCircle } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { validateGameState } from '@/hooks/useGameSync';
import { useGame } from '@/hooks/useGames';
import { useCancelGame } from '@/hooks/useContract';
import { showToast } from '@/lib/toast';
import { playSound } from '@/lib/sounds';

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
  const { resetGame, updateActiveGame, removeActiveGame, startCancellingGame, finishCancellingGame } = useGameStore();

  // Use refs to prevent duplicate sounds/toasts (more reliable than state)
  const hasPlayedMatchSoundRef = useRef(false);
  const hasPlayedResultSoundRef = useRef(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  // Cancel game hook
  const { cancelGame, isLoading: isCancelling, isSuccess: cancelSuccess, error: cancelError, reset: resetCancel } = useCancelGame();

  // Fetch fresh game data for auto-refetch on validation errors
  const { data: freshGame, refetch: refetchGame } = useGame(game?.id ?? null);

  // Refs for tracking
  const vrfTimerRef = useRef<NodeJS.Timeout | null>(null);
  const vrfStartTimeRef = useRef<number | null>(null);
  const lastGameIdRef = useRef<string | null>(null);
  const lastGameStatusRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);

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

  // Validate game state
  const validation = useMemo(() => {
    return game ? validateGameState(game) : { valid: false, errors: [] };
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
      // Start VRF timer if not already started
      if (!vrfStartTimeRef.current) {
        vrfStartTimeRef.current = Date.now();
        setVrfElapsedSeconds(0);
        setVrfTimedOut(false);
      }

      // Play match sound and show toast once
      if (!hasPlayedMatchSoundRef.current && isParticipant) {
        hasPlayedMatchSoundRef.current = true;
        playSound.match();
        showToast.gameMatched();
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

      // Start flip animation
      setIsFlipping(true);
      setVrfTimedOut(false);
    }
  }, [game?.id, game?.status, validation.valid]);

  // Auto-refetch on validation errors (incomplete VRF data)
  useEffect(() => {
    if (!game || game.status !== 'resolved' || validation.valid) {
      retryCountRef.current = 0;
      setDataRetryExhausted(false);
      return;
    }

    // If resolved but invalid, try to refetch aggressively (max retries)
    if (retryCountRef.current < MAX_DATA_RETRIES) {
      const timeout = setTimeout(() => {
        console.log(`🔄 Auto-refetching game ${game.id} due to validation errors (attempt ${retryCountRef.current + 1}/${MAX_DATA_RETRIES})`);
        retryCountRef.current++;
        refetchGame();
      }, 1000); // Retry every 1 second (more aggressive)

      return () => clearTimeout(timeout);
    } else {
      // Exhausted retries
      setDataRetryExhausted(true);
    }
  }, [game?.id, game?.status, validation.valid, refetchGame]);

  // Update game in store when fresh data arrives
  useEffect(() => {
    if (freshGame && game && freshGame.id === game.id) {
      const freshValidation = validateGameState(freshGame);
      if (freshValidation.valid && !validation.valid) {
        console.log('✅ Fresh game data is valid, updating store');
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vrfTimerRef.current) {
        clearInterval(vrfTimerRef.current);
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
  }, [open, game?.id, resetCancel]);

  const handleCancelGame = async () => {
    if (!game?.id) return;
    setCancelStatus('cancelling');
    // Start optimistic update
    startCancellingGame(game.id);
    await cancelGame(game.id);
  };

  // Extracted: Play result effects (sound, confetti, toast)
  const playResultEffects = useCallback(() => {
    if (hasPlayedResultSoundRef.current || !isParticipant) return;
    hasPlayedResultSoundRef.current = true;

    if (isWinner) {
      playSound.win();
      setShowConfetti(true);
      showToast.gameWon(formatCurrency(BigInt(game?.payout || 0)));
    } else {
      playSound.loss();
      showToast.gameLost();
    }
  }, [isParticipant, isWinner, game?.payout]);

  const handleFlipComplete = useCallback(() => {
    setShowResult(true);
    playResultEffects();
  }, [playResultEffects]);

  const handleSkip = useCallback(() => {
    setSkipped(true);
    setIsFlipping(false);
    setShowResult(true);
    playResultEffects();
  }, [playResultEffects]);

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
        className="backdrop-blur-xl bg-slate-900/95 border-2 border-cyan-500/30 max-h-[90vh] overflow-y-auto fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
        aria-describedby={undefined}
      >
        <Dialog.Title>
          <Flex direction="column" gap="2" align="center">
            <Heading size="7" className="text-gradient-rainbow">
              {modalType === 'expired' && 'Game Expired - Action Required'}
              {modalType !== 'expired' && game.status === 'matched' && !vrfTimedOut && 'Game Matched!'}
              {modalType !== 'expired' && game.status === 'matched' && vrfTimedOut && 'VRF Taking Longer Than Expected'}
              {modalType !== 'expired' && game.status === 'resolved' && !validation.valid && !showResult && 'Finalizing...'}
              {modalType !== 'expired' && game.status === 'resolved' && validation.valid && !showResult && 'Flipping Coin...'}
              {modalType !== 'expired' && game.status === 'resolved' && showResult && (isWinner ? 'You Won!' : 'Better Luck Next Time')}
              {modalType !== 'expired' && game.status === 'cancelled' && 'Game Cancelled'}
            </Heading>
            <Text size="2" color="gray">
              Game {formatGameId(game.id)}
            </Text>
          </Flex>
        </Dialog.Title>

        <Flex direction="column" gap="6" mt="4">
          {/* Game Status: Matched - Waiting for VRF */}
          {game.status === 'matched' && (
            <Flex direction="column" gap="5" align="center" py="6">
              {!vrfTimedOut ? (
                <>
                  <Loader2 className="w-20 h-20 text-cyan-400 animate-spin glow-cyan" />

                  <Flex direction="column" gap="2" align="center">
                    <Heading size="5" className="text-gradient-cyan-purple">
                      Requesting Random Number...
                    </Heading>
                    <Text size="3" color="gray" align="center">
                      Chainlink VRF is generating a provably fair random number
                    </Text>
                  </Flex>

                  {/* VRF Progress Bar */}
                  <Flex direction="column" gap="2" className="w-full max-w-xs">
                    <Progress
                      value={Math.min(vrfElapsedSeconds, 30)}
                      max={30}
                      size="2"
                      color={vrfElapsedSeconds > 30 ? 'amber' : 'cyan'}
                    />
                    <Flex justify="between" align="center">
                      <Flex align="center" gap="1" className="text-cyan-400">
                        <Clock className="w-3 h-3" />
                        <Text size="1" weight="bold">{formatTime(vrfElapsedSeconds)}</Text>
                      </Flex>
                      <Text size="1" color="gray">
                        {vrfElapsedSeconds < 10 && 'Starting...'}
                        {vrfElapsedSeconds >= 10 && vrfElapsedSeconds < 30 && 'Almost there...'}
                        {vrfElapsedSeconds >= 30 && vrfElapsedSeconds < 60 && 'Taking longer than usual'}
                        {vrfElapsedSeconds >= 60 && 'Please wait...'}
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

                  <Text size="1" color="gray" align="center">
                    This usually takes just a few seconds
                  </Text>
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
                <Flex justify="center">
                  <Button
                    size="3"
                    variant="soft"
                    onClick={handleSkip}
                    className="glow-cyan hover:scale-105 transition-transform"
                  >
                    <Zap className="w-4 h-4" />
                    Skip Animation
                  </Button>
                </Flex>
              )}
            </Flex>
          )}

          {/* Game Status: Resolved - Show Result */}
          {game.status === 'resolved' && showResult && (
            <Flex direction="column" gap="5" align="center">
              {/* Result Display */}
              <Flex
                direction="column"
                align="center"
                justify="center"
                gap="4"
                className="w-full py-8 bg-gradient-to-b from-slate-900/50 to-slate-950/50 rounded-lg border border-cyan-500/20"
              >
                <div className="text-7xl sm:text-8xl md:text-9xl animate-pulse-slow">
                  {result ? '🪙' : '👑'}
                </div>
                <Heading size="6" className={isWinner ? 'text-gradient-gold' : 'text-gray-400'}>
                  Result: {result ? 'Tails' : 'Heads'}
                </Heading>
              </Flex>

              {/* Winner Card */}
              <Card className={`card-solid w-full ${isWinner ? 'border-green-500/60 glow-resolved' : 'border-red-500/30'}`}>
                <Flex direction="column" gap="4" p="5">
                  <Flex align="center" gap="2">
                    <Trophy className={`w-5 h-5 ${isWinner ? 'text-green-400' : 'text-gray-500'}`} />
                    <Heading size="4" className={isWinner ? 'text-green-400' : 'text-gray-400'}>
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
              <Flex gap="3" style={{ width: '100%' }}>
                <Button
                  size="3"
                  variant="soft"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  size="3"
                  onClick={() => {
                    handleClose();
                    router.push('/play');
                  }}
                  className="flex-1 glow-cyan hover:scale-105 transition-transform"
                >
                  Play Again
                </Button>
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
                  <Clock className="w-20 h-20 text-yellow-400" />

                  <Flex direction="column" gap="2" align="center">
                    <Heading size="5" className="text-yellow-400">
                      No Opponent Found
                    </Heading>
                    <Text size="3" color="gray" align="center">
                      Your game has been waiting for 20 minutes without being matched.
                    </Text>
                  </Flex>

                  <Card className="card-simple w-full">
                    <Flex direction="column" gap="3" p="4">
                      <Flex justify="between" align="center">
                        <Text size="2" color="gray">Game ID:</Text>
                        <Text size="2" weight="bold">{formatGameId(game.id)}</Text>
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
                            Good News: You Can Get a Full Refund
                          </Text>
                          <Text size="2" className="text-green-200">
                            Cancel the game now to receive your {formatCurrency(BigInt(game.amount))} back.
                          </Text>
                        </Flex>
                      )}
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
                          Cancelling...
                        </>
                      ) : cancelStatus === 'error' ? (
                        'Try Again'
                      ) : (
                        'Cancel & Get Refund'
                      )}
                    </Button>
                  </Flex>

                  <Text size="1" color="gray" align="center">
                    The game will remain open until you cancel it or someone joins.
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
                    <Text size="2" weight="bold">{formatGameId(game.id)}</Text>
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
