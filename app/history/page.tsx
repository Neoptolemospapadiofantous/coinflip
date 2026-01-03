'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { Container, Section, Heading, Card, Flex, Text, Grid, Badge, Table, Button, Skeleton, Select } from '@radix-ui/themes';
import { useAccount } from 'wagmi';
import { usePlayerGames, usePlayerStats } from '@/hooks/useGames';
import { useTiers } from '@/hooks/useTiers';
import { formatCurrency, formatRelativeTime, formatGameId, getCoinSideLabel, formatTxHash, getBlockExplorerUrl } from '@/lib/utils';
import { PLATFORM_FEE_PERCENT } from '@/lib/constants';
import { useMemo, useState } from 'react';
import {
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
import { TrendingUp, TrendingDown, Trophy, Target, DollarSign, Percent, ExternalLink, Filter } from 'lucide-react';
import { useChainId } from 'wagmi';
import Link from 'next/link';

export default function HistoryPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: games = [], isLoading: isLoadingGames } = usePlayerGames(address, 100);
  const { data: tiers = [] } = useTiers();
  const [chartFilter, setChartFilter] = useState<string>('10');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
    totalFees: BigInt(0),
    gamesByTier: [0, 0, 0, 0, 0],
    winsByTier: [0, 0, 0, 0, 0],
  };

  // Memoize derived calculations
  const { winRate, profitLoss, isProfit } = useMemo(() => {
    // Win rate should only count resolved games (wins + losses), not cancelled/pending
    const resolvedGames = stats.wins + stats.losses;
    const rate = resolvedGames > 0 ? (stats.wins / resolvedGames) * 100 : 0;
    const profit = stats.totalWon - stats.totalLost;
    return {
      winRate: rate,
      profitLoss: profit,
      isProfit: profit > BigInt(0),
    };
  }, [stats.wins, stats.losses, stats.totalWon, stats.totalLost]);

  // Memoize chart data - use dynamic tier labels from database
  const gamesByTier = useMemo(() => {
    // Generate labels from tiers data, fallback to tier index if not available
    return tiers.map((tier, index) => ({
      tier: tier.amountUsd ? `$${tier.amountUsd}` : `Tier ${index}`,
      games: stats.gamesByTier[index] || 0,
      wins: stats.winsByTier[index] || 0,
    })).filter(t => t.games > 0 || t.wins > 0); // Only show tiers with activity
  }, [stats.gamesByTier, stats.winsByTier, tiers]);

  // Filter out 0 values from pie chart to avoid overlap
  const winLossData = useMemo(() => [
    { name: 'Wins', value: stats.wins, color: '#22c55e' },
    { name: 'Losses', value: stats.losses, color: '#ef4444' },
    { name: 'Pending', value: stats.pending, color: '#facc15' },
  ].filter(item => item.value > 0), [stats.wins, stats.losses, stats.pending]);

  // Recent games for timeline with cumulative profit (memoized)
  const recentGames = useMemo(() => {
    const limit = chartFilter === 'all' ? undefined : parseInt(chartFilter);
    const resolved = games
      .filter((g) => g.status === 'resolved')
      .slice(0, limit)
      .reverse();

    let cumulative = 0;
    return resolved.map((g) => {
      const profit = g.winner_address?.toLowerCase() === address?.toLowerCase()
        ? Number(g.payout || 0) / 1e18 - Number(g.amount) / 1e18
        : -Number(g.amount) / 1e18;
      cumulative += profit;
      return {
        game: `#${g.id}`,
        profit: cumulative,
      };
    });
  }, [games, address, chartFilter]);

  // Filter games for table display
  const filteredGames = useMemo(() => {
    if (statusFilter === 'all') return games;
    if (statusFilter === 'won') {
      return games.filter(g => g.status === 'resolved' && g.winner_address?.toLowerCase() === address?.toLowerCase());
    }
    if (statusFilter === 'lost') {
      return games.filter(g => g.status === 'resolved' && g.winner_address?.toLowerCase() !== address?.toLowerCase());
    }
    return games.filter(g => g.status === statusFilter);
  }, [games, statusFilter, address]);

  // This page requires authentication (registered user)
  // AppLayout with requireAuth will redirect to login if not authenticated

  // Show connect wallet message if authenticated but no wallet connected
  if (!address) {
    return (
      <AppLayout title="Game History" description="Connect your wallet to view history" requireAuth>
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
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Game History" description="View your game history and statistics" requireAuth>
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
            <Grid columns={{ initial: '1', sm: '2', md: '5' }} gap="4">
              {isLoading ? (
                <>
                  {[...Array(5)].map((_, i) => (
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
                          Games Played
                        </Text>
                      </Flex>
                      <Heading size="7">{stats.wins + stats.losses}</Heading>
                      <Text size="1" color="gray">
                        {stats.totalGames - stats.wins - stats.losses > 0 && `+${stats.totalGames - stats.wins - stats.losses} cancelled`}
                      </Text>
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

                  <Card className="card-simple card-hover border-orange-500/60">
                    <Flex direction="column" gap="2" p="4">
                      <Flex align="center" gap="2">
                        <Percent className="w-5 h-5 text-orange-400" />
                        <Text size="2" color="gray">
                          Fees Paid
                        </Text>
                      </Flex>
                      <Heading size="7" className="text-orange-400">
                        {formatCurrency(stats.totalFees)}
                      </Heading>
                      <Text size="1" color="gray">{PLATFORM_FEE_PERCENT}% platform fee</Text>
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
                        labelLine={true}
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="rgba(15, 23, 42, 0.5)"
                        strokeWidth={2}
                      >
                        {winLossData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            style={{ cursor: 'pointer', filter: 'brightness(1)', transition: 'filter 0.2s' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid rgba(6, 182, 212, 0.5)',
                          borderRadius: '8px',
                          color: '#e2e8f0',
                        }}
                        itemStyle={{ color: '#e2e8f0' }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <Legend
                        formatter={(value, entry) => <span style={{ color: entry.color }}>{value}</span>}
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
                    <BarChart data={gamesByTier} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="tier" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                      <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid rgba(6, 182, 212, 0.5)',
                          borderRadius: '8px',
                          color: '#e2e8f0',
                        }}
                        itemStyle={{ color: '#e2e8f0' }}
                        labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                        cursor={{ fill: 'rgba(6, 182, 212, 0.1)' }}
                      />
                      <Legend
                        formatter={(value, entry) => (
                          <span style={{ color: entry.color }}>{value}</span>
                        )}
                      />
                      <Bar
                        dataKey="games"
                        fill="#8b5cf6"
                        name="Total Games"
                        radius={[4, 4, 0, 0]}
                        style={{ cursor: 'pointer' }}
                      />
                      <Bar
                        dataKey="wins"
                        fill="#22c55e"
                        name="Wins"
                        radius={[4, 4, 0, 0]}
                        style={{ cursor: 'pointer' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Grid>

            {/* Profit Timeline */}
            {recentGames.length > 0 && (
              <Card className="card-simple p-6">
                <Flex justify="between" align="center" mb="4">
                  <Heading size="5">
                    Cumulative Profit
                  </Heading>
                  <Select.Root value={chartFilter} onValueChange={setChartFilter}>
                    <Select.Trigger placeholder="Filter" />
                    <Select.Content>
                      <Select.Item value="10">Last 10 Games</Select.Item>
                      <Select.Item value="25">Last 25 Games</Select.Item>
                      <Select.Item value="50">Last 50 Games</Select.Item>
                      <Select.Item value="all">All Games</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Flex>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={recentGames} margin={{ top: 20, right: 30, left: 30, bottom: 30 }}>
                    <defs>
                      <linearGradient id="colorProfitGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProfitRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="game" stroke="#94a3b8" tick={{ dy: 15 }} />
                    <YAxis stroke="#94a3b8" width={85} tick={{ dx: -15 }} tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(4)}`} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(6, 182, 212, 0.5)',
                        borderRadius: '8px',
                        color: '#e2e8f0',
                      }}
                      itemStyle={{ color: '#e2e8f0' }}
                      labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                      formatter={(value) => {
                        const val = typeof value === 'number' ? value : 0;
                        const color = val >= 0 ? '#22c55e' : '#ef4444';
                        return [
                          <span style={{ color }}>{`${val >= 0 ? '+' : ''}${val.toFixed(6)} ETH`}</span>,
                          'Cumulative P/L'
                        ];
                      }}
                      cursor={{ stroke: 'rgba(6, 182, 212, 0.5)', strokeWidth: 2 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke={recentGames[recentGames.length - 1]?.profit >= 0 ? '#22c55e' : '#ef4444'}
                      strokeWidth={2}
                      fill={recentGames[recentGames.length - 1]?.profit >= 0 ? 'url(#colorProfitGreen)' : 'url(#colorProfitRed)'}
                      style={{ cursor: 'crosshair' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Recent Games Table */}
            <Card className="card-simple">
              <Flex direction="column" gap="4" p="6">
                <Flex justify="between" align="center">
                  <Heading size="5">Recent Games</Heading>
                  <Flex align="center" gap="2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <Select.Root value={statusFilter} onValueChange={setStatusFilter}>
                      <Select.Trigger placeholder="Filter" />
                      <Select.Content>
                        <Select.Item value="all">All Games</Select.Item>
                        <Select.Item value="won">Wins Only</Select.Item>
                        <Select.Item value="lost">Losses Only</Select.Item>
                        <Select.Item value="pending">Pending</Select.Item>
                        <Select.Item value="matched">Matched</Select.Item>
                        <Select.Item value="cancelled">Cancelled</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Flex>
                </Flex>

                {isLoading ? (
                  <div className="overflow-x-auto">
                    <Table.Root>
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>Game ID</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Result</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>TX</Table.ColumnHeaderCell>
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
                            <Table.Cell><Skeleton className="h-4 w-20" /></Table.Cell>
                            <Table.Cell><Skeleton className="h-4 w-16" /></Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </div>
                ) : filteredGames.length === 0 ? (
                  <Flex direction="column" align="center" gap="3" py="8">
                    <Text size="5" color="gray">
                      {games.length === 0 ? 'No games played yet' : 'No games match filter'}
                    </Text>
                    {games.length === 0 && (
                      <Link href="/play">
                        <Button size="3" className="cursor-pointer">
                          Start Playing
                        </Button>
                      </Link>
                    )}
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
                          <Table.ColumnHeaderCell>TX</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {filteredGames.slice(0, 50).map((game) => {
                          const isWin =
                            game.status === 'resolved' &&
                            game.winner_address?.toLowerCase() === address?.toLowerCase();
                          const isCreator = game.creator_address.toLowerCase() === address.toLowerCase();
                          // Get the most relevant tx hash (resolved > matched > created)
                          const txHash = game.resolved_tx_hash || game.matched_tx_hash || game.tx_hash;

                          return (
                            <Table.Row key={game.id}>
                              <Table.Cell>
                                <code className="text-cyan-400">{formatGameId(game.id)}</code>
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
                                      : game.status === 'cancelled'
                                      ? 'gray'
                                      : 'yellow'
                                  }
                                >
                                  {game.status === 'resolved'
                                    ? isWin
                                      ? 'Won'
                                      : 'Lost'
                                    : game.status === 'cancelled'
                                    ? 'Cancelled'
                                    : game.status === 'matched'
                                    ? 'Matched'
                                    : 'Pending'}
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
                                ) : game.status === 'cancelled' ? (
                                  <Text color="gray">Refunded</Text>
                                ) : (
                                  <Text color="gray">{getCoinSideLabel(game.creator_choice)}</Text>
                                )}
                              </Table.Cell>
                              <Table.Cell>
                                {txHash ? (
                                  <a
                                    href={getBlockExplorerUrl(chainId, txHash, 'tx')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                                  >
                                    <code className="text-xs">{formatTxHash(txHash)}</code>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <Text size="1" color="gray">-</Text>
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
    </AppLayout>
  );
}
