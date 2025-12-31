'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useSearchParams } from 'next/navigation';
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
import { useGameStore, MAX_CONCURRENT_GAMES, useSelectedTier, useCoinChoice } from '@/store/gameStore';
import { useCreateGame, useCancelGame } from '@/hooks/useContract';
import { useTiers } from '@/hooks/useTiers';
import { useCreatedGameTracking } from '@/hooks/useCreatedGameTracking';
import { useOptimisticUpdates } from '@/hooks/useOptimisticUpdates';
import { Info, Loader2, CheckCircle2, AlertCircle, Clock, Users, X, Plus, Gamepad2, Zap } from 'lucide-react';
import { parseError } from '@/lib/errors';
import { formatGameId, formatCurrency, devLog } from '@/lib/utils';
import { PLATFORM_FEE_PERCENT } from '@/lib/constants';
import { Game } from '@/types/game';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateGameQueries, removeGameFromPendingCache } from '@/lib/queryUtils';
import { showToast } from '@/lib/toast';
import { playSound } from '@/lib/sounds';
import { usePendingTransactions, useGameLimits } from '@/hooks/usePendingTransactions';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useNotificationState } from '@/hooks/useNotificationState';

enum GameStep {
  SELECT_TIER = 'select_tier',
  CHOOSE_SIDE = 'choose_side',
  CONFIRM = 'confirm',
  CREATING = 'creating',
  WAITING = 'waiting',
}

export default function PlayPage() {
  const { isConnected, address } = useAccount();
  const searchParams = useSearchParams();
  const isQuickRebet = searchParams.get('quickRebet') === 'true';
  const [step, setStep] = useState<GameStep>(GameStep.SELECT_TIER);
  // Use optimized selectors for state to prevent unnecessary re-renders
  const selectedTier = useSelectedTier();
  const coinChoice = useCoinChoice();
  // Actions are stable references, safe to destructure directly
  const {
    resetGameCreation,
    addActiveGame,
    updateActiveGame,
    queueModal,
    startCancellingGame,
    finishCancellingGame,
    isGameCancelling,
  } = useGameStore();

  // DB-backed game limits (replaces Zustand-based getActiveGamesCount/canCreateNewGame)
  const { activeGamesCount, canCreateNewGame, confirmedActiveCount: pendingGamesCount } = useGameLimits();

  // DB-backed pending transactions for persistence across refreshes
  const {
    addPendingTransaction: addDbPendingTx,
    getPendingCreate,
    markConfirmed: markDbTxConfirmed,
    markFailed: markDbTxFailed,
  } = usePendingTransactions();

  // DB-backed user preferences for quick re-bet
  const { lastGameSettings, clearLastGameSettings } = useUserPreferences();

  // DB-backed notification state for deduplication across devices/tabs
  const { markModalShown } = useNotificationState();

  // Ref to track the DB pending tx ID for the current create operation
  const pendingTxIdRef = useRef<number | null>(null);
  const { createGame, isLoading, isSuccess, txHash, error, wasRejected: createWasRejected, reset: resetCreateGame } = useCreateGame();
  const { cancelGame, isLoading: isCancelling, error: cancelError, isSuccess: cancelSuccess, wasRejected: cancelWasRejected, reset: resetCancelState } = useCancelGame();
  const { data: tiers } = useTiers();
  const queryClient = useQueryClient();
  const { optimisticCreateGame, rollbackOptimisticCreate, optimisticCancelGame, rollbackOptimisticCancel, removeOptimisticGame } = useOptimisticUpdates();

  // Refs for race condition prevention
  const isCancellingRef = useRef(false);
  const isMatchedRef = useRef(false);
  const mountedRef = useRef(true);
  const cancelTrackingRef = useRef<(() => void) | null>(null);
  const cancellingGameIdRef = useRef<string | null>(null);

  const currentTier = tiers?.find((t) => t.id === selectedTier);
  const canCreate = canCreateNewGame;

  // Stable reset function - only resets the creation form, not active games
  const handleReset = useCallback(() => {
    if (!mountedRef.current) return;
    resetGameCreation();
    setStep(GameStep.SELECT_TIER);
    isCancellingRef.current = false;
    isMatchedRef.current = false;
    resetCancelState();
    resetCreateGame?.();
    // Mark pending tx as failed if user resets manually
    if (pendingTxIdRef.current) {
      markDbTxFailed(pendingTxIdRef.current, 'User cancelled');
      pendingTxIdRef.current = null;
    }
  }, [resetGameCreation, resetCancelState, resetCreateGame, markDbTxFailed]);

  // Track the created game in real-time
  const handleGameFound = useCallback((game: Game) => {
    if (!mountedRef.current) return;
    devLog.log('🎮 Game found in database:', game.id);
    // Mark pending tx as confirmed (DB trigger also handles this)
    if (pendingTxIdRef.current) {
      markDbTxConfirmed(pendingTxIdRef.current);
      pendingTxIdRef.current = null;
    }
    // Remove optimistic game now that real one exists
    if (game.tx_hash) {
      removeOptimisticGame(game.tx_hash);
    }
    // Add the real game to active games
    addActiveGame(game);
    // Show toast and play sound
    showToast.gameCreated(formatGameId(game.id));
    playSound.success();
  }, [addActiveGame, markDbTxConfirmed, removeOptimisticGame]);

  const handleGameMatched = useCallback((game: Game) => {
    if (!mountedRef.current) return;
    isMatchedRef.current = true;
    devLog.log('🎮 Game matched! Queueing modal...');
    updateActiveGame(game);
    // Mark as shown in DB BEFORE queuing to prevent duplicates across tabs/refreshes
    markModalShown(game.id, 'matched');
    queueModal(game, 'matched');
    // Reset creation UI after a brief delay to show transition
    setTimeout(() => {
      if (mountedRef.current) {
        cancelTrackingRef.current?.();
        resetGameCreation();
        setStep(GameStep.SELECT_TIER);
      }
    }, 500);
  }, [updateActiveGame, queueModal, resetGameCreation, markModalShown]);

  const handleGameResolved = useCallback((game: Game) => {
    if (!mountedRef.current) return;
    devLog.log('🎮 Game resolved:', game.winner_address);
    updateActiveGame(game);
    // Mark as shown in DB BEFORE queuing to prevent duplicates across tabs/refreshes
    markModalShown(game.id, 'resolved');
    queueModal(game, 'resolved');
    // Reset creation UI immediately
    cancelTrackingRef.current?.();
    resetGameCreation();
    setStep(GameStep.SELECT_TIER);
  }, [updateActiveGame, queueModal, resetGameCreation, markModalShown]);

  const handleGameCancelled = useCallback((_game: Game) => {
    if (!mountedRef.current) return;
    devLog.log('🎮 Game cancelled');
    // Mark pending tx as confirmed (cancellation succeeded)
    if (pendingTxIdRef.current) {
      markDbTxConfirmed(pendingTxIdRef.current);
      pendingTxIdRef.current = null;
    }
    // Game will be removed when modal closes
    handleReset();
  }, [handleReset, markDbTxConfirmed]);

  const {
    game: trackedGame,
    isSearching,
    phase: trackingPhase,
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

  // Sync cancelTracking to ref for use in callbacks
  cancelTrackingRef.current = cancelTracking;

  // Handle quick re-bet: if we have settings and query param, skip to confirm
  const quickRebetHandledRef = useRef(false);
  useEffect(() => {
    if (isQuickRebet && lastGameSettings && !quickRebetHandledRef.current && canCreate) {
      quickRebetHandledRef.current = true;
      // Settings are already set by setupQuickRebet in the modal
      // Just skip to confirm step
      setStep(GameStep.CONFIRM);
      showToast.info('Quick re-bet: Same tier and choice loaded!');
    }
  }, [isQuickRebet, lastGameSettings, canCreate]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelTracking();
    };
  }, [cancelTracking]);

  // Handle cancel success/failure
  useEffect(() => {
    if (cancelSuccess && mountedRef.current && cancellingGameIdRef.current) {
      const gameId = cancellingGameIdRef.current;
      devLog.log('🎮 Game cancelled successfully:', gameId);
      finishCancellingGame(gameId, true);

      // Invalidate all game queries for real-time sync across pages
      invalidateGameQueries(queryClient, gameId);

      // Show success toast
      showToast.success('Game cancelled - bet refunded');

      cancellingGameIdRef.current = null;
      cancelTracking();
      handleReset();
    }
  }, [cancelSuccess, cancelTracking, handleReset, finishCancellingGame, queryClient]);

  // Handle cancel error - revert optimistic update
  useEffect(() => {
    if (cancelError && mountedRef.current && cancellingGameIdRef.current) {
      devLog.log('🎮 Game cancel failed, reverting');
      finishCancellingGame(cancellingGameIdRef.current, false);
      // Refetch pending games to restore the optimistically removed game
      invalidateGameQueries(queryClient, cancellingGameIdRef.current);
      isCancellingRef.current = false;
      cancellingGameIdRef.current = null;
    }
  }, [cancelError, finishCancellingGame, queryClient]);

  // Handle user rejection - silently revert without error
  useEffect(() => {
    if (cancelWasRejected && mountedRef.current && cancellingGameIdRef.current) {
      devLog.log('🎮 Cancel rejected by user, reverting UI for game:', cancellingGameIdRef.current);
      finishCancellingGame(cancellingGameIdRef.current, false);
      // Refetch pending games to restore the optimistically removed game
      invalidateGameQueries(queryClient, cancellingGameIdRef.current);
      isCancellingRef.current = false;
      cancellingGameIdRef.current = null;
      resetCancelState();
    }
  }, [cancelWasRejected, finishCancellingGame, resetCancelState, queryClient]);

  // Handle create game rejection - reset UI and mark pending tx as failed
  useEffect(() => {
    if (createWasRejected && mountedRef.current) {
      devLog.log('🎮 Create game rejected by user, resetting UI');
      if (pendingTxIdRef.current) {
        markDbTxFailed(pendingTxIdRef.current, 'User rejected');
        pendingTxIdRef.current = null;
      }
      handleReset();
    }
  }, [createWasRejected, handleReset, markDbTxFailed]);

  // Handle create game error - mark pending tx as failed and rollback optimistic update
  useEffect(() => {
    if (error && mountedRef.current) {
      devLog.log('🎮 Create game error, marking pending tx as failed');
      if (pendingTxIdRef.current) {
        markDbTxFailed(pendingTxIdRef.current, error.message || 'Transaction failed');
        pendingTxIdRef.current = null;
      }
      // Rollback optimistic game if we had a txHash
      if (txHash) {
        rollbackOptimisticCreate(txHash);
      }
    }
  }, [error, txHash, markDbTxFailed, rollbackOptimisticCreate]);

  // Create optimistic game when txHash is available
  useEffect(() => {
    if (txHash && selectedTier !== null && coinChoice !== null && currentTier) {
      devLog.log('🎮 Transaction submitted, creating optimistic game');
      // Create optimistic game for instant UI feedback
      optimisticCreateGame(txHash, selectedTier, coinChoice, currentTier.amount);
    }
  }, [txHash, selectedTier, coinChoice, currentTier, optimisticCreateGame]);

  // Reset matched ref when tracked game changes
  useEffect(() => {
    if (trackedGame?.status === 'pending') {
      isMatchedRef.current = false;
    } else if (trackedGame?.status === 'matched' || trackedGame?.status === 'resolved') {
      isMatchedRef.current = true;
    }
  }, [trackedGame?.status]);

  const handleCreateGame = useCallback(async () => {
    if (selectedTier === null || coinChoice === null || !currentTier) return;
    if (!canCreate) {
      devLog.warn('Cannot create game - at max concurrent games');
      return;
    }
    setStep(GameStep.CREATING);
    isMatchedRef.current = false;
    isCancellingRef.current = false;

    // Add pending transaction to DB (persists across refreshes)
    try {
      const pendingTx = await addDbPendingTx({
        tx_type: 'create',
        tier: selectedTier,
        choice: coinChoice,
        amount_eth: currentTier.amount,
      });
      if (pendingTx) {
        pendingTxIdRef.current = pendingTx.id;
      }
    } catch (err) {
      devLog.warn('Failed to save pending tx to DB:', err);
    }

    createGame(selectedTier, coinChoice, currentTier.amount);
  }, [selectedTier, coinChoice, currentTier, createGame, canCreate, addDbPendingTx]);

  const handleCancelGame = useCallback(() => {
    if (!trackedGame?.id) return;

    if (isCancellingRef.current || isGameCancelling(trackedGame.id)) {
      devLog.warn('Cancel already in progress');
      return;
    }
    if (isMatchedRef.current || trackedGame.status !== 'pending') {
      devLog.warn('Cannot cancel - game is no longer pending:', trackedGame.status);
      return;
    }

    // Confirmation dialog
    if (!confirm('Cancel this game and get your bet refunded?')) {
      return;
    }

    isCancellingRef.current = true;
    cancellingGameIdRef.current = trackedGame.id;
    // Optimistic UI update - mark as cancelling immediately
    startCancellingGame(trackedGame.id);
    // Optimistically remove from pending games cache for instant UI update
    removeGameFromPendingCache(queryClient, trackedGame.id);
    cancelGame(trackedGame.id);
  }, [trackedGame, cancelGame, startCancellingGame, isGameCancelling, queryClient]);

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
  const getCancelErrorMessage = (err: Error | null): { title: string; message: string; isMatchedError: boolean } => {
    if (!err) return { title: '', message: '', isMatchedError: false };
    const msg = err.message.toLowerCase();

    if (msg.includes('user rejected') || msg.includes('user denied')) {
      return {
        title: 'Transaction Cancelled',
        message: 'You cancelled the transaction in your wallet.',
        isMatchedError: false,
      };
    }
    if (msg.includes('not creator') || msg.includes('unauthorized')) {
      return {
        title: 'Unauthorized',
        message: 'Only the game creator can cancel this game.',
        isMatchedError: false,
      };
    }
    if (msg.includes('not pending') || msg.includes('already matched') || msg.includes('invalidgamestate')) {
      return {
        title: 'Good News!',
        message: 'Your game was just matched with an opponent! The coin flip is starting.',
        isMatchedError: true,
      };
    }
    if (msg.includes('gas') || msg.includes('execution reverted')) {
      return {
        title: 'Game Already Matched',
        message: 'Someone joined your game! The coin flip should start any moment.',
        isMatchedError: true,
      };
    }
    return {
      title: 'Cancel Failed',
      message: 'Unable to cancel. The game may have already been joined.',
      isMatchedError: false,
    };
  };

  // Determine if cancel button should be disabled
  const isCancelDisabled = isCancelling || isMatchedRef.current || trackedGame?.status !== 'pending';

  // Update step based on selection
  const canProceedToChooseSide = selectedTier !== null;
  const canProceedToConfirm = selectedTier !== null && coinChoice !== null;

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
                      <Flex align="center" gap="2">
                        <Heading size="5">Confirm Your Game</Heading>
                        {isQuickRebet && lastGameSettings && (
                          <Badge color={lastGameSettings.wasWin ? 'green' : 'orange'} size="2">
                            <Zap className="w-3 h-3 mr-1" />
                            Quick Re-bet
                          </Badge>
                        )}
                      </Flex>

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
                          <Text size="1" color="gray">{PLATFORM_FEE_PERCENT}% on wins</Text>
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
                      <Button size="4" className="flex-1 glow-cyan hover:scale-105 transition-transform" onClick={handleCreateGame} disabled={!canCreate || isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Creating...
                          </>
                        ) : (
                          'Create Game'
                        )}
                      </Button>
                    </Flex>
                  </>
                )}

                {/* Step 4: Creating/Waiting */}
                {(step === GameStep.CREATING || step === GameStep.WAITING) && (
                  <Flex direction="column" gap="4" align="center" py="6">
                    {/* Creation Progress Steps */}
                    {!trackedGame && (
                      <Card className="w-full max-w-md card-simple mb-4">
                        <Flex direction="column" gap="3" p="4">
                          {/* Step 1: Wallet */}
                          <Flex align="center" gap="3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isSuccess ? 'bg-green-500/20 text-green-400' : isLoading ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {isSuccess ? <CheckCircle2 className="w-5 h-5" /> : isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '1'}
                            </div>
                            <Flex direction="column">
                              <Text size="2" weight="bold" className={isSuccess ? 'text-green-400' : isLoading ? 'text-cyan-400' : 'text-gray-400'}>
                                Confirm in Wallet
                              </Text>
                              {isLoading && <Text size="1" color="gray">Waiting for signature...</Text>}
                              {isSuccess && <Text size="1" className="text-green-400">Signed</Text>}
                            </Flex>
                          </Flex>

                          {/* Step 2: Blockchain */}
                          <Flex align="center" gap="3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              isSuccess && !isSearching ? 'bg-green-500/20 text-green-400' : isSuccess && isSearching ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {isSuccess && !isSearching ? <CheckCircle2 className="w-5 h-5" /> : isSuccess && isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : '2'}
                            </div>
                            <Flex direction="column">
                              <Text size="2" weight="bold" className={isSuccess ? (isSearching ? 'text-yellow-400' : 'text-green-400') : 'text-gray-400'}>
                                Broadcasting to Blockchain
                              </Text>
                              {isSuccess && isSearching && <Text size="1" color="gray">Waiting for blockchain confirmation...</Text>}
                              {isSuccess && !isSearching && <Text size="1" className="text-green-400">Confirmed</Text>}
                            </Flex>
                          </Flex>

                          {/* Step 3: Indexing */}
                          <Flex align="center" gap="3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              trackedGame ? 'bg-green-500/20 text-green-400' : isSuccess && isSearching ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {trackedGame ? <CheckCircle2 className="w-5 h-5" /> : isSuccess && isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : '3'}
                            </div>
                            <Flex direction="column">
                              <Text size="2" weight="bold" className={trackedGame ? 'text-green-400' : isSuccess && isSearching ? 'text-cyan-400' : 'text-gray-400'}>
                                Syncing to Database
                              </Text>
                              {isSuccess && isSearching && !trackedGame && <Text size="1" color="gray">Almost there...</Text>}
                              {trackedGame && <Text size="1" className="text-green-400">Synced</Text>}
                            </Flex>
                          </Flex>
                        </Flex>
                      </Card>
                    )}

                    {/* Main content based on phase */}
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

                    {isSuccess && isSearching && !trackedGame && (
                      <div className="animate-fade-in">
                        <Flex direction="column" gap="4" align="center">
                          <Loader2 className="w-16 h-16 text-yellow-400 animate-spin" />
                          <Heading size="5" className="text-gradient-gold">Transaction Confirmed!</Heading>
                          <Text size="2" color="gray" align="center">
                            Syncing game to database...
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
                                <Text size="2" weight="bold" className="font-mono">{formatGameId(trackedGame.id)}</Text>
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
                            <div className={`w-2 h-2 rounded-full ${trackingPhase === 'waiting_indexer' ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`} />
                            <Text size="1" color="gray">
                              {trackingPhase === 'waiting_indexer' ? 'Waiting for confirmation...' :
                               trackingPhase === 'found' ? 'Game found!' : 'Connecting...'}
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
                              Cancel & Refund
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
                            <Card className={`w-full max-w-sm ${getCancelErrorMessage(cancelError).isMatchedError ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                              <Flex direction="column" gap="2" p="3" align="center">
                                <Flex align="center" gap="2">
                                  {getCancelErrorMessage(cancelError).isMatchedError ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-red-400" />
                                  )}
                                  <Text size="2" className={getCancelErrorMessage(cancelError).isMatchedError ? 'text-green-400' : 'text-red-400'} weight="bold">
                                    {getCancelErrorMessage(cancelError).title}
                                  </Text>
                                </Flex>
                                <Text size="1" color="gray" align="center">
                                  {getCancelErrorMessage(cancelError).message}
                                </Text>
                              </Flex>
                            </Card>
                          )}

                          {/* Info */}
                          <Text size="1" color="gray" align="center" style={{ maxWidth: '320px' }}>
                            {canCreate
                              ? "Cancel anytime for instant refund, or auto-refund in 5 min. Create more games while waiting!"
                              : "Cancel anytime for instant refund. If no one joins, Chainlink auto-refunds after 5 minutes."}
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
