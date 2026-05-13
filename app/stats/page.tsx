'use client';

import { useState, useMemo } from 'react';
import { Skeleton } from '@radix-ui/themes';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Dices,
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  Flame,
  Calendar,
  BarChart3,
  Award,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { usePlayerStats, usePlayerGames } from '@/hooks/useGames';
import { usePlayerRank } from '@/hooks/useLeaderboard';
import { formatEther } from 'viem';
import { useTiers } from '@/hooks/useTiers';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getDateRangeStart, type DateRangeFilter } from '@/components/shared';
import { theme } from '@/lib/theme';

// ─── Glass design tokens ───────────────────────────────────────────────────
const glass = {
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
  } as React.CSSProperties,
  row: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '12px',
    padding: '16px',
  } as React.CSSProperties,
  rowSm: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '10px',
    padding: '12px 16px',
  } as React.CSSProperties,
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.06)',
  } as React.CSSProperties,
};

const colorMap = {
  cyan:   { text: '#22d3ee', glow: 'rgba(6,182,212,0.15)',   border: 'rgba(6,182,212,0.25)'   },
  purple: { text: '#a78bfa', glow: 'rgba(124,58,237,0.15)',  border: 'rgba(124,58,237,0.25)'  },
  green:  { text: '#4ade80', glow: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.25)'  },
  red:    { text: '#f87171', glow: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.25)' },
  yellow: { text: '#facc15', glow: 'rgba(250,204,21,0.15)',  border: 'rgba(250,204,21,0.25)'  },
};

export default function StatsPage() {
  const { address } = useAccount();
  const { data: playerStats, isLoading: isLoadingStats } = usePlayerStats(address);
  const { data: recentGames = [], isLoading: isLoadingGames } = usePlayerGames(address, 200);
  const { data: playerRank } = usePlayerRank(address);
  const { data: tiers = [] } = useTiers();
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');

  const isLoading = isLoadingStats || isLoadingGames;

  const formatAmount = (wei: string | bigint | undefined) => {
    if (!wei || wei === '0' || wei === 0n) return '0';
    const eth = parseFloat(formatEther(typeof wei === 'bigint' ? wei : BigInt(wei)));
    return eth.toFixed(4);
  };

  // Filter games by date range
  const filteredGames = useMemo(() => {
    const dateStart = getDateRangeStart(dateRange);
    if (!dateStart) return recentGames;
    return recentGames.filter(g => new Date(g.created_at) >= dateStart);
  }, [recentGames, dateRange]);

  // Calculate stats from filtered games
  const filteredStats = useMemo(() => {
    const resolved = filteredGames.filter(g => g.status === 'resolved');
    const wins = resolved.filter(g => g.winner_address?.toLowerCase() === address?.toLowerCase()).length;
    const losses = resolved.length - wins;
    const totalWagered = resolved.reduce((sum, g) => sum + BigInt(g.amount), 0n);
    const totalWon = resolved
      .filter(g => g.winner_address?.toLowerCase() === address?.toLowerCase())
      .reduce((sum, g) => sum + BigInt(g.payout || 0), 0n);

    return {
      totalGames: filteredGames.length,
      wins,
      losses,
      winRate: resolved.length > 0 ? (wins / resolved.length) * 100 : 0,
      totalWagered,
      totalWon,
      netProfit: totalWon - totalWagered,
    };
  }, [filteredGames, address]);

  // Use all-time stats when date range is 'all'
  const displayStats = dateRange === 'all' ? {
    totalGames: playerStats?.totalGames ?? 0,
    wins: playerStats?.wins ?? 0,
    losses: playerStats?.losses ?? 0,
    winRate: ((playerStats?.wins ?? 0) + (playerStats?.losses ?? 0)) > 0
      ? ((playerStats?.wins ?? 0) / ((playerStats?.wins ?? 0) + (playerStats?.losses ?? 0))) * 100
      : 0,
    totalWagered: playerStats?.totalWagered ?? 0n,
    totalWon: playerStats?.totalWon ?? 0n,
    netProfit: (playerStats?.totalWon ?? 0n) - (playerStats?.totalWagered ?? 0n),
  } : filteredStats;

  // Calculate streaks
  const streaks = useMemo(() => {
    let currentStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;
    let lastResult: 'win' | 'loss' | null = null;

    const resolvedGames = filteredGames
      .filter((g) => g.status === 'resolved')
      .sort((a, b) => new Date(b.resolved_at || 0).getTime() - new Date(a.resolved_at || 0).getTime());

    for (const game of resolvedGames) {
      const isWin = game.winner_address?.toLowerCase() === address?.toLowerCase();

      if (isWin) {
        tempWinStreak++;
        tempLossStreak = 0;
        if (tempWinStreak > longestWinStreak) longestWinStreak = tempWinStreak;
        if (lastResult === 'win' || lastResult === null) {
          currentStreak = tempWinStreak;
        }
        lastResult = 'win';
      } else {
        tempLossStreak++;
        tempWinStreak = 0;
        if (tempLossStreak > longestLossStreak) longestLossStreak = tempLossStreak;
        if (lastResult === 'loss' || lastResult === null) {
          currentStreak = -tempLossStreak;
        }
        lastResult = 'loss';
      }
    }

    return { currentStreak, longestWinStreak, longestLossStreak };
  }, [filteredGames, address]);

  // Win rate trend over time (last 30 data points)
  const winRateTrend = useMemo(() => {
    const resolved = filteredGames
      .filter((g) => g.status === 'resolved')
      .sort((a, b) => new Date(a.resolved_at || 0).getTime() - new Date(b.resolved_at || 0).getTime());

    if (resolved.length < 5) return [];

    const points = [];
    let wins = 0;
    let total = 0;

    for (let i = 0; i < resolved.length; i++) {
      const game = resolved[i];
      total++;
      if (game.winner_address?.toLowerCase() === address?.toLowerCase()) {
        wins++;
      }

      // Add point every 5 games or at the end
      if ((i + 1) % 5 === 0 || i === resolved.length - 1) {
        points.push({
          game: `#${i + 1}`,
          winRate: (wins / total) * 100,
          avgWinRate: 50, // Platform average
        });
      }
    }

    return points.slice(-20); // Last 20 points
  }, [filteredGames, address]);

  // Profit timeline
  const profitTimeline = useMemo(() => {
    const resolved = filteredGames
      .filter((g) => g.status === 'resolved')
      .sort((a, b) => new Date(a.resolved_at || 0).getTime() - new Date(b.resolved_at || 0).getTime());

    let cumulative = 0;
    return resolved.slice(-30).map((g, i) => {
      const profit = g.winner_address?.toLowerCase() === address?.toLowerCase()
        ? Number(g.payout || 0) / 1e18 - Number(g.amount) / 1e18
        : -Number(g.amount) / 1e18;
      cumulative += profit;
      return {
        game: `#${i + 1}`,
        profit: cumulative,
      };
    });
  }, [filteredGames, address]);

  // Best/Worst day stats
  const dayStats = useMemo(() => {
    const resolved = filteredGames.filter(g => g.status === 'resolved');
    const byDay: Record<string, { wins: number; losses: number; profit: number }> = {};

    for (const game of resolved) {
      const day = new Date(game.resolved_at || game.created_at).toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { wins: 0, losses: 0, profit: 0 };

      const isWin = game.winner_address?.toLowerCase() === address?.toLowerCase();
      const profit = isWin
        ? Number(game.payout || 0) / 1e18 - Number(game.amount) / 1e18
        : -Number(game.amount) / 1e18;

      byDay[day].profit += profit;
      if (isWin) byDay[day].wins++;
      else byDay[day].losses++;
    }

    const days = Object.entries(byDay).map(([date, stats]) => ({ date, ...stats }));
    const bestDay = days.reduce((best, day) => day.profit > (best?.profit ?? -Infinity) ? day : best, days[0]);
    const worstDay = days.reduce((worst, day) => day.profit < (worst?.profit ?? Infinity) ? day : worst, days[0]);

    return { bestDay, worstDay, totalDays: days.length };
  }, [filteredGames, address]);

  // Tier breakdown
  const tierStats = useMemo(() => {
    const stats: Record<number, { games: number; wins: number }> = {};

    for (const game of filteredGames.filter((g) => g.status === 'resolved')) {
      if (!stats[game.tier]) {
        stats[game.tier] = { games: 0, wins: 0 };
      }
      stats[game.tier].games++;
      if (game.winner_address?.toLowerCase() === address?.toLowerCase()) {
        stats[game.tier].wins++;
      }
    }

    return Object.entries(stats).map(([tier, data]) => {
      const tierId = parseInt(tier);
      const tierInfo = tiers.find(t => t.id === tierId);
      return {
        tier: tierId,
        name: tierInfo ? `$${tierInfo.amountUsd}` : `Tier ${tierId}`,
        games: data.games,
        wins: data.wins,
        winRate: data.games > 0 ? (data.wins / data.games) * 100 : 0,
      };
    }).sort((a, b) => a.tier - b.tier);
  }, [filteredGames, address, tiers]);

  const dateLabel: Record<DateRangeFilter, string> = {
    all: 'All Time',
    today: 'Today',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
  };

  return (
    <DashboardLayout title="Statistics" description="Your detailed gaming statistics and analytics.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Time Period Filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="animate-fade-in">
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Your Statistics</h1>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...glass.card, padding: '10px 16px', cursor: 'pointer' }}>
              <Calendar style={{ width: '16px', height: '16px', color: '#94a3b8' }} />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#cbd5e1',
                  fontSize: '14px',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  paddingRight: '8px',
                }}
              >
                <option value="all" style={{ background: '#1e293b' }}>All Time</option>
                <option value="today" style={{ background: '#1e293b' }}>Today</option>
                <option value="7d" style={{ background: '#1e293b' }}>Last 7 Days</option>
                <option value="30d" style={{ background: '#1e293b' }}>Last 30 Days</option>
                <option value="90d" style={{ background: '#1e293b' }}>Last 90 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }} className="md:grid-cols-4">
          {isLoading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ ...glass.card, padding: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-16" />
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <StatCard
                label="Total Games"
                value={displayStats.totalGames}
                icon={<Dices style={{ width: '20px', height: '20px' }} />}
                color="cyan"
              />
              <StatCard
                label="Win Rate"
                value={`${displayStats.winRate.toFixed(1)}%`}
                icon={<Target style={{ width: '20px', height: '20px' }} />}
                color="purple"
                comparison="Platform: ~50%"
              />
              <StatCard
                label="Wins"
                value={displayStats.wins}
                icon={<Trophy style={{ width: '20px', height: '20px' }} />}
                color="green"
              />
              <StatCard
                label="Losses"
                value={displayStats.losses}
                icon={<TrendingDown style={{ width: '20px', height: '20px' }} />}
                color="red"
              />
            </>
          )}
        </div>

        {/* Rankings (if available) */}
        {playerRank && playerRank.player_total_games > 0 && (
          <div style={{ ...glass.card, padding: '20px', borderColor: 'rgba(6,182,212,0.3)' }} className="animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award style={{ width: '20px', height: '20px', color: '#22d3ee' }} />
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Your Rankings</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }} className="md:grid-cols-4">
                <RankCard label="By Wins" rank={playerRank.rank_by_wins} total={playerRank.total_players} color="green" />
                <RankCard label="By Profit" rank={playerRank.rank_by_profit} total={playerRank.total_players} color="cyan" />
                <RankCard label="By Win Rate" rank={playerRank.rank_by_winrate} total={playerRank.total_players} color="yellow" />
                <RankCard label="By Volume" rank={playerRank.rank_by_volume} total={playerRank.total_players} color="purple" />
              </div>
            </div>
          </div>
        )}

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="md:grid-cols-2">
          {/* Win Rate Trend */}
          <div style={{ ...glass.card, padding: '24px' }} className="animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp style={{ width: '20px', height: '20px', color: '#4ade80' }} />
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Win Rate Trend</h2>
              </div>
              {winRateTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={winRateTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.neutral[700]} />
                    <XAxis dataKey="game" stroke={theme.colors.neutral[400]} />
                    <YAxis stroke={theme.colors.neutral[400]} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{
                        background: theme.charts.tooltip.background,
                        border: `1px solid ${theme.charts.tooltip.border}`,
                        borderRadius: '8px',
                      }}
                      formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Win Rate']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="winRate" stroke={theme.charts.trends.positive} strokeWidth={2} name="Your Win Rate" dot={false} />
                    <Line type="monotone" dataKey="avgWinRate" stroke={theme.charts.trends.neutral} strokeWidth={1} strokeDasharray="5 5" name="Platform Avg" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>Play at least 5 games to see trends</span>
                </div>
              )}
            </div>
          </div>

          {/* Profit Timeline */}
          <div style={{ ...glass.card, padding: '24px' }} className="animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 style={{ width: '20px', height: '20px', color: '#22d3ee' }} />
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Profit Timeline</h2>
              </div>
              {profitTimeline.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={profitTimeline}>
                    <defs>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={profitTimeline[profitTimeline.length - 1]?.profit >= 0 ? theme.charts.trends.positive : theme.charts.trends.negative} stopOpacity={0.8} />
                        <stop offset="95%" stopColor={profitTimeline[profitTimeline.length - 1]?.profit >= 0 ? theme.charts.trends.positive : theme.charts.trends.negative} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.neutral[700]} />
                    <XAxis dataKey="game" stroke={theme.colors.neutral[400]} />
                    <YAxis stroke={theme.colors.neutral[400]} tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}`} />
                    <Tooltip
                      contentStyle={{
                        background: theme.charts.tooltip.background,
                        border: `1px solid ${theme.charts.tooltip.border}`,
                        borderRadius: '8px',
                      }}
                      formatter={(value) => {
                        const v = value as number;
                        return [`${v >= 0 ? '+' : ''}${v.toFixed(6)} ETH`, 'Cumulative P/L'];
                      }}
                    />
                    <Area type="monotone" dataKey="profit" stroke={profitTimeline[profitTimeline.length - 1]?.profit >= 0 ? theme.charts.trends.positive : theme.charts.trends.negative} fill="url(#profitGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>No resolved games yet</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Streaks & Best/Worst Days */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }} className="md:grid-cols-2">
          {/* Streaks */}
          <div style={{ ...glass.card, padding: '20px' }} className="animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame style={{ width: '20px', height: '20px', color: '#fb923c' }} />
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Streaks</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {/* Current Streak */}
                <div style={{ ...glass.row, padding: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Current Streak</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '28px', fontWeight: 700, color: streaks.currentStreak >= 0 ? '#4ade80' : '#f87171' }}>
                        {Math.abs(streaks.currentStreak)}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '20px',
                        background: streaks.currentStreak >= 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                        color: streaks.currentStreak >= 0 ? '#4ade80' : '#f87171',
                      }}>
                        {streaks.currentStreak >= 0 ? 'Wins' : 'Losses'}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Longest Win */}
                <div style={{ ...glass.row, padding: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Longest Win</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '28px', fontWeight: 700, color: '#4ade80' }}>
                        {streaks.longestWinStreak}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                        Wins
                      </span>
                    </div>
                  </div>
                </div>
                {/* Longest Loss */}
                <div style={{ ...glass.row, padding: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Longest Loss</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '28px', fontWeight: 700, color: '#f87171' }}>
                        {streaks.longestLossStreak}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                        Losses
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Best/Worst Days */}
          <div style={{ ...glass.card, padding: '20px' }} className="animate-fade-in">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar style={{ width: '20px', height: '20px', color: '#a78bfa' }} />
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Best &amp; Worst Days</h2>
              </div>
              {dayStats.bestDay ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Best Day</span>
                      <span style={{ fontSize: '12px', color: '#4ade80' }}>{dayStats.bestDay.date}</span>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: '#4ade80' }}>
                        +{dayStats.bestDay.profit.toFixed(4)} ETH
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {dayStats.bestDay.wins}W / {dayStats.bestDay.losses}L
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Worst Day</span>
                      <span style={{ fontSize: '12px', color: '#f87171' }}>{dayStats.worstDay.date}</span>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: '#f87171' }}>
                        {dayStats.worstDay.profit.toFixed(4)} ETH
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {dayStats.worstDay.wins}W / {dayStats.worstDay.losses}L
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '32px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#64748b' }}>No games played yet</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Financial Overview */}
        <div style={{ ...glass.card, padding: '20px' }} className="animate-fade-in">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 style={{ width: '20px', height: '20px', color: '#22d3ee' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Financial Overview</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }} className="md:grid-cols-3">
              {/* Total Wagered */}
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Total Wagered</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9' }}>{formatAmount(displayStats.totalWagered)}</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>ETH</span>
                  </div>
                </div>
              </div>
              {/* Total Won */}
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Total Won</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '22px', fontWeight: 700, color: '#4ade80' }}>{formatAmount(displayStats.totalWon)}</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>ETH</span>
                  </div>
                </div>
              </div>
              {/* Net Profit */}
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                background: displayStats.netProfit >= 0n ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
                border: `1px solid ${displayStats.netProfit >= 0n ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Net Profit</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '22px', fontWeight: 700, color: displayStats.netProfit >= 0n ? '#4ade80' : '#f87171' }}>
                      {displayStats.netProfit >= 0n ? '+' : ''}
                      {formatAmount(displayStats.netProfit)}
                    </span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>ETH</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tier Breakdown */}
        <div style={{ ...glass.card, padding: '20px' }} className="animate-fade-in">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target style={{ width: '20px', height: '20px', color: '#a78bfa' }} />
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Performance by Tier</h2>
            </div>
            {tierStats.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tierStats.map((tier) => (
                  <div
                    key={tier.tier}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      ...glass.rowSm,
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: 'rgba(6,182,212,0.15)',
                        color: '#22d3ee',
                        border: '1px solid rgba(6,182,212,0.3)',
                      }}>
                        {tier.name}
                      </span>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>{tier.games} games</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '13px' }}>
                        <span style={{ color: '#4ade80' }}>{tier.wins}W</span>
                        <span style={{ color: '#64748b' }}> / </span>
                        <span style={{ color: '#f87171' }}>{tier.games - tier.wins}L</span>
                      </span>
                      <div style={{ width: '96px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '6px', borderRadius: '999px', overflow: 'hidden', background: theme.charts.tierProgress.background }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${tier.winRate}%`,
                              background: `linear-gradient(to right, ${theme.charts.tierProgress.gradient.from}, ${theme.charts.tierProgress.gradient.to})`,
                              transition: 'width 0.4s',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b', width: '32px', textAlign: 'right' }}>
                          {tier.winRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '32px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
                <span style={{ fontSize: '14px', color: '#64748b' }}>
                  No games played yet. Start playing to see your tier breakdown!
                </span>
              </div>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  comparison,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'cyan' | 'purple' | 'green' | 'red';
  comparison?: string;
}) {
  const c = colorMap[color];

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid rgba(255,255,255,0.07)`,
        borderRadius: '16px',
        padding: '16px',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      className="animate-fade-in hover-lift"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>{label}</span>
          <span style={{ color: c.text }}>{icon}</span>
        </div>
        <span style={{ fontSize: '32px', fontWeight: 700, color: c.text, textShadow: `0 0 20px ${c.glow}` }}>
          {value}
        </span>
        {comparison && (
          <span style={{ fontSize: '11px', color: '#64748b' }}>{comparison}</span>
        )}
      </div>
    </div>
  );
}

function RankCard({
  label,
  rank,
  total,
  color,
}: {
  label: string;
  rank: number;
  total: number;
  color: 'green' | 'cyan' | 'yellow' | 'purple';
}) {
  const c = colorMap[color];
  const percentile = ((total - rank + 1) / total) * 100;

  return (
    <div style={{
      padding: '16px',
      borderRadius: '12px',
      background: c.glow,
      border: `1px solid ${c.border}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      transition: 'transform 0.2s',
    }} className="hover-lift">
      <span style={{ fontSize: '12px', color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: '24px', fontWeight: 700, color: c.text }}>#{rank}</span>
      <span style={{ fontSize: '11px', color: '#64748b' }}>Top {percentile.toFixed(0)}%</span>
    </div>
  );
}
