'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@radix-ui/themes';
import { Layout } from '@/components/layout/Layout';
import { useTiers } from '@/hooks/useTiers';
import { useJoinGame } from '@/hooks/useContract';
import { usePendingGames, useGameStats } from '@/hooks/useGames';
import { formatCurrency, formatGameId } from '@/lib/utils';
import { Clock, Users, Loader2, TrendingUp, XCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
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

// Type for selected game with attached tier info
// Use tierInfo to avoid conflict with Game.tier (which is number)
type SelectedGame = Game & { tierInfo: Tier };

// Note: Games can now be cancelled immediately (no timeout required)

// Helper to format time ago with live updates
function formatTimeAgo(createdAt: string, now: number): string {
  const seconds = Math.floor((now - new Date(createdAt).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

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
  const [now, setNow] = useState(Date.now()); // For live time updates
  const { addActiveGame, startCancellingGame, finishCancellingGame, isGameCancelling, startJoiningGame, finishJoiningGame, isGameJoining } = useGameStore();
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

  // Live time updates - refresh every second for accurate cancel countdown
  useEffect(() => {
    const interval = setInterval(() => {
      if (mountedRef.current) {
        setNow(Date.now());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Real-time updates are handled centrally by useRealtimeSync (in Providers)
  // Connection status is now managed by useConnectionStatus hook

  // Handle join success - invalidate queries to remove joined game from list
  useEffect(() => {
    if (isSuccess && joinedGameId) {
      // Complete the optimistic join
      finishJoiningGame(joinedGameId, true);

      // Immediately invalidate queries for real-time sync
      invalidateGameQueries(queryClient, joinedGameId);

      // Show success feedback
      showToast.gameMatched();
      playSound.match();
    }
  }, [isSuccess, joinedGameId, queryClient, finishJoiningGame]);

  // Handle join error - revert optimistic update
  useEffect(() => {
    if (error && joinedGameId) {
      finishJoiningGame(joinedGameId, false);
    }
  }, [error, joinedGameId, finishJoiningGame]);

  // Handle cancel success/error
  useEffect(() => {
    if (isCancelSuccess && cancelingGameId) {
      finishCancellingGame(cancelingGameId, true);

      // Immediately invalidate all game queries for real-time sync
      invalidateGameQueries(queryClient, cancelingGameId);

      // Show success feedback
      showToast.success('Game cancelled - bet refunded');

      setCancelingGameId(null);
      resetCancelState();
    }
  }, [isCancelSuccess, cancelingGameId, resetCancelState, finishCancellingGame, queryClient]);

  useEffect(() => {
    if (cancelError && cancelingGameId) {
      finishCancellingGame(cancelingGameId, false);
      setCancelingGameId(null);
      resetCancelState();
      // Refresh list to get current state after error
      invalidateGameQueries(queryClient);
    }
  }, [cancelError, cancelingGameId, resetCancelState, finishCancellingGame, queryClient]);

  // Handle user rejection - silently revert without error
  useEffect(() => {
    if (cancelWasRejected && cancelingGameId) {
      console.log('🎮 Cancel rejected by user, reverting UI for game:', cancelingGameId);
      finishCancellingGame(cancelingGameId, false);
      // Refetch pending games to restore the optimistically removed game
      invalidateGameQueries(queryClient, cancelingGameId);
      setCancelingGameId(null);
      resetCancelState();
    }
  }, [cancelWasRejected, cancelingGameId, resetCancelState, finishCancellingGame, queryClient]);

  // Separate user's games from other games, excluding games being cancelled or joined
  const myPendingGames = pendingGames?.filter(
    (game) => game.creator_address.toLowerCase() === address?.toLowerCase() && !isGameCancelling(game.id)
  );
  const otherPendingGames = pendingGames?.filter(
    (game) => game.creator_address.toLowerCase() !== address?.toLowerCase() && !isGameCancelling(game.id) && !isGameJoining(game.id)
  );

  const handleJoinClick = useCallback((game: Game, tier: Tier) => {
    // Reset any previous join state
    resetJoinState();
    setJoinedGameId(null);
    setSelectedGame({ ...game, tierInfo: tier });
    setIsDialogOpen(true);
  }, [resetJoinState]);

  const handleConfirmJoin = useCallback(() => {
    if (selectedGame) {
      // Joiner automatically gets opposite of creator's choice (contract enforces this)
      const joinerChoice = !selectedGame.creator_choice;
      setJoinedGameId(selectedGame.id);

      // Optimistic UI - mark game as being joined (removes from list immediately)
      startJoiningGame(selectedGame.id);

      // Add game to active games store immediately for tracking
      addActiveGame({
        ...selectedGame,
        joiner_choice: joinerChoice,
        status: 'pending', // Will update to 'matched' via subscription
      });

      // Note: Contract doesn't take choice param - joiner always bets opposite
      joinGame(selectedGame.id, selectedGame.tierInfo.amount);
    }
  }, [selectedGame, joinGame, addActiveGame, startJoiningGame]);

  const handleCancelGame = useCallback(async (gameId: string) => {
    // Check if already cancelling
    if (isGameCancelling(gameId) || cancelingGameId === gameId) {
      return;
    }

    // Reset any previous cancel state
    resetCancelState();

    if (!confirm('Are you sure you want to cancel this game? You will be refunded.')) {
      return;
    }

    setCancelingGameId(gameId);
    // Optimistic UI update
    startCancellingGame(gameId);
    // Optimistically remove from pending games cache for instant UI update
    removeGameFromPendingCache(queryClient, gameId);
    cancelGame(gameId);
  }, [cancelGame, resetCancelState, startCancellingGame, isGameCancelling, cancelingGameId, queryClient]);

  const handleDialogClose = useCallback((resetJoinedGame = true) => {
    setIsDialogOpen(false);
    setSelectedGame(null);
    if (resetJoinedGame) {
      setJoinedGameId(null);
    }
  }, []);

  // Auto-close dialog after successful join
  // Modal queuing is handled by central useRealtimeSync
  // Keep joinedGameId set to prevent re-clicking until game is removed from list
  useEffect(() => {
    if (!isSuccess) return;

    const timer = setTimeout(() => {
      if (mountedRef.current) {
        handleDialogClose(false); // Don't reset joinedGameId - let real-time sync handle it
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isSuccess, handleDialogClose]);

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
                    Please connect your Web3 wallet to view and join games
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

                    return (
                      <Card key={game.id} variant="surface" className="bg-yellow-500/5 border border-yellow-500/20">
                        <Flex direction="column" gap="3" p="4">
                          <Flex justify="between" align="center">
                            <Flex direction="column" gap="1">
                              <Text size="2" weight="bold" className="text-yellow-400">
                                Game {formatGameId(game.id)}
                              </Text>
                              <Text size="1" color="gray">
                                Waiting for opponent...
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
                            {cancelingGameId === game.id ? (
                              <Badge color="yellow" size="2">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Cancelling...
                              </Badge>
                            ) : (
                              <Button
                                size="2"
                                variant="soft"
                                color="red"
                                onClick={() => handleCancelGame(game.id)}
                                disabled={isCanceling}
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
                <Flex align="center" justify="between">
                  <Flex align="center" gap="3">
                    <Heading size="5">Available Games</Heading>
                    <Badge size="1" color={isLive ? 'green' : isConnecting ? 'yellow' : 'red'} variant="soft">
                      <Flex align="center" gap="1">
                        {isLive ? <Wifi className="w-3 h-3" /> : isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <WifiOff className="w-3 h-3" />}
                        {isLive ? 'Live' : isConnecting ? 'Connecting...' : 'Offline'}
                      </Flex>
                    </Badge>
                  </Flex>
                  <Link href="/play">
                    <Button variant="soft" size="2">
                      Create New Game
                    </Button>
                  </Link>
                </Flex>

                {isLoadingGames ? (
                  <Table.Root variant="surface">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Game ID</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Tier</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
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
                        <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Creator</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Time Left</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
                      </Table.Row>
                    </Table.Header>

                    <Table.Body>
                      {otherPendingGames.map((game, index) => {
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
                  Confirming transaction...
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
    </Layout>
  );
}
