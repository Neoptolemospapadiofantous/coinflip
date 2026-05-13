'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Container, Section, Flex, Heading, Text,
  Table, Dialog, Box, Skeleton, Select, Tooltip,
} from '@radix-ui/themes';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTiers } from '@/hooks/useTiers';
import { useJoinGame } from '@/hooks/useContract';
import { usePendingGames, useGameStats } from '@/hooks/useGames';
import { formatCurrency, formatGameId, devLog } from '@/lib/utils';
import {
  Clock, Users, Loader2, TrendingUp, XCircle, AlertCircle,
  Wifi, WifiOff, Wallet, ChevronLeft, ChevronRight, Filter,
  DollarSign, SortAsc, SortDesc, Zap, CheckCircle2, Plus,
} from 'lucide-react';

const GAMES_PER_PAGE = 10;
import Link from 'next/link';
import { StatusBadge } from '@/components/game/StatusBadge';
import { useCancelGame } from '@/hooks/useContract';
import { useGameStore } from '@/store/gameStore';
import { useGameTimeout, formatGameTimeRemaining, isGameWarning, isGameExpired } from '@/hooks/useGameTimeout';
import { useConnectionStatus } from '@/hooks/useRealtimeSync';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateGameQueries, removeGameFromPendingCache } from '@/lib/queryUtils';
import { showToast } from '@/lib/toast';
import { playSound } from '@/lib/sounds';
import { Game } from '@/types/game';
import { Tier } from '@/types/tier';
import { usePendingTransactions } from '@/hooks/usePendingTransactions';
import { useNotificationState } from '@/hooks/useNotificationState';
import { useDataMode } from '@/lib/data';

type SelectedGame = Game & { tierInfo: Tier };

function parseJoinError(error: Error | null): { title: string; message: string; isExpired?: boolean } {
  if (!error) return { title: '', message: '' };
  const msg = error.message.toLowerCase();
  if (msg.includes('user rejected') || msg.includes('user denied')) return { title: 'Transaction Cancelled', message: 'You cancelled the transaction in your wallet.' };
  if (msg.includes('gamecancelled') || msg.includes('game cancelled') || msg.includes('game expired')) return { title: 'Game Expired', message: 'This game was auto-cancelled because no one joined in time. Try another game!', isExpired: true };
  if (msg.includes('invalidgamestate') || msg.includes('game state') || msg.includes('not open')) return { title: 'Game No Longer Available', message: 'This game was joined by another player or cancelled. Try joining a different game.' };
  if (msg.includes('insufficient') || msg.includes('balance')) return { title: 'Insufficient Balance', message: "You don't have enough funds to join this game." };
  if (msg.includes('gas') || msg.includes('execution reverted')) return { title: 'Transaction Failed', message: 'The game may have been joined by another player or auto-cancelled.' };
  if (msg.includes('network') || msg.includes('connection')) return { title: 'Network Error', message: 'Please check your connection and try again.' };
  return { title: 'Failed to Join', message: error.message };
}

export default function QueuePage() {
  const { isConnected, address } = useAccount();
  const { data: tiers } = useTiers();
  const { data: pendingGames, isLoading: isLoadingGames, refetch } = usePendingGames();
  const { data: gameStats } = useGameStats();
  const { joinGame, isLoading, isConfirming, isSuccess, txHash, error, reset: resetJoinState } = useJoinGame();
  const { cancelGame, isLoading: isCanceling, isSuccess: isCancelSuccess, error: cancelError, wasRejected: cancelWasRejected, reset: resetCancelState } = useCancelGame();
  const { formatTimeRemaining } = useGameTimeout();
  const { isConnected: isLive, isConnecting } = useConnectionStatus();
  const dataMode = useDataMode();
  const isBlockchainMode = dataMode === 'blockchain';
  const [selectedGame, setSelectedGame] = useState<SelectedGame | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [joinedGameId, setJoinedGameId] = useState<string | null>(null);
  const [cancelingGameId, setCancelingGameId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'time' | 'amount'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { addActiveGame, updateActiveGame, queueModal } = useGameStore();

  const { getPendingCreate, getPendingCancel, getPendingJoin, isGameCancelling, isGameJoining, addPendingTransaction, markConfirmed, markFailed } = usePendingTransactions();
  const { markModalShown } = useNotificationState();
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (isSuccess && joinedGameId && selectedGame && address) {
      const pendingJoin = getPendingJoin(joinedGameId);
      if (pendingJoin) markConfirmed(pendingJoin.id);
      invalidateGameQueries(queryClient, joinedGameId);
      const matchedGame: Game = { ...selectedGame, status: 'matched', joiner_address: address as string, joiner_choice: !selectedGame.creator_choice };
      updateActiveGame(matchedGame);
      markModalShown(matchedGame.id, 'matched');
      queueModal(matchedGame, 'matched');
      showToast.gameMatched();
      playSound.match();
      setIsDialogOpen(false);
      setSelectedGame(null);
    }
  }, [isSuccess, joinedGameId, selectedGame, address, queryClient, getPendingJoin, markConfirmed, updateActiveGame, queueModal, markModalShown]);

  useEffect(() => {
    if (error && joinedGameId) {
      const pendingJoin = getPendingJoin(joinedGameId);
      if (pendingJoin) markFailed(pendingJoin.id, error.message || 'Join failed');
    }
  }, [error, joinedGameId, getPendingJoin, markFailed]);

  useEffect(() => {
    if (isCancelSuccess && cancelingGameId) {
      const pendingCancel = getPendingCancel(cancelingGameId);
      if (pendingCancel) markConfirmed(pendingCancel.id);
      invalidateGameQueries(queryClient, cancelingGameId);
      showToast.success('Game cancelled - bet refunded');
      setCancelingGameId(null);
      resetCancelState();
    }
  }, [isCancelSuccess, cancelingGameId, resetCancelState, queryClient, getPendingCancel, markConfirmed]);

  useEffect(() => {
    if (cancelError && cancelingGameId) {
      const pendingCancel = getPendingCancel(cancelingGameId);
      if (pendingCancel) markFailed(pendingCancel.id, cancelError.message || 'Cancel failed');
      setCancelingGameId(null);
      resetCancelState();
      invalidateGameQueries(queryClient);
    }
  }, [cancelError, cancelingGameId, resetCancelState, queryClient, getPendingCancel, markFailed]);

  useEffect(() => {
    if (cancelWasRejected && cancelingGameId) {
      devLog.log('🎮 Cancel rejected by user, reverting UI for game:', cancelingGameId);
      const pendingCancel = getPendingCancel(cancelingGameId);
      if (pendingCancel) markFailed(pendingCancel.id, 'User rejected');
      invalidateGameQueries(queryClient, cancelingGameId);
      setCancelingGameId(null);
      resetCancelState();
    }
  }, [cancelWasRejected, cancelingGameId, resetCancelState, queryClient, getPendingCancel, markFailed]);

  const myPendingGames = useMemo(() => {
    if (!pendingGames || !address) return [];
    const lowerAddress = address.toLowerCase();
    return pendingGames.filter(game => game.creator_address.toLowerCase() === lowerAddress);
  }, [pendingGames, address]);

  const filteredAndSortedGames = useMemo(() => {
    let result = pendingGames?.filter(
      game => game.creator_address.toLowerCase() !== address?.toLowerCase() && !isGameCancelling(game.id) && !isGameJoining(game.id)
    ) || [];
    if (tierFilter !== 'all') result = result.filter(game => game.tier === parseInt(tierFilter));
    result.sort((a, b) => {
      let comparison = sortBy === 'time'
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : Number(b.amount) - Number(a.amount);
      return sortDir === 'asc' ? -comparison : comparison;
    });
    return result;
  }, [pendingGames, address, tierFilter, sortBy, sortDir, isGameCancelling, isGameJoining]);

  const otherPendingGames = filteredAndSortedGames;
  const totalGames = otherPendingGames?.length || 0;
  const totalPages = Math.ceil(totalGames / GAMES_PER_PAGE);
  const paginatedGames = otherPendingGames?.slice(currentPage * GAMES_PER_PAGE, (currentPage + 1) * GAMES_PER_PAGE);

  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) setCurrentPage(totalPages - 1);
  }, [totalPages, currentPage]);

  useEffect(() => {
    const pendingCreate = getPendingCreate();
    if (pendingCreate && myPendingGames && myPendingGames.length > 0) markConfirmed(pendingCreate.id);
  }, [myPendingGames, getPendingCreate, markConfirmed]);

  const handleJoinClick = useCallback((game: Game, tier: Tier) => {
    resetJoinState();
    setJoinedGameId(null);
    setSelectedGame({ ...game, tierInfo: tier });
    setIsDialogOpen(true);
  }, [resetJoinState]);

  const handleConfirmJoin = useCallback(async () => {
    if (selectedGame) {
      const joinerChoice = !selectedGame.creator_choice;
      setJoinedGameId(selectedGame.id);
      const amountEth = (BigInt(selectedGame.tierInfo.amount) / BigInt(10 ** 18)).toString();
      await addPendingTransaction({ tx_type: 'join', game_id: selectedGame.id, tier: selectedGame.tier, choice: joinerChoice, amount_eth: amountEth });
      addActiveGame({ ...selectedGame, joiner_choice: joinerChoice, status: 'pending' });
      joinGame(selectedGame.id, selectedGame.tierInfo.amount);
    }
  }, [selectedGame, joinGame, addActiveGame, addPendingTransaction]);

  const handleCancelGame = useCallback(async (gameId: string) => {
    if (isGameCancelling(gameId) || cancelingGameId === gameId) return;
    resetCancelState();
    if (!confirm('Are you sure you want to cancel this game? You will be refunded.')) return;
    setCancelingGameId(gameId);
    await addPendingTransaction({ tx_type: 'cancel', game_id: gameId });
    removeGameFromPendingCache(queryClient, gameId);
    cancelGame(gameId);
  }, [cancelGame, resetCancelState, isGameCancelling, cancelingGameId, queryClient, addPendingTransaction]);

  const handleDialogClose = useCallback((resetJoinedGame = true) => {
    setIsDialogOpen(false);
    setSelectedGame(null);
    if (resetJoinedGame) setJoinedGameId(null);
  }, []);

  const LiveIndicator = () => (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      {isBlockchainMode ? (
        <><Zap className="w-3 h-3 text-yellow-400" /><span className="text-yellow-400">Blockchain</span></>
      ) : isLive ? (
        <><Wifi className="w-3 h-3 text-green-400" /><span className="text-green-400">Live</span></>
      ) : isConnecting ? (
        <><Loader2 className="w-3 h-3 text-yellow-400 animate-spin" /><span className="text-yellow-400">Connecting...</span></>
      ) : (
        <><WifiOff className="w-3 h-3 text-red-400" /><span className="text-red-400">Offline</span></>
      )}
    </span>
  );

  if (!isConnected) {
    return (
      <AppLayout title="Game Queue" description="Connect your wallet to view and join games">
        <Section size="3">
          <Container size="2">
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-full max-w-md rounded-2xl p-8 flex flex-col items-center gap-5"
                style={{ background: 'rgba(5,8,22,0.8)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Heading size="6" className="text-white">Connect Your Wallet</Heading>
                <Text size="3" color="gray" align="center">Please connect your Web3 wallet to view and join games</Text>
                <ConnectButton />
              </div>
            </div>
          </Container>
        </Section>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Game Queue" description="View and join available games">
      <Section size="3">
        <Container size="3">
          <Flex direction="column" gap="6" py="6">
            {/* Header */}
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-4xl font-black text-white">Game Queue</h1>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-400">Join an existing game or create your own</span>
                <LiveIndicator />
              </div>
            </div>

            {/* Stats Bar */}
            <div className="rounded-2xl px-6 py-4 flex items-center justify-center gap-8 flex-wrap"
              style={{ background: 'rgba(5,8,22,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(6,182,212,0.15)' }}>
              {[
                { label: 'Players Waiting', value: otherPendingGames?.length || 0, icon: <Users className="w-5 h-5 text-yellow-400" />, color: '#fbbf24', glow: 'rgba(234,179,8,0.15)' },
                { label: 'Avg. Duration', value: gameStats?.avg_game_duration_seconds ? `${Math.round(gameStats.avg_game_duration_seconds / 60)}m` : 'N/A', icon: <Clock className="w-5 h-5 text-cyan-400" />, color: '#67e8f9', glow: 'rgba(6,182,212,0.15)' },
                { label: 'Total Games', value: gameStats?.total_games || 0, icon: <TrendingUp className="w-5 h-5 text-purple-400" />, color: '#c4b5fd', glow: 'rgba(168,85,247,0.15)' },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ background: stat.glow }}>{stat.icon}</div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500">{stat.label}</span>
                    <span className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pending wallet approval */}
            {getPendingCreate() && (
              <div className="rounded-2xl p-6 flex flex-col gap-4 animate-pulse-slow"
                style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}>
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-orange-400" />
                  <h3 className="text-lg font-bold text-orange-400">Awaiting Wallet Approval</h3>
                </div>
                <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.15)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-orange-300">New Game</p>
                      <p className="text-xs text-slate-500">Confirm in your wallet to create the game</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-orange-300 animate-pulse"
                      style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>
                      <Loader2 className="w-3 h-3 animate-spin" /> Pending...
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Your choice: {getPendingCreate()?.choice ? 'Tails 🪙' : 'Heads 👑'} · Tier {(getPendingCreate()?.tier ?? 0) + 1}
                  </p>
                  <p className="text-xs text-orange-300/70 mt-1">Please check your wallet (MetaMask) and confirm the transaction.</p>
                </div>
              </div>
            )}

            {/* My Active Games */}
            {myPendingGames && myPendingGames.length > 0 && (
              <div className="rounded-2xl p-6 flex flex-col gap-4"
                style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)' }}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-bold text-yellow-400">Your Active Game</h3>
                </div>

                {myPendingGames.map((game) => {
                  const tier = tiers?.find(t => t.id === game.tier);
                  const isCancellingThis = isGameCancelling(game.id) || cancelingGameId === game.id;

                  return (
                    <div key={game.id}
                      className={`rounded-xl p-4 flex flex-col gap-3 transition-opacity ${isCancellingThis ? 'opacity-60' : ''}`}
                      style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.15)' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-yellow-300">Game {formatGameId(game.id)}</p>
                          <p className="text-xs text-slate-500">{isCancellingThis ? 'Cancelling...' : 'Waiting for opponent...'}</p>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-yellow-300"
                          style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)' }}>
                          ${tier?.amountUsd || game.amount_usd}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-500">Your choice: {game.creator_choice ? 'Tails 🪙' : 'Heads 👑'}</p>
                          <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <Clock className="w-3 h-3" /> Auto-refund in: {formatTimeRemaining(game.id)}
                          </p>
                        </div>
                        {isCancellingThis ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-yellow-300"
                            style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)' }}>
                            <Loader2 className="w-3 h-3 animate-spin" /> Confirming...
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCancelGame(game.id)}
                            disabled={isCanceling || isGameCancelling(game.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-300 disabled:opacity-50 transition-all cursor-pointer hover:text-red-200"
                            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Cancel Now
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-green-400/70">
                        ✓ You can cancel immediately for a full refund. Or wait - Chainlink will auto-refund after 5 minutes if no one joins.
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Available Games */}
            <div className="rounded-2xl p-6 flex flex-col gap-4"
              style={{ background: 'rgba(5,8,22,0.75)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">Available Games</h3>
                  {totalGames > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-purple-300"
                      style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
                      {totalGames}
                    </span>
                  )}
                  <LiveIndicator />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <Select.Root value={tierFilter} onValueChange={setTierFilter}>
                      <Select.Trigger placeholder="All Tiers" />
                      <Select.Content>
                        <Select.Item value="all">All Tiers</Select.Item>
                        {tiers?.map(tier => <Select.Item key={tier.id} value={tier.id.toString()}>${tier.amountUsd}</Select.Item>)}
                      </Select.Content>
                    </Select.Root>
                  </div>

                  <Select.Root value={`${sortBy}-${sortDir}`} onValueChange={(v) => {
                    const [by, dir] = v.split('-') as ['time' | 'amount', 'asc' | 'desc'];
                    setSortBy(by); setSortDir(dir);
                  }}>
                    <Select.Trigger>
                      <Flex align="center" gap="1">
                        {sortDir === 'desc' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />}
                        {sortBy === 'time' ? 'Newest' : 'Highest'}
                      </Flex>
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="time-desc">Newest First</Select.Item>
                      <Select.Item value="time-asc">Oldest First</Select.Item>
                      <Select.Item value="amount-desc">Highest Amount</Select.Item>
                      <Select.Item value="amount-low">Lowest Amount</Select.Item>
                    </Select.Content>
                  </Select.Root>

                  <Link href="/play">
                    <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 bg-white/[0.05] border border-white/10 hover:bg-white/[0.09] hover:text-white transition-all cursor-pointer">
                      <Plus className="w-3.5 h-3.5" /> Create Game
                    </button>
                  </Link>
                </div>
              </div>

              {isLoadingGames ? (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      {['Game ID', 'Status', 'Tier', 'Bet', 'Pot', 'Creator', 'Time', 'Action'].map(h => (
                        <Table.ColumnHeaderCell key={h}>{h}</Table.ColumnHeaderCell>
                      ))}
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {[...Array(5)].map((_, i) => (
                      <Table.Row key={i}>
                        <Table.Cell><Skeleton className="h-4 w-12" /></Table.Cell>
                        <Table.Cell><Skeleton className="h-5 w-16 rounded-full" /></Table.Cell>
                        <Table.Cell><Skeleton className="h-4 w-14" /></Table.Cell>
                        <Table.Cell><Skeleton className="h-4 w-16" /></Table.Cell>
                        <Table.Cell><Skeleton className="h-4 w-16" /></Table.Cell>
                        <Table.Cell><Skeleton className="h-4 w-24" /></Table.Cell>
                        <Table.Cell><Skeleton className="h-4 w-12" /></Table.Cell>
                        <Table.Cell><Skeleton className="h-8 w-16 rounded" /></Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              ) : !otherPendingGames || otherPendingGames.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-16">
                  <p className="text-slate-500">No games waiting for players</p>
                  <Link href="/play">
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white cursor-pointer hover:opacity-90 transition-all"
                      style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)', boxShadow: '0 0 20px rgba(6,182,212,0.2)' }}>
                      Create a Game
                    </button>
                  </Link>
                </div>
              ) : (
                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Game ID</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Tier</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Bet</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Pot</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Creator</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Time Left</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {paginatedGames?.map((game, index) => {
                      const tier = tiers?.find(t => t.id === game.tier);
                      const expired = isGameExpired(game);
                      const warning = isGameWarning(game);

                      return (
                        <Table.Row
                          key={game.id}
                          className={`animate-fade-in transition-colors ${
                            expired ? 'bg-red-500/10 hover:bg-red-500/15 opacity-75' :
                            warning ? 'bg-yellow-500/10 hover:bg-yellow-500/15' :
                            'hover:bg-slate-700/20'
                          }`}
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <Table.Cell>
                            <span className="font-bold text-cyan-400 font-mono">{formatGameId(game.id)}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <StatusBadge status={game.status} size="sm" />
                          </Table.Cell>
                          <Table.Cell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-purple-300"
                              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}>
                              ${tier?.amountUsd || game.amount_usd}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-sm font-medium text-slate-200">{formatCurrency(game.amount)}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <Tooltip content="Total pot size (winner takes 95%)">
                              <span className="flex items-center gap-1 cursor-help">
                                <DollarSign className="w-3 h-3 text-green-400" />
                                <span className="text-sm font-bold text-green-400">{formatCurrency(BigInt(game.amount) * 2n)}</span>
                              </span>
                            </Tooltip>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="text-xs font-mono text-slate-500">
                              {game.creator_address.slice(0, 6)}...{game.creator_address.slice(-4)}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className={`flex items-center gap-1 text-sm ${expired ? 'text-red-400' : warning ? 'text-yellow-400' : 'text-slate-500'}`}>
                              <Clock className="w-3 h-3" />
                              {formatGameTimeRemaining(game)}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            {joinedGameId === game.id ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-yellow-300"
                                style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)' }}>
                                <Loader2 className="w-3 h-3 animate-spin" /> Joining...
                              </span>
                            ) : expired ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-red-300"
                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                                Expiring...
                              </span>
                            ) : (
                              <button
                                onClick={() => handleJoinClick(game, tier!)}
                                disabled={isLoading || isConfirming}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer ${
                                  warning
                                    ? 'text-yellow-300 hover:text-yellow-200'
                                    : 'text-white hover:opacity-90'
                                }`}
                                style={{
                                  background: warning ? 'linear-gradient(135deg, #d97706, #b45309)' : 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                                  boxShadow: warning ? '0 0 12px rgba(217,119,6,0.25)' : '0 0 12px rgba(6,182,212,0.2)',
                                }}
                              >
                                {warning ? 'Join Now!' : 'Join Game'}
                              </button>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Root>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500">
                    Showing {currentPage * GAMES_PER_PAGE + 1}–{Math.min((currentPage + 1) * GAMES_PER_PAGE, totalGames)} of {totalGames}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => p - 1)}
                      disabled={currentPage === 0}
                      className="p-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-500">{currentPage + 1} / {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage >= totalPages - 1}
                      className="p-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Flex>
        </Container>
      </Section>

      {/* Join Dialog */}
      <Dialog.Root open={isDialogOpen} onOpenChange={open => !open && handleDialogClose(true)}>
        <Dialog.Content style={{ maxWidth: 500, background: 'rgba(5,8,22,0.95)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Dialog.Title>Join Game {selectedGame ? formatGameId(selectedGame.id) : ''}</Dialog.Title>
          <Dialog.Description size="2" mb="4">Review the game details and join</Dialog.Description>

          <Flex direction="column" gap="4">
            {/* Game Details */}
            <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Bet Amount:</span>
                <span className="font-bold text-white">${selectedGame?.tierInfo?.amountUsd} ({selectedGame?.tierInfo && formatCurrency(selectedGame.tierInfo.amount)})</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Potential Win:</span>
                <span className="font-bold text-green-400">${selectedGame?.tierInfo?.winAmountUsd}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Creator:</span>
                <span className="font-mono text-slate-300">{selectedGame?.creator_address.slice(0, 6)}...{selectedGame?.creator_address.slice(-4)}</span>
              </div>
            </div>

            {/* Expiry warning */}
            {!isSuccess && !isLoading && selectedGame && isGameWarning(selectedGame) && (
              <div className="rounded-xl px-4 py-3 flex items-start gap-2"
                style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}>
                <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-yellow-400">This game expires soon!</p>
                  <p className="text-xs text-slate-400">Time remaining: {formatGameTimeRemaining(selectedGame)}. Join quickly before it&apos;s auto-cancelled.</p>
                </div>
              </div>
            )}

            {/* Coin sides */}
            {!isSuccess && !isLoading && selectedGame && (
              <div className="rounded-xl p-4 flex flex-col gap-3"
                style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)' }}>
                <h4 className="text-sm font-bold text-center text-white">Coin Sides</h4>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Creator chose:</span>
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-200">
                      <span className="text-xl">{selectedGame.creator_choice ? '🪙' : '👑'}</span>
                      {selectedGame.creator_choice ? 'Tails' : 'Heads'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg" style={{ background: 'rgba(6,182,212,0.12)' }}>
                    <span className="text-sm font-bold text-cyan-400">You will play:</span>
                    <span className="flex items-center gap-2 text-sm font-bold text-cyan-300">
                      <span className="text-xl">{!selectedGame.creator_choice ? '🪙' : '👑'}</span>
                      {!selectedGame.creator_choice ? 'Tails' : 'Heads'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 text-center italic">
                    {!selectedGame.creator_choice ? 'If the coin lands on Tails, you win!' : 'If the coin lands on Heads, you win!'}
                  </p>
                </div>
              </div>
            )}

            {/* Wallet confirmation */}
            {isLoading && !isConfirming && !txHash && (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
                <p className="text-sm font-bold text-yellow-400">Confirm in your wallet...</p>
                <p className="text-xs text-slate-500">Please approve the transaction</p>
              </div>
            )}

            {/* Confirming */}
            {isConfirming && txHash && (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                <p className="text-sm font-bold text-cyan-400">Confirming...</p>
                <p className="text-xs font-mono text-slate-500">TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}</p>
              </div>
            )}

            {/* Success */}
            {isSuccess && (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 className="w-12 h-12 text-green-400" style={{ filter: 'drop-shadow(0 0 12px rgba(34,197,94,0.4))' }} />
                <p className="text-sm font-bold text-green-400">Joined successfully!</p>
                <p className="text-xs text-slate-400 text-center">Chainlink VRF will determine the winner (10-30 seconds)</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl p-3 flex flex-col gap-2"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-bold text-red-400">{parseJoinError(error).title}</span>
                </div>
                <p className="text-sm text-slate-400">{parseJoinError(error).message}</p>
                {parseJoinError(error).title === 'Game No Longer Available' && (
                  <button
                    onClick={() => { resetJoinState(); refetch(); setIsDialogOpen(false); }}
                    className="text-xs text-slate-400 hover:text-slate-200 underline mt-1 cursor-pointer text-left"
                  >
                    Back to Queue
                  </button>
                )}
              </div>
            )}

            {/* Actions */}
            <Box>
              <Flex gap="3" mt="4" justify="end">
                <Dialog.Close>
                  <button className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 bg-white/[0.05] border border-white/10 hover:bg-white/[0.09] hover:text-slate-200 transition-all cursor-pointer">
                    {isSuccess ? 'Close' : 'Cancel'}
                  </button>
                </Dialog.Close>
                {!isSuccess && !isLoading && (
                  <button
                    onClick={handleConfirmJoin}
                    className="px-5 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer hover:opacity-90 transition-all"
                    style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)', boxShadow: '0 0 16px rgba(6,182,212,0.2)' }}
                  >
                    Confirm & Join
                  </button>
                )}
              </Flex>
            </Box>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </AppLayout>
  );
}
