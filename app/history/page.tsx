'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton, Select } from '@radix-ui/themes';
import { useAccount } from 'wagmi';
import { usePlayerGames, usePlayerStats } from '@/hooks/useGames';
import { useTiers } from '@/hooks/useTiers';
import { formatCurrency } from '@/lib/utils';
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
import { TrendingUp, TrendingDown, Trophy, Target, DollarSign, Percent, ChevronLeft, ChevronRight } from 'lucide-react';
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

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '16px',
};

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => setCurrentPage(1), [tierFilter, dateRange, statusFilter, sortOption]);

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
        <div style={{ padding: '48px 0' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px' }}>
            <div style={{ ...glassCard, padding: '48px 32px', textAlign: 'center' }}>
              <h2 style={{ color: 'white', fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
                Connect Wallet to View History
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '15px' }}>
                Connect your wallet to see your game history and statistics.
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Game History" description="View your game history and statistics" requireAuth>
      <div style={{ padding: '48px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Header */}
            <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <h1 style={{
                fontSize: '36px',
                fontWeight: 800,
                background: 'linear-gradient(to right, #67e8f9, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0,
              }}>
                Game History
              </h1>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <ExportButton
                  games={filteredGames}
                  userAddress={address}
                  filename="coinflip-history"
                />
                <Link href="/play" style={{ textDecoration: 'none' }}>
                  <button
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #7c3aed)',
                      border: 'none',
                      color: 'white',
                      borderRadius: '10px',
                      padding: '10px 20px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Play Now
                  </button>
                </Link>
              </div>
            </div>

            {/* Stats Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              {isLoading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} style={glassCard}>
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {/* Games Played */}
                  <div className="animate-fade-in" style={{ ...glassCard, borderTop: '2px solid rgba(6,182,212,0.6)', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Target className="w-5 h-5 text-cyan-400" />
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Games Played</span>
                    </div>
                    <div style={{ color: 'white', fontSize: '30px', fontWeight: 700 }}>
                      {stats.wins + stats.losses}
                    </div>
                    {stats.totalGames - stats.wins - stats.losses > 0 && (
                      <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
                        +{stats.totalGames - stats.wins - stats.losses} cancelled
                      </div>
                    )}
                  </div>

                  {/* Win Rate */}
                  <div className="animate-fade-in" style={{ ...glassCard, borderTop: '2px solid rgba(34,197,94,0.6)', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Trophy className="w-5 h-5 text-green-400" />
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Win Rate</span>
                    </div>
                    <div style={{ color: '#4ade80', fontSize: '30px', fontWeight: 700 }}>
                      {winRate.toFixed(1)}%
                    </div>
                  </div>

                  {/* Total Wagered */}
                  <div className="animate-fade-in" style={{ ...glassCard, borderTop: '2px solid rgba(168,85,247,0.6)', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <DollarSign className="w-5 h-5 text-purple-400" />
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Total Wagered</span>
                    </div>
                    <div style={{ color: '#c084fc', fontSize: '30px', fontWeight: 700 }}>
                      {formatCurrency(stats.totalWagered)}
                    </div>
                  </div>

                  {/* Profit/Loss */}
                  <div className="animate-fade-in" style={{ ...glassCard, borderTop: isProfit ? '2px solid rgba(34,197,94,0.6)' : '2px solid rgba(239,68,68,0.6)', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      {isProfit ? (
                        <TrendingUp className="w-5 h-5 text-green-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-400" />
                      )}
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Profit/Loss</span>
                    </div>
                    <div style={{ color: isProfit ? '#4ade80' : '#f87171', fontSize: '30px', fontWeight: 700 }}>
                      {isProfit ? '+' : ''}{formatCurrency(profitLoss)}
                    </div>
                  </div>

                  {/* Fees Paid */}
                  <div className="animate-fade-in" style={{ ...glassCard, borderTop: '2px solid rgba(249,115,22,0.6)', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Percent className="w-5 h-5 text-orange-400" />
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>Fees Paid</span>
                    </div>
                    <div style={{ color: '#fb923c', fontSize: '30px', fontWeight: 700 }}>
                      {formatCurrency(stats.totalFees)}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
                      {PLATFORM_FEE_PERCENT}% platform fee
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {/* Win/Loss Pie Chart */}
              <div className="animate-fade-in" style={{ ...glassCard, padding: '24px' }}>
                <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '16px', marginTop: 0 }}>
                  Win Distribution
                </h2>
                {isLoading ? (
                  <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Skeleton className="h-32 w-32 rounded-full" />
                  </div>
                ) : winLossData.length === 0 ? (
                  <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#64748b', fontSize: '15px' }}>No resolved games yet</span>
                  </div>
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
                        fill={theme.colors.accent.main}
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
              </div>

              {/* Games by Tier */}
              <div className="animate-fade-in" style={{ ...glassCard, padding: '24px' }}>
                <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '16px', marginTop: 0 }}>
                  Games by Tier
                </h2>
                {isLoading ? (
                  <div style={{ height: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '16px', paddingBottom: '32px' }}>
                    {[80, 120, 60, 100, 40].map((h, i) => (
                      <Skeleton key={i} className="w-12" style={{ height: h }} />
                    ))}
                  </div>
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
              </div>
            </div>

            {/* Profit Timeline */}
            {recentGames.length > 0 && (
              <div className="animate-fade-in" style={{ ...glassCard, padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                    Cumulative Profit
                  </h2>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                    <Select.Root value={chartFilter} onValueChange={setChartFilter}>
                      <Select.Trigger placeholder="Filter" />
                      <Select.Content>
                        <Select.Item value="10">Last 10 Games</Select.Item>
                        <Select.Item value="25">Last 25 Games</Select.Item>
                        <Select.Item value="50">Last 50 Games</Select.Item>
                        <Select.Item value="all">All Games</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </div>
                </div>
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
              </div>
            )}

            {/* Games Table with Filters */}
            <div className="animate-fade-in" style={glassCard}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 style={{ color: 'white', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                    Game History
                  </h2>
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
                </div>

                {/* Results count */}
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                  Showing {paginatedGames.length} of {filteredGames.length} games
                  {filteredGames.length !== games.length && ` (filtered from ${games.length} total)`}
                </p>

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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px' }}>
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: currentPage === 1 ? '#475569' : '#94a3b8',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage === 1 ? 0.5 : 1,
                      }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

                        const isActive = currentPage === page;
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            style={{
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: isActive
                                ? 'linear-gradient(135deg, #06b6d4, #7c3aed)'
                                : 'rgba(255,255,255,0.06)',
                              border: isActive ? 'none' : '1px solid rgba(255,255,255,0.1)',
                              color: isActive ? 'white' : '#94a3b8',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: isActive ? 700 : 500,
                              cursor: 'pointer',
                            }}
                          >
                            {page}
                          </button>
                        );
                      })}
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          <span style={{ color: '#64748b' }}>...</span>
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            style={{
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: '#94a3b8',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>

                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: currentPage === totalPages ? '#475569' : '#94a3b8',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        opacity: currentPage === totalPages ? 0.5 : 1,
                      }}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
