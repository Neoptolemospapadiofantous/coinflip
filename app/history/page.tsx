'use client';

import { Layout } from '@/components/layout/Layout';
import { Container, Section, Heading, Card, Flex, Text, Grid, Badge, Table, Button, Skeleton } from '@radix-ui/themes';
import { useAccount } from 'wagmi';
import { usePlayerGames, usePlayerStats } from '@/hooks/useGames';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import { getCoinSideLabel } from '@/lib/utils';
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Trophy, Target, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function HistoryPage() {
  const { address } = useAccount();
  const { data: games = [], isLoading: isLoadingGames } = usePlayerGames(address, 50);
  const { data: playerStats, isLoading: isLoadingStats } = usePlayerStats(address);

  const isLoading = isLoadingGames || isLoadingStats;

  // Use stats from hook (already computed server-side)
  const stats = playerStats || {
    totalGames: 0,
    wins: 0,
    losses: 0,
    pending: 0,
    totalWagered: BigInt(0),
    totalWon: BigInt(0),
    totalLost: BigInt(0),
    gamesByTier: [0, 0, 0, 0, 0],
    winsByTier: [0, 0, 0, 0, 0],
  };

  // Memoize derived calculations
  const { winRate, profitLoss, isProfit } = useMemo(() => {
    const rate = stats.totalGames > 0 ? (stats.wins / stats.totalGames) * 100 : 0;
    const profit = stats.totalWon - stats.totalLost;
    return {
      winRate: rate,
      profitLoss: profit,
      isProfit: profit > BigInt(0),
    };
  }, [stats.totalGames, stats.wins, stats.totalWon, stats.totalLost]);

  // Memoize chart data
  const gamesByTier = useMemo(() => {
    const tierLabels = ['$5', '$10', '$25', '$50', '$100'];
    return tierLabels.map((label, tier) => ({
      tier: label,
      games: stats.gamesByTier[tier] || 0,
      wins: stats.winsByTier[tier] || 0,
    }));
  }, [stats.gamesByTier, stats.winsByTier]);

  // Filter out 0 values from pie chart to avoid overlap
  const winLossData = useMemo(() => [
    { name: 'Wins', value: stats.wins, color: '#22c55e' },
    { name: 'Losses', value: stats.losses, color: '#ef4444' },
    { name: 'Pending', value: stats.pending, color: '#facc15' },
  ].filter(item => item.value > 0), [stats.wins, stats.losses, stats.pending]);

  // Recent games for timeline (memoized)
  const recentGames = useMemo(() => games
    .filter((g) => g.status === 'resolved')
    .slice(0, 10)
    .map((g) => ({
      date: new Date(g.resolved_at || g.created_at).toLocaleDateString(),
      profit: g.winner_address?.toLowerCase() === address?.toLowerCase()
        ? Number(g.payout || 0) / 1e18 - Number(g.amount) / 1e18
        : -Number(g.amount) / 1e18,
    }))
    .reverse(), [games, address]);

  if (!address) {
    return (
      <Layout>
        <Section size="3">
          <Container size="2">
            <Card className="card-simple text-center p-8">
              <Heading size="6" mb="4">
                Connect Wallet to View History
              </Heading>
              <Text color="gray">Connect your wallet to see your game history and statistics.</Text>
            </Card>
          </Container>
        </Section>
      </Layout>
    );
  }

  return (
    <Layout>
      <Section size="3">
        <Container size="4">
          <Flex direction="column" gap="6">
            {/* Header */}
            <Flex align="center" justify="between">
              <Heading size="8">Game History</Heading>
              <Link href="/play">
                <Button size="3" className="cursor-pointer">
                  Play Now
                </Button>
              </Link>
            </Flex>

            {/* Stats Overview */}
            <Grid columns={{ initial: '1', sm: '2', md: '4' }} gap="4">
              {isLoading ? (
                <>
                  {[...Array(4)].map((_, i) => (
                    <Card key={i} className="card-simple">
                      <Flex direction="column" gap="2" p="4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-20" />
                      </Flex>
                    </Card>
                  ))}
                </>
              ) : (
                <>
                  <Card className="card-simple card-hover border-cyan-500/60">
                    <Flex direction="column" gap="2" p="4">
                      <Flex align="center" gap="2">
                        <Target className="w-5 h-5 text-cyan-400" />
                        <Text size="2" color="gray">
                          Total Games
                        </Text>
                      </Flex>
                      <Heading size="7">{stats.totalGames}</Heading>
                    </Flex>
                  </Card>

                  <Card className="card-simple card-hover border-green-500/60">
                    <Flex direction="column" gap="2" p="4">
                      <Flex align="center" gap="2">
                        <Trophy className="w-5 h-5 text-green-400" />
                        <Text size="2" color="gray">
                          Win Rate
                        </Text>
                      </Flex>
                      <Heading size="7" className="text-green-400">
                        {winRate.toFixed(1)}%
                      </Heading>
                    </Flex>
                  </Card>

                  <Card className="card-simple card-hover border-purple-500/60">
                    <Flex direction="column" gap="2" p="4">
                      <Flex align="center" gap="2">
                        <DollarSign className="w-5 h-5 text-purple-400" />
                        <Text size="2" color="gray">
                          Total Wagered
                        </Text>
                      </Flex>
                      <Heading size="7" className="text-purple-400">
                        {formatCurrency(stats.totalWagered)}
                      </Heading>
                    </Flex>
                  </Card>

                  <Card className={`card-simple card-hover ${isProfit ? 'border-green-500/60' : 'border-red-500/60'}`}>
                    <Flex direction="column" gap="2" p="4">
                      <Flex align="center" gap="2">
                        {isProfit ? (
                          <TrendingUp className="w-5 h-5 text-green-400" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-400" />
                        )}
                        <Text size="2" color="gray">
                          Profit/Loss
                        </Text>
                      </Flex>
                      <Heading size="7" className={isProfit ? 'text-green-400' : 'text-red-400'}>
                        {isProfit ? '+' : ''}
                        {formatCurrency(profitLoss)}
                      </Heading>
                    </Flex>
                  </Card>
                </>
              )}
            </Grid>

            {/* Charts */}
            <Grid columns={{ initial: '1', md: '2' }} gap="4">
              {/* Win/Loss Pie Chart */}
              <Card className="card-simple p-6">
                <Heading size="5" mb="4">
                  Win Distribution
                </Heading>
                {isLoading ? (
                  <Flex align="center" justify="center" style={{ height: 300 }}>
                    <Flex direction="column" align="center" gap="3">
                      <Skeleton className="h-32 w-32 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </Flex>
                  </Flex>
                ) : winLossData.length === 0 ? (
                  <Flex align="center" justify="center" style={{ height: 300 }}>
                    <Text color="gray" size="3">No resolved games yet</Text>
                  </Flex>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={winLossData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {winLossData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(6, 182, 212, 0.3)',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>

              {/* Games by Tier */}
              <Card className="card-simple p-6">
                <Heading size="5" mb="4">
                  Games by Tier
                </Heading>
                {isLoading ? (
                  <Flex align="end" justify="center" gap="4" style={{ height: 300 }} className="pb-8">
                    {[80, 120, 60, 100, 40].map((h, i) => (
                      <Skeleton key={i} className="w-12" style={{ height: h }} />
                    ))}
                  </Flex>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={gamesByTier}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="tier" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(6, 182, 212, 0.3)',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="games" fill="#06b6d4" name="Total Games" />
                      <Bar dataKey="wins" fill="#22c55e" name="Wins" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Grid>

            {/* Profit Timeline */}
            {recentGames.length > 0 && (
              <Card className="card-simple p-6">
                <Heading size="5" mb="4">
                  Profit Timeline (Last 10 Games)
                </Heading>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={recentGames}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="#06b6d4"
                      fill="url(#colorProfit)"
                    />
                    <defs>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Recent Games Table */}
            <Card className="card-simple">
              <Flex direction="column" gap="4" p="6">
                <Heading size="5">Recent Games</Heading>

                {isLoading ? (
                  <div className="overflow-x-auto">
                    <Table.Root>
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>Game ID</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Result</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {[...Array(5)].map((_, i) => (
                          <Table.Row key={i}>
                            <Table.Cell><Skeleton className="h-4 w-12" /></Table.Cell>
                            <Table.Cell><Skeleton className="h-5 w-16 rounded-full" /></Table.Cell>
                            <Table.Cell><Skeleton className="h-4 w-20" /></Table.Cell>
                            <Table.Cell><Skeleton className="h-4 w-24" /></Table.Cell>
                            <Table.Cell><Skeleton className="h-4 w-16" /></Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </div>
                ) : games.length === 0 ? (
                  <Flex direction="column" align="center" gap="3" py="8">
                    <Text size="5" color="gray">
                      No games played yet
                    </Text>
                    <Link href="/play">
                      <Button size="3" className="cursor-pointer">
                        Start Playing
                      </Button>
                    </Link>
                  </Flex>
                ) : (
                  <div className="overflow-x-auto">
                    <Table.Root>
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>Game ID</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Result</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {games.slice(0, 20).map((game) => {
                          const isWin =
                            game.status === 'resolved' &&
                            game.winner_address?.toLowerCase() === address?.toLowerCase();
                          const isCreator = game.creator_address.toLowerCase() === address.toLowerCase();

                          return (
                            <Table.Row key={game.id}>
                              <Table.Cell>
                                <code className="text-cyan-400">#{game.id}</code>
                              </Table.Cell>
                              <Table.Cell>
                                <Badge
                                  color={
                                    game.status === 'resolved'
                                      ? isWin
                                        ? 'green'
                                        : 'red'
                                      : game.status === 'matched'
                                      ? 'blue'
                                      : 'yellow'
                                  }
                                >
                                  {game.status === 'resolved'
                                    ? isWin
                                      ? 'Won'
                                      : 'Lost'
                                    : game.status}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell>{formatCurrency(game.amount)}</Table.Cell>
                              <Table.Cell>
                                {game.status === 'resolved' ? (
                                  <Flex gap="2" align="center">
                                    <span>
                                      {getCoinSideLabel(
                                        isCreator ? game.creator_choice : game.joiner_choice || false
                                      )}
                                    </span>
                                    {isWin && (
                                      <Text color="green" weight="bold">
                                        +{formatCurrency(game.payout || '0')}
                                      </Text>
                                    )}
                                  </Flex>
                                ) : (
                                  <Text color="gray">Pending</Text>
                                )}
                              </Table.Cell>
                              <Table.Cell>
                                <Text size="2" color="gray">
                                  {formatRelativeTime(game.created_at)}
                                </Text>
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Root>
                  </div>
                )}
              </Flex>
            </Card>
          </Flex>
        </Container>
      </Section>
    </Layout>
  );
}
