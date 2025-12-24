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
import { Clock, Users, Loader2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { CoinChoice } from '@/components/game/CoinChoice';
import { useGameStore } from '@/store/gameStore';
import { StatusBadge } from '@/components/game/StatusBadge';

export default function QueuePage() {
  const { isConnected, address } = useAccount();
  const { data: tiers } = useTiers();
  const { data: pendingGames, isLoading: isLoadingGames } = usePendingGames();
  const { data: gameStats } = useGameStats();
  const { coinChoice } = useGameStore();
  const { joinGame, isLoading, isSuccess, error } = useJoinGame();
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleJoinClick = (game: any, tier: any) => {
    setSelectedGame({ ...game, tier });
    setIsDialogOpen(true);
  };

  const handleConfirmJoin = () => {
    if (selectedGame && coinChoice !== null) {
      joinGame(selectedGame.id, coinChoice, selectedGame.tier.amount);
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
                      {pendingGames?.length || 0}
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
                ) : !pendingGames || pendingGames.length === 0 ? (
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
                      {pendingGames.map((game, index) => {
                        const tier = tiers?.find((t) => t.id === game.tier);
                        const isOwnGame = game.creator_address.toLowerCase() === address?.toLowerCase();
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
                              {isOwnGame ? (
                                <Button variant="soft" size="2" disabled className="opacity-50">
                                  Your Game
                                </Button>
                              ) : (
                                <Button
                                  size="2"
                                  onClick={() => handleJoinClick(game, tier!)}
                                  className="border-cyan-500/60 hover:scale-105 transition-transform"
                                >
                                  Join Game
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
      <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Dialog.Content style={{ maxWidth: 500 }}>
          <Dialog.Title>Join Game #{selectedGame?.id}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Choose your side to join this game
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

            {/* Coin Choice */}
            {!isSuccess && !isLoading && <CoinChoice />}

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
                  Waiting for Chainlink VRF to determine the winner (1-3 minutes)
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
                <Button onClick={handleConfirmJoin} disabled={coinChoice === null}>
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
