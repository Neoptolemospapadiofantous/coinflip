'use client';

import { Layout } from '@/components/layout/Layout';
import { Container, Section, Heading, Card, Flex, Text, Grid, Badge, Table, Button } from '@radix-ui/themes';
import { useAccount } from 'wagmi';
import { usePlayerGames } from '@/hooks/useGames';
import { formatCurrency, formatRelativeTime, formatAddress } from '@/lib/utils';
import { getCoinSideLabel } from '@/lib/utils';
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
  const { data: games = [], isLoading } = usePlayerGames(address);

  // Calculate statistics
  const stats = {
    totalGames: games.length,
    wins: games.filter(
      (g) => g.status === 'resolved' && g.winner_address?.toLowerCase() === address?.toLowerCase()
    ).length,
    losses: games.filter(
      (g) => g.status === 'resolved' && g.winner_address?.toLowerCase() !== address?.toLowerCase()
    ).length,
    pending: games.filter((g) => g.status === 'pending' || g.status === 'matched').length,
    totalWagered: games.reduce((sum, g) => sum + BigInt(g.amount), BigInt(0)),
    totalWon: games
      .filter((g) => g.status === 'resolved' && g.winner_address?.toLowerCase() === address?.toLowerCase())
      .reduce((sum, g) => sum + (g.payout ? BigInt(g.payout) : BigInt(0)), BigInt(0)),
    totalLost: games
      .filter((g) => g.status === 'resolved' && g.winner_address?.toLowerCase() !== address?.toLowerCase())
      .reduce((sum, g) => sum + BigInt(g.amount), BigInt(0)),
  };

  const winRate = stats.totalGames > 0 ? (stats.wins / stats.totalGames) * 100 : 0;
  const profitLoss = stats.totalWon - stats.totalLost - stats.totalWagered;
  const isProfit = profitLoss > BigInt(0);

  // Prepare chart data
  const gamesByTier = [0, 1, 2, 3, 4].map((tier) => ({
    tier: `$${tier === 0 ? '5' : tier === 1 ? '10' : tier === 2 ? '25' : tier === 3 ? '50' : '100'}`,
    games: games.filter((g) => g.tier === tier).length,
    wins: games.filter(
      (g) => g.tier === tier && g.status === 'resolved' && g.winner_address?.toLowerCase() === address?.toLowerCase()
    ).length,
  }));

  // Filter out 0 values from pie chart to avoid overlap
  const winLossData = [
    { name: 'Wins', value: stats.wins, color: '#22c55e' },
    { name: 'Losses', value: stats.losses, color: '#ef4444' },
    { name: 'Pending', value: stats.pending, color: '#facc15' },
  ].filter(item => item.value > 0);

  // Recent games for timeline
  const recentGames = games
    .filter((g) => g.status === 'resolved')
    .slice(0, 10)
    .map((g, index) => ({
      date: new Date(g.resolved_at || g.created_at).toLocaleDateString(),
      profit: g.winner_address?.toLowerCase() === address?.toLowerCase()
        ? Number(g.payout || 0) / 1e18 - Number(g.amount) / 1e18
        : -Number(g.amount) / 1e18,
    }))
    .reverse();

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
            </Grid>

            {/* Charts */}
            <Grid columns={{ initial: '1', md: '2' }} gap="4">
              {/* Win/Loss Pie Chart */}
              <Card className="card-simple p-6">
                <Heading size="5" mb="4">
                  Win Distribution
                </Heading>
                {winLossData.length === 0 ? (
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
                  <Text color="gray">Loading games...</Text>
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
