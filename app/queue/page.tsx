'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Badge,
  Table,
  Dialog,
  Box,
  Skeleton,
  Select,
  Tooltip,
} from '@radix-ui/themes';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTiers } from '@/hooks/useTiers';
import { useJoinGame } from '@/hooks/useContract';
import { usePendingGames, useGameStats } from '@/hooks/useGames';
import { formatCurrency, formatGameId, devLog } from '@/lib/utils';
import { Clock, Users, Loader2, TrendingUp, XCircle, AlertCircle, Wifi, WifiOff, Wallet, ChevronLeft, ChevronRight, Filter, DollarSign, SortAsc, SortDesc } from 'lucide-react';

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

// Type for selected game with attached tier info
// Use tierInfo to avoid conflict with Game.tier (which is number)
type SelectedGame = Game & { tierInfo: Tier };

// Note: Games can now be cancelled immediately (no timeout required)

// Helper to parse join game errors into user-friendly messages
function parseJoinError(error: Error | null): { title: string; message: string; isExpired?: boolean } {
  if (!error) return { title: '', message: '' };

  const msg = error.message.toLowerCase();

  // User rejected
  if (msg.includes('user rejected') || msg.includes('user denied')) {
    return {
      title: 'Transaction Cancelled',
      message: 'You cancelled the transaction in your wallet.',
    };
  }

  // Game cancelled/expired (auto-cancel by Chainlink)
  if (msg.includes('gamecancelled') || msg.includes('game cancelled') || msg.includes('game expired')) {
    return {
      title: 'Game Expired',
      message: 'This game was auto-cancelled because no one joined in time. Try another game!',
      isExpired: true,
    };
  }

  // Game already matched (someone else joined)
  if (msg.includes('invalidgamestate') || msg.includes('game state') || msg.includes('not open')) {
    return {
      title: 'Game No Longer Available',
      message: 'This game was joined by another player or cancelled. Try joining a different game.',
    };
  }

  // Insufficient balance
  if (msg.includes('insufficient') || msg.includes('balance')) {
    return {
      title: 'Insufficient Balance',
      message: 'You don\'t have enough funds to join this game.',
    };
  }

  // Gas estimation failed (likely game state changed)
  if (msg.includes('gas') || msg.includes('execution reverted')) {
    return {
      title: 'Transaction Failed',
      message: 'The game may have been joined by another player or auto-cancelled.',
    };
  }

  // Network error
  if (msg.includes('network') || msg.includes('connection')) {
    return {
      title: 'Network Error',
      message: 'Please check your connection and try again.',
    };
  }

  // Default
  return {
    title: 'Failed to Join',
    message: error.message,
  };
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
  const [selectedGame, setSelectedGame] = useState<SelectedGame | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [joinedGameId, setJoinedGameId] = useState<string | null>(null);
  const [cancelingGameId, setCancelingGameId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'time' | 'amount'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { addActiveGame, updateActiveGame, queueModal } = useGameStore();

  // DB-backed pending transactions (persists across refreshes/devices)
  // Now handles cancel/join tracking instead of Zustand
  const {
    getPendingCreate,
    getPendingCancel,
    getPendingJoin,
    isGameCancelling,
    isGameJoining,
    addPendingTransaction,
    markConfirmed,
    markFailed,
  } = usePendingTransactions();

  // DB-backed notification state for deduplication across devices/tabs
  const { markModalShown } = useNotificationState();
  const queryClient = useQueryClient();

  // Refs for cleanup
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Real-time updates are handled centrally by useRealtimeSync (in Providers)
  // Connection status is now managed by useConnectionStatus hook

  // Handle join success - immediately show matched modal (no waiting for realtime)
  useEffect(() => {
    if (isSuccess && joinedGameId && selectedGame && address) {
      // Mark DB pending transaction as confirmed
      const pendingJoin = getPendingJoin(joinedGameId);
      if (pendingJoin) {
        markConfirmed(pendingJoin.id);
      }

      // Immediately invalidate queries for real-time sync
      invalidateGameQueries(queryClient, joinedGameId);

      // Create matched game object with joiner info
      const matchedGame: Game = {
        ...selectedGame,
        status: 'matched',
        joiner_address: address as string,
        joiner_choice: !selectedGame.creator_choice,
      };

      // Update game in store to matched status
      updateActiveGame(matchedGame);

      // Mark as shown in DB BEFORE queuing to prevent duplicates across tabs/refreshes
      markModalShown(matchedGame.id, 'matched');
      queueModal(matchedGame, 'matched');

      // Show success feedback
      showToast.gameMatched();
      playSound.match();

      // Close dialog immediately since modal will show
      setIsDialogOpen(false);
      setSelectedGame(null);
    }
  }, [isSuccess, joinedGameId, selectedGame, address, queryClient, getPendingJoin, markConfirmed, updateActiveGame, queueModal, markModalShown]);

  // Handle join error - mark DB pending transaction as failed
  useEffect(() => {
    if (error && joinedGameId) {
      const pendingJoin = getPendingJoin(joinedGameId);
      if (pendingJoin) {
        markFailed(pendingJoin.id, error.message || 'Join failed');
      }
    }
  }, [error, joinedGameId, getPendingJoin, markFailed]);

  // Handle cancel success - mark DB pending transaction as confirmed
  useEffect(() => {
    if (isCancelSuccess && cancelingGameId) {
      // Mark DB pending cancel transaction as confirmed
      const pendingCancel = getPendingCancel(cancelingGameId);
      if (pendingCancel) {
        markConfirmed(pendingCancel.id);
      }

      // Immediately invalidate all game queries for real-time sync
      invalidateGameQueries(queryClient, cancelingGameId);

      // Show success feedback
      showToast.success('Game cancelled - bet refunded');

      setCancelingGameId(null);
      resetCancelState();
    }
  }, [isCancelSuccess, cancelingGameId, resetCancelState, queryClient, getPendingCancel, markConfirmed]);

  // Handle cancel error - mark DB pending transaction as failed
  useEffect(() => {
    if (cancelError && cancelingGameId) {
      const pendingCancel = getPendingCancel(cancelingGameId);
      if (pendingCancel) {
        markFailed(pendingCancel.id, cancelError.message || 'Cancel failed');
      }
      setCancelingGameId(null);
      resetCancelState();
      // Refresh list to get current state after error
      invalidateGameQueries(queryClient);
    }
  }, [cancelError, cancelingGameId, resetCancelState, queryClient, getPendingCancel, markFailed]);

  // Handle user rejection - mark as failed and revert
  useEffect(() => {
    if (cancelWasRejected && cancelingGameId) {
      devLog.log('🎮 Cancel rejected by user, reverting UI for game:', cancelingGameId);
      const pendingCancel = getPendingCancel(cancelingGameId);
      if (pendingCancel) {
        markFailed(pendingCancel.id, 'User rejected');
      }
      // Refetch pending games to restore the optimistically removed game
      invalidateGameQueries(queryClient, cancelingGameId);
      setCancelingGameId(null);
      resetCancelState();
    }
  }, [cancelWasRejected, cancelingGameId, resetCancelState, queryClient, getPendingCancel, markFailed]);

  // Separate user's games from other games
  // User's games: show even when cancelling (to display cancelling state)
  // Other games: hide when cancelling or joining (optimistic removal)
  const myPendingGames = pendingGames?.filter(
    (game) => game.creator_address.toLowerCase() === address?.toLowerCase()
  );

  // Filter and sort other pending games
  const filteredAndSortedGames = useMemo(() => {
    let result = pendingGames?.filter(
      (game) => game.creator_address.toLowerCase() !== address?.toLowerCase() && !isGameCancelling(game.id) && !isGameJoining(game.id)
    ) || [];

    // Apply tier filter
    if (tierFilter !== 'all') {
      const tierId = parseInt(tierFilter);
      result = result.filter(game => game.tier === tierId);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'time') {
        comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else {
        comparison = Number(b.amount) - Number(a.amount);
      }
      return sortDir === 'asc' ? -comparison : comparison;
    });

    return result;
  }, [pendingGames, address, tierFilter, sortBy, sortDir, isGameCancelling, isGameJoining]);

  const otherPendingGames = filteredAndSortedGames;

  // Pagination for available games
  const totalGames = otherPendingGames?.length || 0;
  const totalPages = Math.ceil(totalGames / GAMES_PER_PAGE);
  const paginatedGames = otherPendingGames?.slice(
    currentPage * GAMES_PER_PAGE,
    (currentPage + 1) * GAMES_PER_PAGE
  );

  // Reset page when games list changes significantly
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [totalPages, currentPage]);

  // Auto-clear pending create transaction when user's game appears
  // This provides instant feedback instead of waiting for DB poll
  useEffect(() => {
    const pendingCreate = getPendingCreate();
    if (pendingCreate && myPendingGames && myPendingGames.length > 0) {
      // Game appeared in the list - mark pending tx as confirmed
      markConfirmed(pendingCreate.id);
    }
  }, [myPendingGames, getPendingCreate, markConfirmed]);

  const handleJoinClick = useCallback((game: Game, tier: Tier) => {
    // Reset any previous join state
    resetJoinState();
    setJoinedGameId(null);
    setSelectedGame({ ...game, tierInfo: tier });
    setIsDialogOpen(true);
  }, [resetJoinState]);

  const handleConfirmJoin = useCallback(async () => {
    if (selectedGame) {
      // Joiner automatically gets opposite of creator's choice (contract enforces this)
      const joinerChoice = !selectedGame.creator_choice;
      setJoinedGameId(selectedGame.id);

      // Create DB pending transaction for join (persists across refresh)
      // Convert wei amount to ETH string for storage
      const amountEth = (BigInt(selectedGame.tierInfo.amount) / BigInt(10 ** 18)).toString();
      await addPendingTransaction({
        tx_type: 'join',
        game_id: selectedGame.id,
        tier: selectedGame.tier,
        choice: joinerChoice,
        amount_eth: amountEth,
      });

      // Add game to active games store immediately for tracking
      addActiveGame({
        ...selectedGame,
        joiner_choice: joinerChoice,
        status: 'pending', // Will update to 'matched' via subscription
      });

      // Note: Contract doesn't take choice param - joiner always bets opposite
      joinGame(selectedGame.id, selectedGame.tierInfo.amount);
    }
  }, [selectedGame, joinGame, addActiveGame, addPendingTransaction]);

  const handleCancelGame = useCallback(async (gameId: string) => {
    // Check if already cancelling (using DB state)
    if (isGameCancelling(gameId) || cancelingGameId === gameId) {
      return;
    }

    // Reset any previous cancel state
    resetCancelState();

    if (!confirm('Are you sure you want to cancel this game? You will be refunded.')) {
      return;
    }

    setCancelingGameId(gameId);

    // Create DB pending transaction for cancel (persists across refresh)
    await addPendingTransaction({
      tx_type: 'cancel',
      game_id: gameId,
    });

    // Optimistically remove from pending games cache for instant UI update
    removeGameFromPendingCache(queryClient, gameId);
    cancelGame(gameId);
  }, [cancelGame, resetCancelState, isGameCancelling, cancelingGameId, queryClient, addPendingTransaction]);

  const handleDialogClose = useCallback((resetJoinedGame = true) => {
    setIsDialogOpen(false);
    setSelectedGame(null);
    if (resetJoinedGame) {
      setJoinedGameId(null);
    }
  }, []);

  // Note: Dialog is now closed immediately on success in the join success handler above
  // This ensures seamless transition to the matched modal

  if (!isConnected) {
    return (
      <AppLayout title="Game Queue" description="Connect your wallet to view and join games">
        <Section size="3">
          <Container size="2">
            <Flex direction="column" align="center" gap="6" py="9">
              <Card className="card-simple" size="4">
                <Flex direction="column" gap="4" p="6" align="center">
                  <Heading size="6">Connect Your Wallet</Heading>
                  <Text size="3" color="gray" align="center">
                    Please connect your Web3 wallet to view and join games
                  </Text>
                  <ConnectButton />
                </Flex>
              </Card>
            </Flex>
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
            <Flex direction="column" gap="2" align="center">
              <Heading size="8">Game Queue</Heading>
              <Flex align="center" gap="3">
                <Text size="3" color="gray">
                  Join an existing game or create your own
                </Text>
                <Flex align="center" gap="1">
                  {isLive ? (
                    <>
                      <Wifi className="w-3 h-3 text-green-400" />
                      <Text size="1" className="text-green-400">Live</Text>
                    </>
                  ) : isConnecting ? (
                    <>
                      <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
                      <Text size="1" className="text-yellow-400">Connecting...</Text>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3 h-3 text-red-400" />
                      <Text size="1" className="text-red-400">Offline</Text>
                    </>
                  )}
                </Flex>
              </Flex>
            </Flex>

            {/* Stats */}
            <Card className="card-solid border-cyan-500/60">
              <Flex gap="6" p="4" justify="center" wrap="wrap">
                <Flex align="center" gap="2" className="animate-slide-up">
                  <Box className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <Users className="w-5 h-5 text-yellow-400" />
                  </Box>
                  <Flex direction="column">
                    <Text size="1" color="gray">
                      Players Waiting
                    </Text>
                    <Text size="5" weight="bold" className="text-gradient-gold">
                      {otherPendingGames?.length || 0}
                    </Text>
                  </Flex>
                </Flex>
                <Flex align="center" gap="2" className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
                  <Box className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <Clock className="w-5 h-5 text-cyan-400" />
                  </Box>
                  <Flex direction="column">
                    <Text size="1" color="gray">
                      Avg. Duration
                    </Text>
                    <Text size="5" weight="bold" className="text-cyan-400">
                      {gameStats?.avg_game_duration_seconds
                        ? `${Math.round(gameStats.avg_game_duration_seconds / 60)}m`
                        : 'N/A'}
                    </Text>
                  </Flex>
                </Flex>
                <Flex align="center" gap="2" className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                  <Box className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                  </Box>
                  <Flex direction="column">
                    <Text size="1" color="gray">
                      Total Games
                    </Text>
                    <Text size="5" weight="bold" className="text-purple-400">
                      {gameStats?.total_games || 0}
                    </Text>
                  </Flex>
                </Flex>
              </Flex>
            </Card>

            {/* Pending Create Transaction (awaiting wallet approval) */}
            {getPendingCreate() && (
              <Card className="card-solid border-orange-500/60 animate-pulse-slow">
                <Flex direction="column" gap="4" p="6">
                  <Flex align="center" gap="2">
                    <Wallet className="w-5 h-5 text-orange-400" />
                    <Heading size="5" className="text-orange-400">Awaiting Wallet Approval</Heading>
                  </Flex>

                  <Card variant="surface" className="bg-orange-500/5 border border-orange-500/20">
                    <Flex direction="column" gap="3" p="4">
                      <Flex justify="between" align="center">
                        <Flex direction="column" gap="1">
                          <Text size="2" weight="bold" className="text-orange-400">
                            New Game
                          </Text>
                          <Text size="1" color="gray">
                            Confirm in your wallet to create the game
                          </Text>
                        </Flex>
                        <Badge color="orange" size="2" className="animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Pending...
                        </Badge>
                      </Flex>

                      <Flex align="center" gap="2">
                        <Text size="1" color="gray">
                          Your choice: {getPendingCreate()?.choice ? 'Tails 🪙' : 'Heads 👑'}
                        </Text>
                        <Text size="1" color="gray">•</Text>
                        <Text size="1" color="gray">
                          Tier {(getPendingCreate()?.tier ?? 0) + 1}
                        </Text>
                      </Flex>

                      <Card variant="surface" className="bg-orange-500/5 border border-orange-500/20">
                        <Flex direction="column" gap="1" p="2">
                          <Text size="1" className="text-orange-300">
                            Please check your wallet (MetaMask) and confirm the transaction.
                            This page will update automatically once confirmed.
                          </Text>
                        </Flex>
                      </Card>
                    </Flex>
                  </Card>
                </Flex>
              </Card>
            )}

            {/* User's Active Game (if any) */}
            {myPendingGames && myPendingGames.length > 0 && (
              <Card className="card-solid border-yellow-500/60 animate-slide-down">
                <Flex direction="column" gap="4" p="6">
                  <Flex align="center" gap="2">
                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                    <Heading size="5" className="text-gradient-gold">Your Active Game</Heading>
                  </Flex>

                  {myPendingGames.map((game) => {
                    const tier = tiers?.find((t) => t.id === game.tier);
                    const isCancellingThis = isGameCancelling(game.id) || cancelingGameId === game.id;

                    return (
                      <Card
                        key={game.id}
                        variant="surface"
                        className={`bg-yellow-500/5 border border-yellow-500/20 transition-opacity ${isCancellingThis ? 'opacity-60' : ''}`}
                      >
                        <Flex direction="column" gap="3" p="4">
                          <Flex justify="between" align="center">
                            <Flex direction="column" gap="1">
                              <Text size="2" weight="bold" className="text-yellow-400">
                                Game {formatGameId(game.id)}
                              </Text>
                              <Text size="1" color="gray">
                                {isCancellingThis ? 'Cancelling...' : 'Waiting for opponent...'}
                              </Text>
                            </Flex>
                            <Badge color="yellow" size="2" className="glow-gold">
                              ${tier?.amountUsd || game.amount_usd}
                            </Badge>
                          </Flex>

                          <Flex justify="between" align="center">
                            <Flex direction="column" gap="1">
                              <Text size="1" color="gray">Your choice: {game.creator_choice ? 'Tails 🪙' : 'Heads 👑'}</Text>
                              <Flex align="center" gap="2">
                                <Clock className="w-3 h-3 text-gray-400" />
                                <Text size="1" color="gray">
                                  Auto-refund in: {formatTimeRemaining(game.id)}
                                </Text>
                              </Flex>
                            </Flex>
                            {isGameCancelling(game.id) || cancelingGameId === game.id ? (
                              <Badge color="yellow" size="2">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Confirming...
                              </Badge>
                            ) : (
                              <Button
                                size="2"
                                variant="soft"
                                color="red"
                                onClick={() => handleCancelGame(game.id)}
                                disabled={isCanceling || isGameCancelling(game.id)}
                              >
                                <XCircle className="w-4 h-4" />
                                Cancel Now
                              </Button>
                            )}
                          </Flex>

                          <Card variant="surface" className="bg-green-500/5 border border-green-500/20">
                            <Flex direction="column" gap="1" p="2">
                              <Text size="1" color="green">
                                ✓ You can cancel immediately for a full refund. Or wait - Chainlink will auto-refund after 5 minutes if no one joins.
                              </Text>
                            </Flex>
                          </Card>
                        </Flex>
                      </Card>
                    );
                  })}
                </Flex>
              </Card>
            )}

            {/* Pending Games */}
            <Card className="card-simple" size="4">
              <Flex direction="column" gap="4" p="6">
                <Flex align="center" justify="between" wrap="wrap" gap="3">
                  <Flex align="center" gap="2">
                    <Heading size="5">Available Games</Heading>
                    {totalGames > 0 && (
                      <Badge size="1" color="purple" variant="soft">{totalGames}</Badge>
                    )}
                    <Badge size="1" color={isLive ? 'green' : isConnecting ? 'yellow' : 'red'} variant="soft">
                      <Flex align="center" gap="1">
                        {isLive ? <Wifi className="w-3 h-3" /> : isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <WifiOff className="w-3 h-3" />}
                        {isLive ? 'Live' : isConnecting ? 'Connecting...' : 'Offline'}
                      </Flex>
                    </Badge>
                  </Flex>

                  {/* Filters */}
                  <Flex align="center" gap="3" wrap="wrap">
                    <Flex align="center" gap="2">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <Select.Root value={tierFilter} onValueChange={setTierFilter}>
                        <Select.Trigger placeholder="All Tiers" />
                        <Select.Content>
                          <Select.Item value="all">All Tiers</Select.Item>
                          {tiers?.map((tier) => (
                            <Select.Item key={tier.id} value={tier.id.toString()}>
                              ${tier.amountUsd}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    </Flex>

                    <Select.Root value={`${sortBy}-${sortDir}`} onValueChange={(v) => {
                      const [by, dir] = v.split('-') as ['time' | 'amount', 'asc' | 'desc'];
                      setSortBy(by);
                      setSortDir(dir);
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
                      <Button variant="soft" size="2" className="cursor-pointer">
                        Create New Game
                      </Button>
                    </Link>
                  </Flex>
                </Flex>

                {isLoadingGames ? (
                  <Table.Root variant="surface">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Game ID</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Tier</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Bet</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Pot</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Creator</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
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
                  <Flex direction="column" gap="4" align="center" py="9">
                    <Text size="4" color="gray">
                      No games waiting for players
                    </Text>
                    <Link href="/play">
                      <Button size="3">Create a Game</Button>
                    </Link>
                  </Flex>
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
                        const tier = tiers?.find((t) => t.id === game.tier);
                        const expired = isGameExpired(game);
                        const warning = isGameWarning(game);

                        return (
                          <Table.Row
                            key={game.id}
                            className={`animate-fade-in transition-colors ${
                              expired
                                ? 'bg-red-500/10 hover:bg-red-500/20 opacity-75'
                                : warning
                                  ? 'bg-yellow-500/10 hover:bg-yellow-500/20'
                                  : 'hover:bg-slate-700/30'
                            }`}
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            <Table.Cell>
                              <Text weight="bold" className="text-cyan-400">{formatGameId(game.id)}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <StatusBadge status={game.status} size="1" />
                            </Table.Cell>
                            <Table.Cell>
                              <Badge color="purple" variant="soft" className="neon-border-purple">
                                ${tier?.amountUsd || game.amount_usd}
                              </Badge>
                            </Table.Cell>
                            <Table.Cell>
                              <Text weight="medium">{formatCurrency(game.amount)}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Tooltip content="Total pot size (winner takes 95%)">
                                <Flex align="center" gap="1">
                                  <DollarSign className="w-3 h-3 text-green-400" />
                                  <Text weight="bold" className="text-green-400">
                                    {formatCurrency(BigInt(game.amount) * 2n)}
                                  </Text>
                                </Flex>
                              </Tooltip>
                            </Table.Cell>
                            <Table.Cell>
                              <Text size="2" className="font-mono text-gray-400">
                                {game.creator_address.slice(0, 6)}...
                                {game.creator_address.slice(-4)}
                              </Text>
                            </Table.Cell>
                            <Table.Cell>
                              {(() => {
                                const expired = isGameExpired(game);
                                const warning = isGameWarning(game);
                                return (
                                  <Flex align="center" gap="1">
                                    <Clock className={`w-3 h-3 ${expired ? 'text-red-400' : warning ? 'text-yellow-400' : 'text-gray-500'}`} />
                                    <Text size="2" className={expired ? 'text-red-400' : warning ? 'text-yellow-400' : 'text-gray-400'}>
                                      {formatGameTimeRemaining(game)}
                                    </Text>
                                  </Flex>
                                );
                              })()}
                            </Table.Cell>
                            <Table.Cell>
                              {joinedGameId === game.id ? (
                                <Badge color="yellow" size="2">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Joining...
                                </Badge>
                              ) : expired ? (
                                <Badge color="red" size="2" variant="soft">
                                  Expiring...
                                </Badge>
                              ) : (
                                <Button
                                  size="2"
                                  onClick={() => handleJoinClick(game, tier!)}
                                  disabled={isLoading || isConfirming}
                                  color={warning ? 'yellow' : undefined}
                                >
                                  {warning ? 'Join Now!' : 'Join Game'}
                                </Button>
                              )}
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Root>
                )}

                {/* Pagination controls */}
                {totalPages > 1 && (
                  <Flex align="center" justify="between" pt="2">
                    <Text size="1" color="gray">
                      Showing {currentPage * GAMES_PER_PAGE + 1}-{Math.min((currentPage + 1) * GAMES_PER_PAGE, totalGames)} of {totalGames}
                    </Text>
                    <Flex align="center" gap="2">
                      <Button
                        size="1"
                        variant="soft"
                        disabled={currentPage === 0}
                        onClick={() => setCurrentPage(p => p - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Text size="1" color="gray">
                        {currentPage + 1} / {totalPages}
                      </Text>
                      <Button
                        size="1"
                        variant="soft"
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setCurrentPage(p => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </Flex>
                  </Flex>
                )}
              </Flex>
            </Card>
          </Flex>
        </Container>
      </Section>

      {/* Join Game Dialog */}
      <Dialog.Root open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose(true)}>
        <Dialog.Content style={{ maxWidth: 500 }}>
          <Dialog.Title>Join Game {selectedGame ? formatGameId(selectedGame.id) : ''}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Review the game details and join
          </Dialog.Description>

          <Flex direction="column" gap="4">
            {/* Game Details */}
            <Card variant="surface">
              <Flex direction="column" gap="2" p="3">
                <Flex justify="between">
                  <Text size="2" color="gray">
                    Bet Amount:
                  </Text>
                  <Text size="2" weight="bold">
                    ${selectedGame?.tierInfo?.amountUsd} (
                    {selectedGame?.tierInfo && formatCurrency(selectedGame.tierInfo.amount)})
                  </Text>
                </Flex>
                <Flex justify="between">
                  <Text size="2" color="gray">
                    Potential Win:
                  </Text>
                  <Text size="2" weight="bold" className="text-green-400">
                    ${selectedGame?.tierInfo?.winAmountUsd}
                  </Text>
                </Flex>
                <Flex justify="between">
                  <Text size="2" color="gray">
                    Creator:
                  </Text>
                  <Text size="2" className="font-mono">
                    {selectedGame?.creator_address.slice(0, 6)}...{selectedGame?.creator_address.slice(-4)}
                  </Text>
                </Flex>
              </Flex>
            </Card>

            {/* Expiry Warning */}
            {!isSuccess && !isLoading && selectedGame && isGameWarning(selectedGame) && (
              <Card variant="surface" className="bg-yellow-500/10 border border-yellow-500/30">
                <Flex align="center" gap="2" p="3">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="bold" className="text-yellow-400">
                      This game expires soon!
                    </Text>
                    <Text size="1" color="gray">
                      Time remaining: {formatGameTimeRemaining(selectedGame)}. Join quickly before it&apos;s auto-cancelled.
                    </Text>
                  </Flex>
                </Flex>
              </Card>
            )}

            {/* Coin Sides - Show automatic assignment */}
            {!isSuccess && !isLoading && selectedGame && (
              <Card className="card-solid border-cyan-500/60">
                <Flex direction="column" gap="3" p="4">
                  <Heading size="3" align="center">Coin Sides</Heading>

                  <Flex direction="column" gap="2">
                    <Flex justify="between" align="center">
                      <Text size="2" color="gray">Creator chose:</Text>
                      <Flex align="center" gap="2">
                        <Text size="4">{selectedGame.creator_choice ? '🪙' : '👑'}</Text>
                        <Text size="3" weight="bold">
                          {selectedGame.creator_choice ? 'Tails' : 'Heads'}
                        </Text>
                      </Flex>
                    </Flex>

                    <Flex justify="between" align="center" className="bg-cyan-500/10 p-2 rounded">
                      <Text size="2" weight="bold" className="text-cyan-400">You will play:</Text>
                      <Flex align="center" gap="2">
                        <Text size="4">{!selectedGame.creator_choice ? '🪙' : '👑'}</Text>
                        <Text size="3" weight="bold" className="text-cyan-400">
                          {!selectedGame.creator_choice ? 'Tails' : 'Heads'}
                        </Text>
                      </Flex>
                    </Flex>
                  </Flex>

                  <Text size="1" color="gray" align="center" style={{ fontStyle: 'italic' }}>
                    {!selectedGame.creator_choice ? 'If the coin lands on Tails, you win!' : 'If the coin lands on Heads, you win!'}
                  </Text>
                </Flex>
              </Card>
            )}

            {/* Waiting for wallet signature */}
            {isLoading && !isConfirming && !txHash && (
              <Flex direction="column" gap="3" align="center" py="4">
                <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
                <Text size="2" weight="bold" className="text-yellow-400">
                  Confirm in your wallet...
                </Text>
                <Text size="1" color="gray">
                  Please approve the transaction
                </Text>
              </Flex>
            )}

            {/* Transaction submitted, waiting for confirmation */}
            {isConfirming && txHash && (
              <Flex direction="column" gap="3" align="center" py="4">
                <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                <Text size="2" weight="bold" className="text-cyan-400">
                  Confirming...
                </Text>
                <Text size="1" color="gray" className="font-mono">
                  TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </Text>
              </Flex>
            )}

            {/* Success State */}
            {isSuccess && (
              <Flex direction="column" gap="3" align="center" py="4">
                <Text size="3" weight="bold" className="text-green-400">
                  ✓ Joined successfully!
                </Text>
                <Text size="2" color="gray" align="center">
                  Chainlink VRF will determine the winner (10-30 seconds)
                </Text>
              </Flex>
            )}

            {/* Error State */}
            {error && (
              <Card variant="surface" className="bg-red-500/10 border border-red-500/20">
                <Flex direction="column" gap="2" p="3">
                  <Flex align="center" gap="2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <Text size="2" weight="bold" className="text-red-400">
                      {parseJoinError(error).title}
                    </Text>
                  </Flex>
                  <Text size="2" color="gray">
                    {parseJoinError(error).message}
                  </Text>
                  {parseJoinError(error).title === 'Game No Longer Available' && (
                    <Button
                      size="2"
                      variant="soft"
                      color="gray"
                      onClick={() => {
                        resetJoinState();
                        refetch();
                        setIsDialogOpen(false);
                      }}
                    >
                      Back to Queue
                    </Button>
                  )}
                </Flex>
              </Card>
            )}

            {/* Actions */}
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  {isSuccess ? 'Close' : 'Cancel'}
                </Button>
              </Dialog.Close>
              {!isSuccess && !isLoading && (
                <Button onClick={handleConfirmJoin}>
                  Confirm & Join
                </Button>
              )}
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </AppLayout>
  );
}
