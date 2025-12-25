'use client';

import { Dialog, Flex, Heading, Text, Button, Card, Callout } from '@radix-ui/themes';
import { useState, useEffect, useRef } from 'react';
import { CoinFlip3D, CoinFlip2D } from './CoinFlip3D';
import { Game } from '@/types/game';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Users, Trophy, Zap, AlertTriangle, Clock, XCircle } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { validateGameState } from '@/hooks/useGameSync';
import { useGame } from '@/hooks/useGames';

interface GameSessionModalProps {
  game: Game | null;
  open: boolean;
  onClose: () => void;
  userAddress?: string;
}

// VRF timeout in seconds (2 minutes)
const VRF_TIMEOUT_SECONDS = 120;

export function GameSessionModal({ game, open, onClose, userAddress }: GameSessionModalProps) {
  const [isFlipping, setIsFlipping] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [vrfElapsedSeconds, setVrfElapsedSeconds] = useState(0);
  const [vrfTimedOut, setVrfTimedOut] = useState(false);
  const { resetGame, updateActiveGame } = useGameStore();

  // Fetch fresh game data for auto-refetch on validation errors
  const { data: freshGame, refetch: refetchGame } = useGame(game?.id ?? null);

  // Refs for tracking
  const vrfTimerRef = useRef<NodeJS.Timeout | null>(null);
  const vrfStartTimeRef = useRef<number | null>(null);
  const lastGameIdRef = useRef<string | null>(null);
  const lastGameStatusRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);

  // Determine if user is part of this game
  const isCreator = game?.creator_address?.toLowerCase() === userAddress?.toLowerCase();
  const isJoiner = game?.joiner_address?.toLowerCase() === userAddress?.toLowerCase();
  const isParticipant = isCreator || isJoiner;

  // Determine if user won
  const isWinner = game?.winner_address?.toLowerCase() === userAddress?.toLowerCase();

  // Validate game state
  const validation = game ? validateGameState(game) : { valid: false, errors: [] };

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
    }

    // Handle status transitions
    if (game.status === 'matched') {
      // Start VRF timer if not already started
      if (!vrfStartTimeRef.current) {
        vrfStartTimeRef.current = Date.now();
        setVrfElapsedSeconds(0);
        setVrfTimedOut(false);
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
      return;
    }

    // If resolved but invalid, try to refetch after a delay (max 5 retries)
    if (retryCountRef.current < 5) {
      const timeout = setTimeout(() => {
        console.log(`🔄 Auto-refetching game ${game.id} due to validation errors (attempt ${retryCountRef.current + 1})`);
        retryCountRef.current++;
        refetchGame();
      }, 2000); // Retry every 2 seconds

      return () => clearTimeout(timeout);
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

  const handleFlipComplete = () => {
    setShowResult(true);
  };

  const handleSkip = () => {
    setSkipped(true);
    setIsFlipping(false);
    setShowResult(true);
  };

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
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Content
        maxWidth="600px"
        className="backdrop-blur-xl bg-slate-900/95 border-2 border-cyan-500/30"
      >
        <Dialog.Title>
          <Flex direction="column" gap="2" align="center">
            <Heading size="7" className="text-gradient-rainbow">
              {game.status === 'matched' && !vrfTimedOut && 'Game Matched!'}
              {game.status === 'matched' && vrfTimedOut && 'VRF Taking Longer Than Expected'}
              {game.status === 'resolved' && !showResult && 'Flipping Coin...'}
              {game.status === 'resolved' && showResult && (isWinner ? 'You Won!' : 'Better Luck Next Time')}
              {game.status === 'cancelled' && 'Game Expired'}
            </Heading>
            <Text size="2" color="gray">
              Game #{game.id}
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

                  {/* Timer */}
                  <Flex align="center" gap="2" className="text-cyan-400">
                    <Clock className="w-4 h-4" />
                    <Text size="2" weight="bold">{formatTime(vrfElapsedSeconds)}</Text>
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
                  This usually takes 10-30 seconds. The result is cryptographically secure and cannot be manipulated.
                </Text>
              )}
            </Flex>
          )}

          {/* Game Status: Resolved - Show Animation */}
          {game.status === 'resolved' && !showResult && (
            <Flex direction="column" gap="4">
              {/* State Validation Warning */}
              {!validation.valid && (
                <Callout.Root color="orange" size="2">
                  <Callout.Icon>
                    <AlertTriangle className="w-4 h-4" />
                  </Callout.Icon>
                  <Flex direction="column" gap="1" style={{ flex: 1 }}>
                    <Text weight="bold">Waiting for complete game data...</Text>
                    {validation.errors.map((error, i) => (
                      <Text key={i} size="1">{error}</Text>
                    ))}
                  </Flex>
                </Callout.Root>
              )}

              {/* Coin Animation - Only show when state is valid */}
              {validation.valid && (
                <>
                  <div className="relative">
                    {skipped ? (
                      <Flex
                        direction="column"
                        align="center"
                        justify="center"
                        className="w-full h-96 bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/20 rounded-lg"
                      >
                        <div className="text-8xl mb-4">
                          {result ? '🪙' : '👑'}
                        </div>
                        <Text size="5" weight="bold">
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
                </>
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
                <div className="text-9xl animate-pulse-slow">
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
                    window.location.href = '/play';
                  }}
                  className="flex-1 glow-cyan hover:scale-105 transition-transform"
                >
                  Play Again
                </Button>
              </Flex>
            </Flex>
          )}

          {/* Game Status: Cancelled (Timeout) */}
          {game.status === 'cancelled' && (
            <Flex direction="column" gap="5" align="center" py="6">
              <XCircle className="w-20 h-20 text-yellow-400" />

              <Flex direction="column" gap="2" align="center">
                <Heading size="5" className="text-yellow-400">
                  Game Cancelled
                </Heading>
                <Text size="3" color="gray" align="center">
                  This game was automatically cancelled after 15 minutes
                  without finding a match.
                </Text>
              </Flex>

              <Card className="card-simple w-full">
                <Flex direction="column" gap="3" p="4">
                  <Flex justify="between" align="center">
                    <Text size="2" color="gray">Game ID:</Text>
                    <Text size="2" weight="bold">#{game.id}</Text>
                  </Flex>

                  <Flex justify="between" align="center">
                    <Text size="2" color="gray">Bet Amount:</Text>
                    <Text size="2" weight="bold">{formatCurrency(BigInt(game.amount))}</Text>
                  </Flex>

                  <Flex
                    className="bg-green-500/10 rounded-lg p-3 border border-green-500/30"
                    align="center"
                    gap="2"
                  >
                    <Text size="2" className="text-green-400">
                      Your funds have been refunded to your wallet
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
                >
                  Close
                </Button>
                <Button
                  size="3"
                  onClick={() => {
                    handleClose();
                    window.location.href = '/play';
                  }}
                  className="flex-1 glow-cyan hover:scale-105 transition-transform"
                >
                  Create New Game
                </Button>
              </Flex>
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
  );
}
