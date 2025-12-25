'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Container,
  Section,
  Flex,
  Heading,
  Text,
  Button,
  Card,
  Callout,
  Badge,
} from '@radix-ui/themes';
import { Layout } from '@/components/layout/Layout';
import { TierSelector } from '@/components/game/TierSelector';
import { CoinChoice } from '@/components/game/CoinChoice';
import { useGameStore, MAX_CONCURRENT_GAMES, useActiveGamesList } from '@/store/gameStore';
import { useCreateGame, useCancelGame } from '@/hooks/useContract';
import { useTiers } from '@/hooks/useTiers';
import { useCreatedGameTracking } from '@/hooks/useCreatedGameTracking';
import { Info, Loader2, CheckCircle2, AlertCircle, Clock, Users, X, Plus, Gamepad2 } from 'lucide-react';
import { parseError } from '@/lib/errors';
import { Game } from '@/types/game';

enum GameStep {
  SELECT_TIER = 'select_tier',
  CHOOSE_SIDE = 'choose_side',
  CONFIRM = 'confirm',
  CREATING = 'creating',
  WAITING = 'waiting',
}

export default function PlayPage() {
  const { isConnected, address } = useAccount();
  const [step, setStep] = useState<GameStep>(GameStep.SELECT_TIER);
  const {
    selectedTier,
    coinChoice,
    resetGameCreation,
    addActiveGame,
    updateActiveGame,
    queueModal,
    getActiveGamesCount,
    canCreateNewGame,
  } = useGameStore();
  const { createGame, isLoading, isSuccess, txHash, error, reset: resetCreateGame } = useCreateGame();
  const { cancelGame, isLoading: isCancelling, error: cancelError, isSuccess: cancelSuccess, reset: resetCancelState } = useCancelGame();
  const { data: tiers } = useTiers();
  const activeGames = useActiveGamesList();

  // Refs for race condition prevention
  const isCancellingRef = useRef(false);
  const isMatchedRef = useRef(false);
  const mountedRef = useRef(true);

  const currentTier = tiers?.find((t) => t.id === selectedTier);
  const activeGamesCount = getActiveGamesCount();
  const canCreate = canCreateNewGame();

  // Stable reset function - only resets the creation form, not active games
  const handleReset = useCallback(() => {
    if (!mountedRef.current) return;
    resetGameCreation();
    setStep(GameStep.SELECT_TIER);
    isCancellingRef.current = false;
    isMatchedRef.current = false;
    resetCancelState();
    resetCreateGame?.();
  }, [resetGameCreation, resetCancelState, resetCreateGame]);

  // Track the created game in real-time
  const handleGameFound = useCallback((game: Game) => {
    if (!mountedRef.current) return;
    console.log('🎮 Game found in database:', game.id);
    // Add to active games
    addActiveGame(game);
  }, [addActiveGame]);

  const handleGameMatched = useCallback((game: Game) => {
    if (!mountedRef.current) return;
    isMatchedRef.current = true;
    console.log('🎮 Game matched! Queueing modal...');
    updateActiveGame(game);
    queueModal(game, 'matched');
  }, [updateActiveGame, queueModal]);

  const handleGameResolved = useCallback((game: Game) => {
    if (!mountedRef.current) return;
    console.log('🎮 Game resolved:', game.winner_address);
    updateActiveGame(game);
    queueModal(game, 'resolved');
  }, [updateActiveGame, queueModal]);

  const handleGameCancelled = useCallback((game: Game) => {
    if (!mountedRef.current) return;
    console.log('🎮 Game cancelled');
    // Game will be removed when modal closes
    handleReset();
  }, [handleReset]);

  const {
    game: trackedGame,
    isSearching,
    isSubscribed,
    elapsedSeconds,
    cancelTracking,
  } = useCreatedGameTracking({
    txHash: isSuccess ? txHash : undefined,
    creatorAddress: address,
    onGameFound: handleGameFound,
    onGameMatched: handleGameMatched,
    onGameResolved: handleGameResolved,
    onGameCancelled: handleGameCancelled,
  });

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelTracking();
    };
  }, [cancelTracking]);

  // Handle cancel success
  useEffect(() => {
    if (cancelSuccess && mountedRef.current) {
      console.log('🎮 Game cancelled successfully');
      cancelTracking();
      handleReset();
    }
  }, [cancelSuccess, cancelTracking, handleReset]);

  // Reset matched ref when tracked game changes
  useEffect(() => {
    if (trackedGame?.status === 'pending') {
      isMatchedRef.current = false;
    } else if (trackedGame?.status === 'matched' || trackedGame?.status === 'resolved') {
      isMatchedRef.current = true;
    }
  }, [trackedGame?.status]);

  const handleCreateGame = useCallback(() => {
    if (selectedTier === null || coinChoice === null || !currentTier) return;
    if (!canCreate) {
      console.warn('Cannot create game - at max concurrent games');
      return;
    }
    setStep(GameStep.CREATING);
    isMatchedRef.current = false;
    isCancellingRef.current = false;
    createGame(selectedTier, coinChoice, currentTier.amount);
  }, [selectedTier, coinChoice, currentTier, createGame, canCreate]);

  const handleCancelGame = useCallback(() => {
    if (!trackedGame?.id) return;

    if (isCancellingRef.current) {
      console.warn('Cancel already in progress');
      return;
    }
    if (isMatchedRef.current || trackedGame.status !== 'pending') {
      console.warn('Cannot cancel - game is no longer pending:', trackedGame.status);
      return;
    }

    isCancellingRef.current = true;
    cancelGame(trackedGame.id);
  }, [trackedGame, cancelGame]);

  const handleCreateAnother = useCallback(() => {
    cancelTracking();
    handleReset();
  }, [cancelTracking, handleReset]);

  // Format elapsed time
  const formatElapsedTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Parse cancel error message
  const getCancelErrorMessage = (err: Error | null): string => {
    if (!err) return '';
    const msg = err.message.toLowerCase();
    if (msg.includes('user rejected') || msg.includes('user denied')) {
      return 'Transaction cancelled by user';
    }
    if (msg.includes('not creator') || msg.includes('unauthorized')) {
      return 'Only the game creator can cancel';
    }
    if (msg.includes('not pending') || msg.includes('already matched')) {
      return 'Game cannot be cancelled (already matched or resolved)';
    }
    if (msg.includes('gas')) {
      return 'Transaction failed - game may already be matched or cancelled';
    }
    return 'Failed to cancel game. It may have already been joined.';
  };

  // Determine if cancel button should be disabled
  const isCancelDisabled = isCancelling || isMatchedRef.current || trackedGame?.status !== 'pending';

  // Update step based on selection
  const canProceedToChooseSide = selectedTier !== null;
  const canProceedToConfirm = selectedTier !== null && coinChoice !== null;

  // Count pending games (waiting for opponent)
  const pendingGamesCount = activeGames.filter((g) => g.status === 'pending').length;

  if (!isConnected) {
    return (
      <Layout>
        <Section size="3">
          <Container size="2">
            <Flex direction="column" align="center" gap="6" py="9">
              <Card className="card-simple" size="4">
                <Flex direction="column" gap="4" p="6" align="center">
                  <Heading size="6">Connect Your Wallet</Heading>
                  <Text size="3" color="gray" align="center">
                    Please connect your Web3 wallet to start playing
                  </Text>
                  <ConnectButton />
                </Flex>
              </Card>
            </Flex>
          </Container>
        </Section>
      </Layout>
    );
  }

  return (
    <Layout>
      <Section size="3">
        <Container size="3">
          <Flex direction="column" gap="6" py="6">
            {/* Header */}
            <Flex direction="column" gap="2" align="center" className="animate-fade-in">
              <Heading size="8" className="text-gradient-rainbow">Create a Game</Heading>
              <Flex align="center" gap="3">
                <Text size="3" color="gray">
                  Choose your bet amount, pick a side, and let's flip!
                </Text>
                {activeGamesCount > 0 && (
                  <Badge size="2" color="cyan" variant="soft">
                    <Gamepad2 className="w-3 h-3 mr-1" />
                    {activeGamesCount} Active
                  </Badge>
                )}
              </Flex>
            </Flex>

            {/* Max games warning */}
            {!canCreate && (
              <Callout.Root color="orange" size="2">
                <Callout.Icon>
                  <AlertCircle className="w-4 h-4" />
                </Callout.Icon>
                <Text>
                  You have {MAX_CONCURRENT_GAMES} active games. Wait for one to complete before creating another.
                </Text>
              </Callout.Root>
            )}

            {/* Steps Indicator */}
            <Card className="card-solid border-purple-500/60 animate-slide-down">
              <Flex gap="2" p="4" justify="center" wrap="wrap">
                <StepIndicator
                  number={1}
                  label="Select Tier"
                  active={step === GameStep.SELECT_TIER}
                  completed={selectedTier !== null}
                />
                <StepIndicator
                  number={2}
                  label="Choose Side"
                  active={step === GameStep.CHOOSE_SIDE}
                  completed={coinChoice !== null}
                />
                <StepIndicator
                  number={3}
                  label="Confirm"
                  active={step === GameStep.CONFIRM}
                  completed={step === GameStep.CREATING || step === GameStep.WAITING}
                />
              </Flex>
            </Card>

            {/* Step Content */}
            <Card className="card-simple" size="4">
              <Flex direction="column" gap="6" p="6">
                {/* Step 1: Select Tier */}
                {step === GameStep.SELECT_TIER && (
                  <>
                    <TierSelector />
                    <Button
                      size="4"
                      disabled={!canProceedToChooseSide || !canCreate}
                      onClick={() => setStep(GameStep.CHOOSE_SIDE)}
                    >
                      Next: Choose Your Side
                    </Button>
                  </>
                )}

                {/* Step 2: Choose Side */}
                {step === GameStep.CHOOSE_SIDE && (
                  <>
                    <CoinChoice />
                    <Flex gap="3">
                      <Button size="4" variant="soft" onClick={() => setStep(GameStep.SELECT_TIER)}>
                        Back
                      </Button>
                      <Button
                        size="4"
                        className="flex-1"
                        disabled={!canProceedToConfirm}
                        onClick={() => setStep(GameStep.CONFIRM)}
                      >
                        Next: Confirm
                      </Button>
                    </Flex>
                  </>
                )}

                {/* Step 3: Confirm */}
                {step === GameStep.CONFIRM && (
                  <>
                    <Flex direction="column" gap="4">
                      <Heading size="5">Confirm Your Game</Heading>

                      <Flex direction="column" gap="3">
                        <Flex justify="between">
                          <Text color="gray">Bet Amount:</Text>
                          <Text weight="bold">${currentTier?.amountUsd}</Text>
                        </Flex>
                        <Flex justify="between">
                          <Text color="gray">Your Choice:</Text>
                          <Text weight="bold">{coinChoice ? 'Tails 🪙' : 'Heads 👑'}</Text>
                        </Flex>
                        <Flex justify="between">
                          <Text color="gray">Opponent Gets:</Text>
                          <Text weight="bold" color="gray">{!coinChoice ? 'Tails 🪙' : 'Heads 👑'}</Text>
                        </Flex>
                        <Flex justify="between">
                          <Text color="gray">Potential Win:</Text>
                          <Text weight="bold" className="text-green-400">
                            ${currentTier?.winAmountUsd}
                          </Text>
                        </Flex>
                        <Flex justify="between">
                          <Text size="1" color="gray">Platform Fee:</Text>
                          <Text size="1" color="gray">5% (included)</Text>
                        </Flex>
                      </Flex>

                      <Callout.Root color="blue" size="2">
                        <Callout.Icon>
                          <Info className="w-4 h-4" />
                        </Callout.Icon>
                        <Flex direction="column" gap="2" style={{ flex: 1 }}>
                          <Text weight="bold">What Happens Next:</Text>
                          <Text size="2">
                            1. Your game enters the queue<br />
                            2. Another player joins (gets opposite side)<br />
                            3. Chainlink VRF flips the coin (10-30 seconds)<br />
                            4. Winner gets paid automatically!
                          </Text>
                          <Text size="1" style={{ fontStyle: 'italic' }}>
                            You can create up to {MAX_CONCURRENT_GAMES} games at once!
                          </Text>
                        </Flex>
                      </Callout.Root>
                    </Flex>

                    <Flex gap="3">
                      <Button size="4" variant="soft" onClick={() => setStep(GameStep.CHOOSE_SIDE)}>
                        Back
                      </Button>
                      <Button size="4" className="flex-1" onClick={handleCreateGame} disabled={!canCreate}>
                        Create Game
                      </Button>
                    </Flex>
                  </>
                )}

                {/* Step 4: Creating/Waiting */}
                {(step === GameStep.CREATING || step === GameStep.WAITING) && (
                  <Flex direction="column" gap="4" align="center" py="6">
                    {/* Phase 1: Wallet confirmation */}
                    {isLoading && (
                      <div className="animate-fade-in">
                        <Flex direction="column" gap="4" align="center">
                          <Loader2 className="w-16 h-16 text-cyan-400 animate-spin glow-cyan" />
                          <Heading size="5" className="text-gradient-cyan-purple">Creating Game...</Heading>
                          <Text size="2" color="gray" align="center">
                            Please confirm the transaction in your wallet
                          </Text>
                        </Flex>
                      </div>
                    )}

                    {/* Phase 2: Transaction confirmed, waiting for indexing */}
                    {isSuccess && isSearching && !trackedGame && (
                      <div className="animate-fade-in">
                        <Flex direction="column" gap="4" align="center">
                          <Loader2 className="w-16 h-16 text-yellow-400 animate-spin" />
                          <Heading size="5" className="text-gradient-gold">Transaction Confirmed!</Heading>
                          <Text size="2" color="gray" align="center">
                            Waiting for blockchain confirmation...
                          </Text>
                          {txHash && (
                            <Text size="1" className="font-mono text-gray-500">
                              TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                            </Text>
                          )}
                        </Flex>
                      </div>
                    )}

                    {/* Phase 3: Game indexed, waiting for opponent */}
                    {isSuccess && trackedGame && trackedGame.status === 'pending' && (
                      <div className="animate-slide-up">
                        <Flex direction="column" gap="5" align="center">
                          {/* Status Header */}
                          <Flex direction="column" gap="2" align="center">
                            <CheckCircle2 className="w-12 h-12 text-green-400 glow-resolved" />
                            <Heading size="5" className="text-gradient-gold">Game Created!</Heading>
                            <Badge size="2" color="cyan" variant="soft">
                              <Users className="w-3 h-3 mr-1" />
                              Waiting for Opponent
                            </Badge>
                          </Flex>

                          {/* Game Details Card */}
                          <Card className="w-full max-w-sm card-solid border-purple-500/30">
                            <Flex direction="column" gap="3" p="4">
                              <Flex justify="between" align="center">
                                <Text size="2" color="gray">Game ID:</Text>
                                <Text size="2" weight="bold" className="font-mono">#{trackedGame.id}</Text>
                              </Flex>
                              <Flex justify="between" align="center">
                                <Text size="2" color="gray">Your Choice:</Text>
                                <Text size="2" weight="bold">{trackedGame.creator_choice ? 'Tails 🪙' : 'Heads 👑'}</Text>
                              </Flex>
                              <Flex justify="between" align="center">
                                <Text size="2" color="gray">Bet Amount:</Text>
                                <Text size="2" weight="bold">${currentTier?.amountUsd}</Text>
                              </Flex>
                              <Flex justify="between" align="center">
                                <Text size="2" color="gray">Time Waiting:</Text>
                                <Flex align="center" gap="1">
                                  <Clock className="w-3 h-3 text-cyan-400" />
                                  <Text size="2" weight="bold" className="text-cyan-400">
                                    {formatElapsedTime(elapsedSeconds)}
                                  </Text>
                                </Flex>
                              </Flex>
                            </Flex>
                          </Card>

                          {/* Real-time Status */}
                          <Flex align="center" gap="2">
                            <div className={`w-2 h-2 rounded-full ${isSubscribed ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
                            <Text size="1" color="gray">
                              {isSubscribed ? 'Live updates active' : 'Connecting...'}
                            </Text>
                          </Flex>

                          {/* Action Buttons */}
                          <Flex gap="3" wrap="wrap" justify="center">
                            <Button
                              size="3"
                              variant="soft"
                              color="red"
                              onClick={handleCancelGame}
                              disabled={isCancelDisabled}
                            >
                              {isCancelling ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <X className="w-4 h-4 mr-2" />
                              )}
                              Cancel Game
                            </Button>
                            {canCreate && (
                              <Button
                                size="3"
                                onClick={handleCreateAnother}
                                className="glow-cyan"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Create Another
                              </Button>
                            )}
                          </Flex>

                          {/* Cancel Error */}
                          {cancelError && (
                            <Card className="w-full max-w-sm bg-red-500/10 border border-red-500/30">
                              <Flex direction="column" gap="2" p="3" align="center">
                                <Flex align="center" gap="2">
                                  <AlertCircle className="w-4 h-4 text-red-400" />
                                  <Text size="2" className="text-red-400" weight="bold">
                                    Cancel Failed
                                  </Text>
                                </Flex>
                                <Text size="1" color="gray" align="center">
                                  {getCancelErrorMessage(cancelError)}
                                </Text>
                              </Flex>
                            </Card>
                          )}

                          {/* Info */}
                          <Text size="1" color="gray" align="center" style={{ maxWidth: '300px' }}>
                            {canCreate
                              ? "Your game is live! Create more games while waiting, or wait for an opponent."
                              : "Your game is live! When someone joins, the coin flip happens automatically."}
                          </Text>

                          {/* Active Games Count */}
                          {pendingGamesCount > 1 && (
                            <Badge size="2" color="purple" variant="soft">
                              <Gamepad2 className="w-3 h-3 mr-1" />
                              {pendingGamesCount} games waiting for opponents
                            </Badge>
                          )}
                        </Flex>
                      </div>
                    )}

                    {/* Game matched - show brief transition */}
                    {isSuccess && trackedGame && trackedGame.status === 'matched' && (
                      <div className="animate-slide-up">
                        <Flex direction="column" gap="4" align="center">
                          <Users className="w-16 h-16 text-cyan-400 animate-pulse glow-cyan" />
                          <Heading size="5" className="text-gradient-cyan-purple">Opponent Found!</Heading>
                          <Text size="2" color="gray" align="center">
                            Opening game session...
                          </Text>
                          {canCreate && (
                            <Button size="3" onClick={handleCreateAnother} className="mt-4">
                              <Plus className="w-4 h-4 mr-2" />
                              Create Another Game
                            </Button>
                          )}
                        </Flex>
                      </div>
                    )}

                    {/* Game resolved - show brief transition */}
                    {isSuccess && trackedGame && trackedGame.status === 'resolved' && (
                      <div className="animate-slide-up">
                        <Flex direction="column" gap="4" align="center">
                          <CheckCircle2 className="w-16 h-16 text-green-400 glow-resolved" />
                          <Heading size="5" className="text-gradient-gold">Game Complete!</Heading>
                          <Text size="2" color="gray" align="center">
                            Check the result in the game modal.
                          </Text>
                          <Button size="3" onClick={handleCreateAnother}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create New Game
                          </Button>
                        </Flex>
                      </div>
                    )}

                    {error && (
                      <div className="animate-slide-up">
                        <Flex direction="column" gap="4" align="center">
                          <AlertCircle className="w-16 h-16 text-red-400 animate-pulse" />
                          <Heading size="5" className="text-red-400">
                            {parseError(error).title}
                          </Heading>
                          <Flex direction="column" gap="2" align="center">
                            <Text size="2" color="gray" align="center">
                              {parseError(error).message}
                            </Text>
                            {parseError(error).suggestion && (
                              <Text size="1" className="text-slate-400" align="center">
                                {parseError(error).suggestion}
                              </Text>
                            )}
                          </Flex>
                          <Button size="3" onClick={handleCreateAnother} className="hover:scale-105 transition-transform">
                            Try Again
                          </Button>
                        </Flex>
                      </div>
                    )}
                  </Flex>
                )}
              </Flex>
            </Card>
          </Flex>
        </Container>
      </Section>
    </Layout>
  );
}

function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <Flex align="center" gap="2" className="transition-all duration-300">
      <Flex
        align="center"
        justify="center"
        className={`w-8 h-8 rounded-full border-2 transition-all duration-300 ${
          completed
            ? 'bg-gradient-to-br from-green-500 to-green-600 border-green-400 glow-resolved scale-110'
            : active
              ? 'border-cyan-500 glow-cyan scale-105 animate-pulse-slow'
              : 'border-slate-600'
        }`}
      >
        <Text
          size="2"
          weight="bold"
          className={completed || active ? 'text-white' : 'text-slate-500'}
        >
          {number}
        </Text>
      </Flex>
      <Text
        size="2"
        weight={active ? 'bold' : 'regular'}
        className={active ? 'text-cyan-400' : completed ? 'text-green-400' : 'text-gray-500'}
      >
        {label}
      </Text>
    </Flex>
  );
}
