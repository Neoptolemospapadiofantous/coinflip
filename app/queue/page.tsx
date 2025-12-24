'use client';

import { useState, useEffect } from 'react';
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
} from '@radix-ui/themes';
import { Layout } from '@/components/layout/Layout';
import { useTiers } from '@/hooks/useTiers';
import { useJoinGame } from '@/hooks/useContract';
import { usePendingGames, useGameStats } from '@/hooks/useGames';
import { formatCurrency } from '@/lib/utils';
import { Clock, Users, Loader2, TrendingUp, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/game/StatusBadge';
import { useCancelGame } from '@/hooks/useContract';

export default function QueuePage() {
  const { isConnected, address } = useAccount();
  const { data: tiers } = useTiers();
  const { data: pendingGames, isLoading: isLoadingGames } = usePendingGames();
  const { data: gameStats } = useGameStats();
  const { joinGame, isLoading, isSuccess, error } = useJoinGame();
  const { cancelGame, isLoading: isCanceling } = useCancelGame();
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Separate user's games from other games
  const myPendingGames = pendingGames?.filter(
    (game) => game.creator_address.toLowerCase() === address?.toLowerCase()
  );
  const otherPendingGames = pendingGames?.filter(
    (game) => game.creator_address.toLowerCase() !== address?.toLowerCase()
  );

  const handleJoinClick = (game: any, tier: any) => {
    setSelectedGame({ ...game, tier });
    setIsDialogOpen(true);
  };

  const handleConfirmJoin = () => {
    if (selectedGame) {
      // Joiner automatically gets the opposite side of the creator
      const joinerChoice = !selectedGame.creator_choice;
      joinGame(selectedGame.id, joinerChoice, selectedGame.tier.amount);
    }
  };

  const handleCancelGame = (gameId: string) => {
    if (confirm('Are you sure you want to cancel this game? You will be refunded.')) {
      cancelGame(gameId);
    }
  };

  // Close dialog 3 seconds after successful join
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        setIsDialogOpen(false);
        setSelectedGame(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);

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
              <Text size="3" color="gray">
                Join an existing game or create your own
              </Text>
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
                    const timeAgo = Math.floor(
                      (Date.now() - new Date(game.created_at).getTime()) / 1000
                    );

                    return (
                      <Card key={game.id} variant="surface" className="bg-yellow-500/5 border border-yellow-500/20">
                        <Flex direction="column" gap="3" p="4">
                          <Flex justify="between" align="center">
                            <Flex direction="column" gap="1">
                              <Text size="2" weight="bold" className="text-yellow-400">
                                Game #{game.id}
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
                              <Text size="1" color="gray">Created {timeAgo < 60 ? `${timeAgo}s` : `${Math.floor(timeAgo / 60)}m`} ago</Text>
                              <Text size="1" color="gray">Your choice: {game.creator_choice ? 'Tails 🪙' : 'Heads 👑'}</Text>
                            </Flex>
                            <Button
                              size="2"
                              variant="soft"
                              color="red"
                              onClick={() => handleCancelGame(game.id)}
                              disabled={isCanceling}
                            >
                              <XCircle className="w-4 h-4" />
                              Cancel Game
                            </Button>
                          </Flex>

                          <Card variant="surface" className="bg-blue-500/5 border border-blue-500/20">
                            <Flex direction="column" gap="1" p="2">
                              <Text size="1" color="blue">
                                💡 Your game is visible to other players. You can navigate away and come back - it will stay active until someone joins or it times out (~20 minutes).
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
                  <Heading size="5">Available Games</Heading>
                  <Link href="/play">
                    <Button variant="soft" size="2">
                      Create New Game
                    </Button>
                  </Link>
                </Flex>

                {isLoadingGames ? (
                  <Flex direction="column" gap="4" align="center" py="9">
                    <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                    <Text size="3" color="gray">
                      Loading games...
                    </Text>
                  </Flex>
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
                        <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
                      </Table.Row>
                    </Table.Header>

                    <Table.Body>
                      {otherPendingGames.map((game, index) => {
                        const tier = tiers?.find((t) => t.id === game.tier);
                        const timeAgo = Math.floor(
                          (Date.now() - new Date(game.created_at).getTime()) / 1000
                        );

                        return (
                          <Table.Row
                            key={game.id}
                            className="animate-fade-in hover:bg-slate-700/30 transition-colors"
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            <Table.Cell>
                              <Text weight="bold" className="text-cyan-400">#{game.id}</Text>
                            </Table.Cell>
                            <Table.Cell>
                              <StatusBadge status={game.status as any} size="1" />
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
                              <Flex align="center" gap="1">
                                <Clock className="w-3 h-3 text-gray-500" />
                                <Text size="2" color="gray">
                                  {timeAgo < 60
                                    ? `${timeAgo}s`
                                    : `${Math.floor(timeAgo / 60)}m`}
                                </Text>
                              </Flex>
                            </Table.Cell>
                            <Table.Cell>
                              <Button
                                size="2"
                                onClick={() => handleJoinClick(game, tier!)}
                                className="border-cyan-500/60 hover:scale-105 transition-transform"
                              >
                                Join Game
                              </Button>
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
      <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Dialog.Content style={{ maxWidth: 500 }}>
          <Dialog.Title>Join Game #{selectedGame?.id}</Dialog.Title>
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
                    ${selectedGame?.tier?.amountUsd} (
                    {selectedGame?.tier && formatCurrency(selectedGame.tier.amount)})
                  </Text>
                </Flex>
                <Flex justify="between">
                  <Text size="2" color="gray">
                    Potential Win:
                  </Text>
                  <Text size="2" weight="bold" className="text-green-400">
                    ${selectedGame?.tier?.winAmountUsd}
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

            {/* Loading State */}
            {isLoading && (
              <Flex direction="column" gap="3" align="center" py="4">
                <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                <Text size="2" color="gray">
                  Joining game...
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
                <Text size="2" color="red">
                  Error: {error.message}
                </Text>
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
