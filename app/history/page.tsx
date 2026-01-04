'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { Container, Section, Heading, Card, Flex, Text, Grid, Badge, Button, Skeleton, Select } from '@radix-ui/themes';
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
import { TrendingUp, TrendingDown, Trophy, Target, DollarSign, Percent, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { useChainId } from 'wagmi';
import Link from 'next/link';
import { FilterControls, ExportButton, getDateRangeStart } from '@/components/shared';
import type { DateRangeFilter, StatusFilter, SortOption } from '@/components/shared';
import { RecentGamesTable } from '@/components/shared/RecentGamesTable';
import { theme } from '@/lib/theme';

// Custom tooltip component for dark theme
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div style={{
      background: theme.charts.tooltip.background,
      border: `1px solid ${theme.charts.tooltip.border}`,
      borderRadius: '8px',
      padding: '10px 14px',
    }}>
      {label && <p style={{ color: theme.colors.neutral[200], marginBottom: '6px', fontWeight: 500 }}>{label}</p>}
      {payload.map((entry, index) => (
        <p key={index} style={{ color: theme.colors.neutral[200], margin: '2px 0' }}>
          <span style={{ color: entry.color }}>{entry.name}</span>: {entry.value}
        </p>
      ))}
    </div>
  );
};

// Custom tooltip for profit chart
const ProfitTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload || !payload[0]) return null;
  const value = payload[0].value;
  const color = value >= 0 ? theme.charts.trends.positive : theme.charts.trends.negative;
  return (
    <div style={{
      background: theme.charts.tooltip.background,
      border: `1px solid ${theme.charts.tooltip.border}`,
      borderRadius: '8px',
      padding: '10px 14px',
    }}>
      {label && <p style={{ color: theme.colors.neutral[200], marginBottom: '6px', fontWeight: 500 }}>{label}</p>}
      <p style={{ color: theme.colors.neutral[200], margin: '2px 0' }}>
        Cumulative P/L: <span style={{ color }}>{value >= 0 ? '+' : ''}{value.toFixed(6)} ETH</span>
      </p>
    </div>
  );
};

const ITEMS_PER_PAGE = 25;

export default function HistoryPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: games = [], isLoading: isLoadingGames } = usePlayerGames(address, 500);
  const { data: tiers = [] } = useTiers();
  const [chartFilter, setChartFilter] = useState<string>('10');
  const { data: playerStats, isLoading: isLoadingStats } = usePlayerStats(address);

  // Filter states
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);

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
    const resolvedGames = stats.wins + stats.losses;
    const rate = resolvedGames > 0 ? (stats.wins / resolvedGames) * 100 : 0;
    const profit = stats.totalWon - stats.totalLost;
    return {
      winRate: rate,
      profitLoss: profit,
      isProfit: profit > BigInt(0),
    };
  }, [stats.wins, stats.losses, stats.totalWon, stats.totalLost]);

  // Memoize chart data
  const gamesByTier = useMemo(() => {
    return tiers.map((tier, index) => ({
      tier: tier.amountUsd ? `$${tier.amountUsd}` : `Tier ${index}`,
      games: stats.gamesByTier[index] || 0,
      wins: stats.winsByTier[index] || 0,
    })).filter(t => t.games > 0 || t.wins > 0);
  }, [stats.gamesByTier, stats.winsByTier, tiers]);

  const winLossData = useMemo(() => [
    { name: 'Wins', value: stats.wins, color: theme.charts.winDistribution.wins },
    { name: 'Losses', value: stats.losses, color: theme.charts.winDistribution.losses },
    { name: 'Pending', value: stats.pending, color: theme.colors.warning.main },
  ].filter(item => item.value > 0), [stats.wins, stats.losses, stats.pending]);

  // Filter games
  const filteredGames = useMemo(() => {
    let result = [...games];

    // Date range filter
    const dateStart = getDateRangeStart(dateRange);
    if (dateStart) {
      result = result.filter(g => new Date(g.created_at) >= dateStart);
    }

    // Tier filter
    if (tierFilter !== null) {
      result = result.filter(g => g.tier === tierFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'won') {
        result = result.filter(g => g.status === 'resolved' && g.winner_address?.toLowerCase() === address?.toLowerCase());
      } else if (statusFilter === 'lost') {
        result = result.filter(g => g.status === 'resolved' && g.winner_address?.toLowerCase() !== address?.toLowerCase());
      } else {
        result = result.filter(g => g.status === statusFilter);
      }
    }

    // Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'amount_high':
          return Number(b.amount) - Number(a.amount);
        case 'amount_low':
          return Number(a.amount) - Number(b.amount);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [games, dateRange, tierFilter, statusFilter, sortOption, address]);

  // Pagination
  const totalPages = Math.ceil(filteredGames.length / ITEMS_PER_PAGE);
  const paginatedGames = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredGames.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredGames, currentPage]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [tierFilter, dateRange, statusFilter, sortOption]);

  // Recent games for timeline with cumulative profit
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
            <Flex align="center" justify="between" className="animate-fade-in">
              <Heading size="8">Game History</Heading>
              <Flex gap="3">
                <ExportButton
                  games={filteredGames}
                  userAddress={address}
                  filename="coinflip-history"
                />
                <Link href="/play">
                  <Button size="3" className="cursor-pointer">
                    Play Now
                  </Button>
                </Link>
              </Flex>
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
                  <Card className="card-simple card-hover border-cyan-500/60 hover-lift animate-fade-in">
                    <Flex direction="column" gap="2" p="4">
                      <Flex align="center" gap="2">
                        <Target className="w-5 h-5 text-cyan-400" />
                        <Text size="2" color="gray">Games Played</Text>
                      </Flex>
                      <Heading size="7">{stats.wins + stats.losses}</Heading>
                      <Text size="1" color="gray">
                        {stats.totalGames - stats.wins - stats.losses > 0 && `+${stats.totalGames - stats.wins - stats.losses} cancelled`}
                      </Text>
                    </Flex>
                  </Card>

                  <Card className="card-simple card-hover border-green-500/60 hover-lift animate-fade-in">
                    <Flex direction="column" gap="2" p="4">
                      <Flex align="center" gap="2">
                        <Trophy className="w-5 h-5 text-green-400" />
                        <Text size="2" color="gray">Win Rate</Text>
                      </Flex>
                      <Heading size="7" className="text-green-400">
                        {winRate.toFixed(1)}%
                      </Heading>
                    </Flex>
                  </Card>

                  <Card className="card-simple card-hover border-purple-500/60 hover-lift animate-fade-in">
                    <Flex direction="column" gap="2" p="4">
                      <Flex align="center" gap="2">
                        <DollarSign className="w-5 h-5 text-purple-400" />
                        <Text size="2" color="gray">Total Wagered</Text>
                      </Flex>
                      <Heading size="7" className="text-purple-400">
                        {formatCurrency(stats.totalWagered)}
                      </Heading>
                    </Flex>
                  </Card>

                  <Card className={`card-simple card-hover ${isProfit ? 'border-green-500/60' : 'border-red-500/60'} hover-lift animate-fade-in`}>
                    <Flex direction="column" gap="2" p="4">
                      <Flex align="center" gap="2">
                        {isProfit ? (
                          <TrendingUp className="w-5 h-5 text-green-400" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-400" />
                        )}
                        <Text size="2" color="gray">Profit/Loss</Text>
                      </Flex>
                      <Heading size="7" className={isProfit ? 'text-green-400' : 'text-red-400'}>
                        {isProfit ? '+' : ''}{formatCurrency(profitLoss)}
                      </Heading>
                    </Flex>
                  </Card>

                  <Card className="card-simple card-hover border-orange-500/60 hover-lift animate-fade-in">
                    <Flex direction="column" gap="2" p="4">
                      <Flex align="center" gap="2">
                        <Percent className="w-5 h-5 text-orange-400" />
                        <Text size="2" color="gray">Fees Paid</Text>
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
              <Card className="card-simple p-6 animate-fade-in">
                <Heading size="5" mb="4">Win Distribution</Heading>
                {isLoading ? (
                  <Flex align="center" justify="center" style={{ height: 300 }}>
                    <Skeleton className="h-32 w-32 rounded-full" />
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
                        labelLine={{ stroke: theme.colors.neutral[400] }}
                        label={({ cx, cy, midAngle = 0, outerRadius, name, percent }) => {
                          const RADIAN = Math.PI / 180;
                          const radius = (outerRadius ?? 90) + 25;
                          const x = (cx ?? 0) + radius * Math.cos(-midAngle * RADIAN);
                          const y = (cy ?? 0) + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text
                              x={x}
                              y={y}
                              fill={theme.colors.neutral[200]}
                              textAnchor={x > (cx ?? 0) ? 'start' : 'end'}
                              dominantBaseline="central"
                              fontSize={12}
                            >
                              {`${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            </text>
                          );
                        }}
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="rgba(15, 23, 42, 0.5)"
                        strokeWidth={2}
                      >
                        {winLossData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        formatter={(value) => <span style={{ color: theme.colors.neutral[200] }}>{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>

              {/* Games by Tier */}
              <Card className="card-simple p-6 animate-fade-in">
                <Heading size="5" mb="4">Games by Tier</Heading>
                {isLoading ? (
                  <Flex align="end" justify="center" gap="4" style={{ height: 300 }} className="pb-8">
                    {[80, 120, 60, 100, 40].map((h, i) => (
                      <Skeleton key={i} className="w-12" style={{ height: h }} />
                    ))}
                  </Flex>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={gamesByTier} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.neutral[700]} />
                      <XAxis dataKey="tier" stroke={theme.colors.neutral[400]} tick={{ fill: theme.colors.neutral[400] }} />
                      <YAxis stroke={theme.colors.neutral[400]} tick={{ fill: theme.colors.neutral[400] }} />
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: 'rgba(6, 182, 212, 0.1)' }}
                      />
                      <Legend
                        formatter={(value) => <span style={{ color: theme.colors.neutral[200] }}>{value}</span>}
                      />
                      <Bar dataKey="games" fill={theme.colors.accent.main} name="Total Games" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="wins" fill={theme.charts.winDistribution.wins} name="Wins" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Grid>

            {/* Profit Timeline */}
            {recentGames.length > 0 && (
              <Card className="card-simple p-6 animate-fade-in">
                <Flex justify="between" align="center" mb="4">
                  <Heading size="5">Cumulative Profit</Heading>
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
                        <stop offset="5%" stopColor={theme.charts.trends.positive} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={theme.charts.trends.positive} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProfitRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.charts.trends.negative} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={theme.charts.trends.negative} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.neutral[700]} />
                    <XAxis dataKey="game" stroke={theme.colors.neutral[400]} tick={{ dy: 15, fill: theme.colors.neutral[400] }} />
                    <YAxis stroke={theme.colors.neutral[400]} width={85} tick={{ dx: -15, fill: theme.colors.neutral[400] }} tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value.toFixed(4)}`} />
                    <Tooltip content={<ProfitTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke={recentGames[recentGames.length - 1]?.profit >= 0 ? theme.charts.trends.positive : theme.charts.trends.negative}
                      strokeWidth={2}
                      fill={recentGames[recentGames.length - 1]?.profit >= 0 ? 'url(#colorProfitGreen)' : 'url(#colorProfitRed)'}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Games Table with Filters */}
            <Card className="card-simple animate-fade-in">
              <Flex direction="column" gap="4" p="6">
                <Flex justify="between" align="center" wrap="wrap" gap="3">
                  <Heading size="5">Game History</Heading>
                  <FilterControls
                    tierFilter={tierFilter}
                    onTierChange={setTierFilter}
                    showTierFilter
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    showDateFilter
                    statusFilter={statusFilter}
                    onStatusChange={setStatusFilter}
                    showStatusFilter
                    statusOptions={['all', 'won', 'lost', 'pending', 'matched', 'cancelled']}
                    sortOption={sortOption}
                    onSortChange={setSortOption}
                    showSortFilter
                  />
                </Flex>

                {/* Results count */}
                <Text size="2" color="gray">
                  Showing {paginatedGames.length} of {filteredGames.length} games
                  {filteredGames.length !== games.length && ` (filtered from ${games.length} total)`}
                </Text>

                <RecentGamesTable
                  games={paginatedGames}
                  userAddress={address}
                  chainId={chainId}
                  isLoading={isLoading}
                  maxRows={ITEMS_PER_PAGE}
                  emptyMessage={games.length === 0 ? 'No games played yet' : 'No games match your filters'}
                />

                {/* Pagination */}
                {totalPages > 1 && (
                  <Flex justify="between" align="center" pt="4">
                    <Button
                      variant="soft"
                      size="2"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>

                    <Flex gap="2" align="center">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }

                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? 'solid' : 'soft'}
                            size="1"
                            onClick={() => setCurrentPage(page)}
                            className="cursor-pointer w-8"
                          >
                            {page}
                          </Button>
                        );
                      })}
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          <Text color="gray">...</Text>
                          <Button
                            variant="soft"
                            size="1"
                            onClick={() => setCurrentPage(totalPages)}
                            className="cursor-pointer w-8"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                    </Flex>

                    <Button
                      variant="soft"
                      size="2"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="cursor-pointer"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Flex>
                )}
              </Flex>
            </Card>
          </Flex>
        </Container>
      </Section>
    </AppLayout>
  );
}
