'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useSearchParams } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Container, Section, Flex, Heading, Text } from '@radix-ui/themes';
import { AppLayout } from '@/components/layout/AppLayout';
import { TierSelector } from '@/components/game/TierSelector';
import { CoinChoice } from '@/components/game/CoinChoice';
import { useGameStore, MAX_CONCURRENT_GAMES, useSelectedTier, useCoinChoice } from '@/store/gameStore';
import { useCreateGame, useCancelGame } from '@/hooks/useContract';
import { useTiers } from '@/hooks/useTiers';
import { useCreatedGameTracking } from '@/hooks/useCreatedGameTracking';
import { useOptimisticUpdates } from '@/hooks/useOptimisticUpdates';
import {
  Info, Loader2, CheckCircle2, AlertCircle, Clock,
  Users, X, Plus, Gamepad2, Zap, Activity,
} from 'lucide-react';
import { parseError } from '@/lib/errors';
import { formatGameId, devLog } from '@/lib/utils';
import { PLATFORM_FEE_PERCENT } from '@/lib/constants';
import { Game } from '@/types/game';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateGameQueries, removeGameFromPendingCache } from '@/lib/queryUtils';
import { showToast } from '@/lib/toast';
import { playSound } from '@/lib/sounds';
import { usePendingTransactions, useGameLimits } from '@/hooks/usePendingTransactions';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useNotificationState } from '@/hooks/useNotificationState';
import { usePendingByTier, useTierMatchTimes, getEstimatedMatchTime } from '@/hooks/useRealtimeStats';
import { useDataMode, useFeature } from '@/lib/data';

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

  const dataMode = useDataMode();
  const hasRealtime = useFeature('realtime');
  const isCentralizedMode = dataMode === 'supabase';
  const selectedTier = useSelectedTier();
  const coinChoice = useCoinChoice();
  const { resetGameCreation, addActiveGame, updateActiveGame, queueModal } = useGameStore();

  const [isCancellingGame, setIsCancellingGame] = useState(false);

  const { activeGamesCount, canCreateNewGame, confirmedActiveCount: pendingGamesCount } = useGameLimits();

  const { addPendingTransaction: addDbPendingTx, markConfirmed: markDbTxConfirmed, markFailed: markDbTxFailed } = usePendingTransactions();
  const { lastGameSettings } = useUserPreferences();
  const { markModalShown } = useNotificationState();

  const pendingTxIdRef = useRef<number | null>(null);
  const { createGame, isLoading, isSuccess, txHash, error, wasRejected: createWasRejected, reset: resetCreateGame } = useCreateGame();
  const { cancelGame, isLoading: isCancelling, error: cancelError, isSuccess: cancelSuccess, wasRejected: cancelWasRejected, reset: resetCancelState } = useCancelGame();
  const { data: tiers } = useTiers();
  const queryClient = useQueryClient();
  const { optimisticCreateGame, rollbackOptimisticCreate, removeOptimisticGame } = useOptimisticUpdates();

  usePendingByTier();
  const { data: matchTimes } = useTierMatchTimes();

  const isCancellingRef = useRef(false);
  const isMatchedRef = useRef(false);
  const mountedRef = useRef(true);
  const cancelTrackingRef = useRef<(() => void) | null>(null);
  const cancellingGameIdRef = useRef<string | null>(null);

  const currentTier = useMemo(() => tiers?.find((t) => t.id === selectedTier), [tiers, selectedTier]);
  const canCreate = canCreateNewGame;

  const handleReset = useCallback(() => {
    if (!mountedRef.current) return;
    resetGameCreation();
    setStep(GameStep.SELECT_TIER);
    isCancellingRef.current = false;
    isMatchedRef.current = false;
    resetCancelState();
    resetCreateGame?.();
    if (pendingTxIdRef.current) {
      markDbTxFailed(pendingTxIdRef.current, 'User cancelled');
      pendingTxIdRef.current = null;
    }
  }, [resetGameCreation, resetCancelState, resetCreateGame, markDbTxFailed]);

  const handleGameFound = useCallback((game: Game) => {
    if (!mountedRef.current) return;
    devLog.log('🎮 Game found in database:', game.id);
    if (pendingTxIdRef.current) { markDbTxConfirmed(pendingTxIdRef.current); pendingTxIdRef.current = null; }
    if (game.tx_hash) removeOptimisticGame(game.tx_hash);
    addActiveGame(game);
    showToast.gameCreated(formatGameId(game.id));
    playSound.success();
  }, [addActiveGame, markDbTxConfirmed, removeOptimisticGame]);

  const handleGameMatched = useCallback((game: Game) => {
    if (!mountedRef.current) return;
    isMatchedRef.current = true;
    devLog.log('🎮 Game matched! Queueing modal...');
    updateActiveGame(game);
    markModalShown(game.id, 'matched');
    queueModal(game, 'matched');
    setTimeout(() => {
      if (mountedRef.current) { cancelTrackingRef.current?.(); resetGameCreation(); setStep(GameStep.SELECT_TIER); }
    }, 500);
  }, [updateActiveGame, queueModal, resetGameCreation, markModalShown]);

  const handleGameResolved = useCallback((game: Game) => {
    if (!mountedRef.current) return;
    devLog.log('🎮 Game resolved:', game.winner_address);
    updateActiveGame(game);
    markModalShown(game.id, 'resolved');
    queueModal(game, 'resolved');
    cancelTrackingRef.current?.();
    resetGameCreation();
    setStep(GameStep.SELECT_TIER);
  }, [updateActiveGame, queueModal, resetGameCreation, markModalShown]);

  const handleGameCancelled = useCallback((_game: Game) => {
    if (!mountedRef.current) return;
    devLog.log('🎮 Game cancelled');
    if (pendingTxIdRef.current) { markDbTxConfirmed(pendingTxIdRef.current); pendingTxIdRef.current = null; }
    handleReset();
  }, [handleReset, markDbTxConfirmed]);

  const {
    game: trackedGame, isSearching, phase: trackingPhase, elapsedSeconds, cancelTracking,
  } = useCreatedGameTracking({
    txHash: isSuccess ? txHash : undefined,
    creatorAddress: address,
    onGameFound: handleGameFound,
    onGameMatched: handleGameMatched,
    onGameResolved: handleGameResolved,
    onGameCancelled: handleGameCancelled,
  });

  cancelTrackingRef.current = cancelTracking;

  const quickRebetHandledRef = useRef(false);
  useEffect(() => {
    if (isQuickRebet && lastGameSettings && !quickRebetHandledRef.current && canCreate) {
      quickRebetHandledRef.current = true;
      setStep(GameStep.CONFIRM);
      showToast.info('Quick re-bet: Same tier and choice loaded!');
    }
  }, [isQuickRebet, lastGameSettings, canCreate]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; cancelTracking(); };
  }, [cancelTracking]);

  useEffect(() => {
    if (cancelSuccess && mountedRef.current && cancellingGameIdRef.current) {
      const gameId = cancellingGameIdRef.current;
      devLog.log('🎮 Game cancelled successfully:', gameId);
      setIsCancellingGame(false);
      invalidateGameQueries(queryClient, gameId);
      showToast.success('Game cancelled - bet refunded');
      cancellingGameIdRef.current = null;
      cancelTracking();
      handleReset();
    }
  }, [cancelSuccess, cancelTracking, handleReset, queryClient]);

  useEffect(() => {
    if (cancelError && mountedRef.current && cancellingGameIdRef.current) {
      devLog.log('🎮 Game cancel failed, reverting');
      setIsCancellingGame(false);
      invalidateGameQueries(queryClient, cancellingGameIdRef.current);
      isCancellingRef.current = false;
      cancellingGameIdRef.current = null;
    }
  }, [cancelError, queryClient]);

  useEffect(() => {
    if (cancelWasRejected && mountedRef.current && cancellingGameIdRef.current) {
      devLog.log('🎮 Cancel rejected by user, reverting UI for game:', cancellingGameIdRef.current);
      setIsCancellingGame(false);
      invalidateGameQueries(queryClient, cancellingGameIdRef.current);
      isCancellingRef.current = false;
      cancellingGameIdRef.current = null;
      resetCancelState();
    }
  }, [cancelWasRejected, resetCancelState, queryClient]);

  useEffect(() => {
    if (createWasRejected && mountedRef.current) {
      devLog.log('🎮 Create game rejected by user, resetting UI');
      if (pendingTxIdRef.current) { markDbTxFailed(pendingTxIdRef.current, 'User rejected'); pendingTxIdRef.current = null; }
      handleReset();
    }
  }, [createWasRejected, handleReset, markDbTxFailed]);

  useEffect(() => {
    if (error && mountedRef.current) {
      devLog.log('🎮 Create game error, marking pending tx as failed');
      if (pendingTxIdRef.current) { markDbTxFailed(pendingTxIdRef.current, error.message || 'Transaction failed'); pendingTxIdRef.current = null; }
      if (txHash) rollbackOptimisticCreate(txHash);
    }
  }, [error, txHash, markDbTxFailed, rollbackOptimisticCreate]);

  useEffect(() => {
    if (txHash && selectedTier !== null && coinChoice !== null && currentTier) {
      devLog.log('🎮 Transaction submitted, creating optimistic game');
      optimisticCreateGame(txHash, selectedTier, coinChoice, currentTier.amount);
    }
  }, [txHash, selectedTier, coinChoice, currentTier, optimisticCreateGame]);

  useEffect(() => {
    if (trackedGame?.status === 'pending') isMatchedRef.current = false;
    else if (trackedGame?.status === 'matched' || trackedGame?.status === 'resolved') isMatchedRef.current = true;
  }, [trackedGame?.status]);

  const handleCreateGame = useCallback(async () => {
    if (selectedTier === null || coinChoice === null || !currentTier) return;
    if (!canCreate) { devLog.warn('Cannot create game - at max concurrent games'); return; }
    setStep(GameStep.CREATING);
    isMatchedRef.current = false;
    isCancellingRef.current = false;
    try {
      const pendingTx = await addDbPendingTx({ tx_type: 'create', tier: selectedTier, choice: coinChoice, amount_eth: currentTier.amount });
      if (pendingTx) pendingTxIdRef.current = pendingTx.id;
    } catch (err) { devLog.warn('Failed to save pending tx to DB:', err); }
    createGame(selectedTier, coinChoice, currentTier.amount);
  }, [selectedTier, coinChoice, currentTier, createGame, canCreate, addDbPendingTx]);

  const handleCancelGame = useCallback(() => {
    if (!trackedGame?.id) return;
    if (isCancellingRef.current || isCancellingGame) { devLog.warn('Cancel already in progress'); return; }
    if (isMatchedRef.current || trackedGame.status !== 'pending') { devLog.warn('Cannot cancel - game is no longer pending:', trackedGame.status); return; }
    if (!confirm('Cancel this game and get your bet refunded?')) return;
    isCancellingRef.current = true;
    cancellingGameIdRef.current = trackedGame.id;
    setIsCancellingGame(true);
    removeGameFromPendingCache(queryClient, trackedGame.id);
    cancelGame(trackedGame.id);
  }, [trackedGame, cancelGame, isCancellingGame, queryClient]);

  const handleCreateAnother = useCallback(() => { cancelTracking(); handleReset(); }, [cancelTracking, handleReset]);

  const formatElapsedTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const getCancelErrorMessage = (err: Error | null): { title: string; message: string; isMatchedError: boolean } => {
    if (!err) return { title: '', message: '', isMatchedError: false };
    const msg = err.message.toLowerCase();
    if (msg.includes('user rejected') || msg.includes('user denied')) return { title: 'Transaction Cancelled', message: 'You cancelled the transaction in your wallet.', isMatchedError: false };
    if (msg.includes('not creator') || msg.includes('unauthorized')) return { title: 'Unauthorized', message: 'Only the game creator can cancel this game.', isMatchedError: false };
    if (msg.includes('not pending') || msg.includes('already matched') || msg.includes('invalidgamestate')) return { title: 'Good News!', message: 'Your game was just matched with an opponent! The coin flip is starting.', isMatchedError: true };
    if (msg.includes('gas') || msg.includes('execution reverted')) return { title: 'Game Already Matched', message: 'Someone joined your game! The coin flip should start any moment.', isMatchedError: true };
    return { title: 'Cancel Failed', message: 'Unable to cancel. The game may have already been joined.', isMatchedError: false };
  };

  const isCancelDisabled = isCancelling || isMatchedRef.current || trackedGame?.status !== 'pending';
  const canProceedToChooseSide = selectedTier !== null;
  const canProceedToConfirm = selectedTier !== null && coinChoice !== null;

  void hasRealtime;

  if (!isConnected) {
    return (
      <AppLayout title="Play" description="Connect your wallet to start playing">
        <Section size="3">
          <Container size="2">
            <div className="flex flex-col items-center justify-center py-24">
              <div
                className="w-full max-w-md rounded-2xl p-8 flex flex-col items-center gap-5"
                style={{ background: 'rgba(5,8,22,0.8)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Heading size="6" className="text-white">Connect Your Wallet</Heading>
                <Text size="3" color="gray" align="center">Please connect your Web3 wallet to start playing</Text>
                <ConnectButton />
              </div>
            </div>
          </Container>
        </Section>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Play" description="Create a new game and start playing">
      <Section size="3">
        <Container size="3">
          <Flex direction="column" gap="6" py="6">
            {/* Header */}
            <div className="flex flex-col items-center gap-2 animate-fade-in">
              <h1
                className="text-4xl font-black"
                style={{ background: 'linear-gradient(135deg, #67e8f9, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                Create a Game
              </h1>
              <div className="flex items-center gap-3">
                <p className="text-slate-400">Choose your bet amount, pick a side, and let's flip!</p>
                {activeGamesCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-cyan-300"
                    style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)' }}>
                    <Gamepad2 className="w-3 h-3" /> {activeGamesCount} Active
                  </span>
                )}
              </div>
            </div>

            {/* Max games warning */}
            {!canCreate && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
                <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span className="text-sm text-orange-200">
                  You have {MAX_CONCURRENT_GAMES} active games. Wait for one to complete before creating another.
                </span>
              </div>
            )}

            {/* Step Indicators */}
            <div
              className="rounded-2xl px-6 py-4 flex items-center justify-center gap-4 flex-wrap animate-slide-down"
              style={{ background: 'rgba(5,8,22,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(168,85,247,0.2)' }}
            >
              <StepIndicator number={1} label="Select Tier" active={step === GameStep.SELECT_TIER} completed={selectedTier !== null} />
              <div className="w-8 h-px hidden sm:block" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <StepIndicator number={2} label="Choose Side" active={step === GameStep.CHOOSE_SIDE} completed={coinChoice !== null} />
              <div className="w-8 h-px hidden sm:block" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <StepIndicator number={3} label="Confirm" active={step === GameStep.CONFIRM} completed={step === GameStep.CREATING || step === GameStep.WAITING} />
            </div>

            {/* Step Content */}
            <div
              className="rounded-2xl p-6 sm:p-8 flex flex-col gap-6"
              style={{ background: 'rgba(5,8,22,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
            >
              {/* Step 1: Select Tier */}
              {step === GameStep.SELECT_TIER && (
                <>
                  <TierSelector />
                  <GradientButton
                    disabled={!canProceedToChooseSide || !canCreate}
                    onClick={() => setStep(GameStep.CHOOSE_SIDE)}
                  >
                    Next: Choose Your Side
                  </GradientButton>
                </>
              )}

              {/* Step 2: Choose Side */}
              {step === GameStep.CHOOSE_SIDE && (
                <>
                  <CoinChoice />
                  <div className="flex gap-3">
                    <GhostButton onClick={() => setStep(GameStep.SELECT_TIER)}>Back</GhostButton>
                    <GradientButton className="flex-1" disabled={!canProceedToConfirm} onClick={() => setStep(GameStep.CONFIRM)}>
                      Next: Confirm
                    </GradientButton>
                  </div>
                </>
              )}

              {/* Step 3: Confirm */}
              {step === GameStep.CONFIRM && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-white">Confirm Your Game</h2>
                    {isQuickRebet && lastGameSettings && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: lastGameSettings.wasWin ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)',
                          border: lastGameSettings.wasWin ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(249,115,22,0.3)',
                          color: lastGameSettings.wasWin ? '#86efac' : '#fdba74',
                        }}>
                        <Zap className="w-3 h-3" /> Quick Re-bet
                      </span>
                    )}
                  </div>

                  {/* Game summary */}
                  <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <ConfirmRow label="Bet Amount" value={`$${currentTier?.amountUsd}`} />
                    <ConfirmRow label="Your Choice" value={coinChoice ? 'Tails 🪙' : 'Heads 👑'} />
                    <ConfirmRow label="Opponent Gets" value={!coinChoice ? 'Tails 🪙' : 'Heads 👑'} muted />
                    <ConfirmRow label="Potential Win" value={`$${currentTier?.winAmountUsd}`} highlight />
                    <ConfirmRow label="Platform Fee" value={`${PLATFORM_FEE_PERCENT}% on wins`} small />
                  </div>

                  {/* Info box */}
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                    style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)' }}>
                    <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-300">
                      <p className="font-semibold text-cyan-300 mb-1">What Happens Next:</p>
                      <p className="leading-relaxed text-slate-400">
                        1. Your game enters the queue<br />
                        2. Another player joins (gets opposite side)<br />
                        3. Chainlink VRF flips the coin (10-30 seconds)<br />
                        4. Winner gets paid automatically!
                      </p>
                      <p className="text-xs text-slate-500 mt-2 italic">You can create up to {MAX_CONCURRENT_GAMES} games at once!</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <GhostButton onClick={() => setStep(GameStep.CHOOSE_SIDE)}>Back</GhostButton>
                    <GradientButton className="flex-1" onClick={handleCreateGame} disabled={!canCreate || isLoading}>
                      {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Game'}
                    </GradientButton>
                  </div>
                </div>
              )}

              {/* Step 4: Creating / Waiting */}
              {(step === GameStep.CREATING || step === GameStep.WAITING) && (
                <div className="flex flex-col items-center gap-6 py-4">
                  {/* Progress steps */}
                  {!trackedGame && (
                    <div className="w-full max-w-md rounded-xl p-4 flex flex-col gap-3"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <ProgressStep
                        label="Confirm in Wallet" sublabel={isLoading ? 'Waiting for signature...' : isSuccess ? 'Signed' : ''}
                        state={isSuccess ? 'done' : isLoading ? 'active' : 'pending'} number={1} />
                      <ProgressStep
                        label="Broadcasting to Blockchain"
                        sublabel={isSuccess && isSearching ? 'Confirming...' : isSuccess && !isSearching ? 'Confirmed' : ''}
                        state={isSuccess && !isSearching ? 'done' : isSuccess && isSearching ? 'active' : 'pending'} number={2} />
                      {isCentralizedMode && (
                        <ProgressStep
                          label="Syncing to Database"
                          sublabel={trackedGame ? 'Synced' : isSuccess && isSearching ? 'Almost there...' : ''}
                          state={trackedGame ? 'done' : isSuccess && isSearching ? 'active' : 'pending'} number={3} />
                      )}
                    </div>
                  )}

                  {isLoading && (
                    <div className="flex flex-col items-center gap-4 animate-fade-in">
                      <Loader2 className="w-16 h-16 text-cyan-400 animate-spin" style={{ filter: 'drop-shadow(0 0 16px rgba(6,182,212,0.5))' }} />
                      <h2 className="text-xl font-bold text-cyan-300">Creating Game...</h2>
                      <p className="text-sm text-slate-400 text-center">Please confirm the transaction in your wallet</p>
                    </div>
                  )}

                  {isSuccess && isSearching && !trackedGame && (
                    <div className="flex flex-col items-center gap-4 animate-fade-in">
                      <Loader2 className="w-16 h-16 text-yellow-400 animate-spin" />
                      <h2 className="text-xl font-bold" style={{ background: 'linear-gradient(to right, #fbbf24, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Transaction Confirmed!
                      </h2>
                      <p className="text-sm text-slate-400 text-center">
                        {isCentralizedMode ? 'Syncing game to database...' : 'Waiting for blockchain confirmation...'}
                      </p>
                      {txHash && <p className="text-xs font-mono text-slate-600">TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}</p>}
                    </div>
                  )}

                  {/* Decentralized mode: success after blockchain confirmation */}
                  {!isCentralizedMode && isSuccess && !isSearching && !trackedGame && (
                    <div className="flex flex-col items-center gap-5 animate-slide-up w-full max-w-sm">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-12 h-12 text-green-400" style={{ filter: 'drop-shadow(0 0 12px rgba(34,197,94,0.5))' }} />
                        <h2 className="text-xl font-bold text-green-400">Game Created!</h2>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-cyan-300"
                          style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)' }}>
                          <Zap className="w-3 h-3" /> On Blockchain
                        </span>
                      </div>
                      <div className="w-full rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-sm text-slate-400">Your game is live on the blockchain. Check the Queue page to see available games and wait for an opponent.</p>
                        {txHash && <p className="text-xs font-mono text-slate-600 mt-2">TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}</p>}
                      </div>
                      <div className="flex gap-3">
                        <GhostButton onClick={() => window.location.href = '/queue'}>View Queue</GhostButton>
                        <GradientButton onClick={handleCreateAnother}><Plus className="w-4 h-4" /> Create Another</GradientButton>
                      </div>
                    </div>
                  )}

                  {/* Waiting for opponent */}
                  {isSuccess && trackedGame && trackedGame.status === 'pending' && (
                    <div className="flex flex-col items-center gap-5 animate-slide-up w-full">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-12 h-12 text-green-400" style={{ filter: 'drop-shadow(0 0 12px rgba(34,197,94,0.5))' }} />
                        <h2 className="text-xl font-bold text-green-400">Game Created!</h2>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-cyan-300"
                          style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)' }}>
                          <Users className="w-3 h-3" /> Waiting for Opponent
                        </span>
                      </div>

                      <div className="w-full max-w-sm rounded-xl p-4 flex flex-col gap-3"
                        style={{ background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.2)' }}>
                        <ConfirmRow label="Game ID" value={formatGameId(trackedGame.id)} mono />
                        <ConfirmRow label="Your Choice" value={trackedGame.creator_choice ? 'Tails 🪙' : 'Heads 👑'} />
                        <ConfirmRow label="Bet Amount" value={`$${currentTier?.amountUsd}`} />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-400">Time Waiting</span>
                          <span className="flex items-center gap-1 text-sm font-bold text-cyan-400">
                            <Clock className="w-3 h-3" /> {formatElapsedTime(elapsedSeconds)}
                          </span>
                        </div>
                        {selectedTier !== null && (
                          <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <span className="text-sm text-slate-400">Est. Match Time</span>
                            <span className="flex items-center gap-1 text-sm font-bold text-purple-400">
                              <Activity className="w-3 h-3" /> {getEstimatedMatchTime(matchTimes ?? null, selectedTier).estimate}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${trackingPhase === 'waiting_indexer' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                        <span className="text-xs text-slate-500">
                          {trackingPhase === 'waiting_indexer' ? 'Waiting for confirmation...' :
                           trackingPhase === 'found' ? 'Game found!' : 'Connecting...'}
                        </span>
                      </div>

                      <div className="flex gap-3 flex-wrap justify-center">
                        <button
                          onClick={handleCancelGame}
                          disabled={isCancelDisabled}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer hover:text-red-200"
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                        >
                          {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                          Cancel & Refund
                        </button>
                        {canCreate && (
                          <GradientButton onClick={handleCreateAnother}>
                            <Plus className="w-4 h-4" /> Create Another
                          </GradientButton>
                        )}
                      </div>

                      {cancelError && (() => {
                        const info = getCancelErrorMessage(cancelError);
                        return (
                          <div className="w-full max-w-sm rounded-xl p-3 flex flex-col items-center gap-2"
                            style={{
                              background: info.isMatchedError ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                              border: info.isMatchedError ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)',
                            }}>
                            <div className="flex items-center gap-2">
                              {info.isMatchedError ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                              <span className={`text-sm font-bold ${info.isMatchedError ? 'text-green-400' : 'text-red-400'}`}>{info.title}</span>
                            </div>
                            <p className="text-xs text-slate-400 text-center">{info.message}</p>
                          </div>
                        );
                      })()}

                      <p className="text-xs text-slate-600 text-center max-w-xs">
                        {canCreate ? "Cancel anytime for instant refund, or auto-refund in 5 min. Create more games while waiting!" : "Cancel anytime for instant refund. If no one joins, Chainlink auto-refunds after 5 minutes."}
                      </p>

                      {pendingGamesCount > 1 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-purple-300"
                          style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
                          <Gamepad2 className="w-3 h-3" /> {pendingGamesCount} games waiting for opponents
                        </span>
                      )}
                    </div>
                  )}

                  {/* Game matched */}
                  {isSuccess && trackedGame && trackedGame.status === 'matched' && (
                    <div className="flex flex-col items-center gap-4 animate-slide-up">
                      <Users className="w-16 h-16 text-cyan-400 animate-pulse" style={{ filter: 'drop-shadow(0 0 16px rgba(6,182,212,0.5))' }} />
                      <h2 className="text-xl font-bold text-cyan-300">Opponent Found!</h2>
                      <p className="text-sm text-slate-400 text-center">Opening game session...</p>
                      {canCreate && (
                        <GradientButton onClick={handleCreateAnother} className="mt-4">
                          <Plus className="w-4 h-4" /> Create Another Game
                        </GradientButton>
                      )}
                    </div>
                  )}

                  {/* Game resolved */}
                  {isSuccess && trackedGame && trackedGame.status === 'resolved' && (
                    <div className="flex flex-col items-center gap-4 animate-slide-up">
                      <CheckCircle2 className="w-16 h-16 text-green-400" style={{ filter: 'drop-shadow(0 0 16px rgba(34,197,94,0.5))' }} />
                      <h2 className="text-xl font-bold text-green-400">Game Complete!</h2>
                      <p className="text-sm text-slate-400 text-center">Check the result in the game modal.</p>
                      <GradientButton onClick={handleCreateAnother}><Plus className="w-4 h-4" /> Create New Game</GradientButton>
                    </div>
                  )}

                  {error && (
                    <div className="flex flex-col items-center gap-4 animate-slide-up">
                      <AlertCircle className="w-16 h-16 text-red-400 animate-pulse" />
                      <h2 className="text-xl font-bold text-red-400">{parseError(error).title}</h2>
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-sm text-slate-400 text-center">{parseError(error).message}</p>
                        {parseError(error).suggestion && <p className="text-xs text-slate-500 text-center">{parseError(error).suggestion}</p>}
                      </div>
                      <GradientButton onClick={handleCreateAnother}>Try Again</GradientButton>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Flex>
        </Container>
      </Section>
    </AppLayout>
  );
}

function StepIndicator({ number, label, active, completed }: { number: number; label: string; active: boolean; completed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 transition-all duration-300">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 flex-shrink-0"
        style={
          completed
            ? { background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 0 12px rgba(34,197,94,0.4)' }
            : active
            ? { background: 'rgba(6,182,212,0.15)', border: '2px solid rgba(6,182,212,0.7)', boxShadow: '0 0 12px rgba(6,182,212,0.3)', color: '#67e8f9' }
            : { background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.12)', color: '#64748b' }
        }
      >
        {completed ? <CheckCircle2 className="w-4 h-4 text-white" /> : <span className={completed || active ? 'text-white' : 'text-slate-500'}>{number}</span>}
      </div>
      <span className={`text-sm font-medium transition-colors ${active ? 'text-cyan-400' : completed ? 'text-green-400' : 'text-slate-500'}`}>{label}</span>
    </div>
  );
}

function ProgressStep({ number, label, sublabel, state }: { number: number; label: string; sublabel: string; state: 'pending' | 'active' | 'done' }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-all ${
        state === 'done' ? 'bg-green-500/20 text-green-400' : state === 'active' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/[0.05] text-slate-600'
      }`}>
        {state === 'done' ? <CheckCircle2 className="w-4 h-4" /> : state === 'active' ? <Loader2 className="w-4 h-4 animate-spin" /> : number}
      </div>
      <div className="flex flex-col">
        <span className={`text-sm font-semibold ${state === 'done' ? 'text-green-400' : state === 'active' ? 'text-cyan-400' : 'text-slate-500'}`}>{label}</span>
        {sublabel && <span className={`text-xs ${state === 'done' ? 'text-green-400' : 'text-slate-500'}`}>{sublabel}</span>}
      </div>
    </div>
  );
}

function ConfirmRow({ label, value, highlight, muted, small, mono }: { label: string; value: string; highlight?: boolean; muted?: boolean; small?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`${small ? 'text-xs' : 'text-sm'} text-slate-400`}>{label}:</span>
      <span className={`${small ? 'text-xs' : 'text-sm'} font-bold ${highlight ? 'text-green-400' : muted ? 'text-slate-500' : 'text-slate-200'} ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function GradientButton({ children, onClick, disabled, className = '' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${className}`}
      style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)', boxShadow: disabled ? 'none' : '0 0 20px rgba(6,182,212,0.2)' }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-slate-300 bg-white/[0.05] border border-white/10 hover:bg-white/[0.09] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
    >
      {children}
    </button>
  );
}
