'use client';

import { useState, useMemo } from 'react';
import { Flex, Card, Text, Heading, Box, Grid, Badge, Select, Skeleton } from '@radix-ui/themes';
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

  return (
    <DashboardLayout title="Statistics" description="Your detailed gaming statistics and analytics.">
      <Flex direction="column" gap="6">
        {/* Time Period Filter */}
        <Flex justify="between" align="center" className="animate-fade-in">
          <Heading size="6">Your Statistics</Heading>
          <Select.Root value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeFilter)}>
            <Select.Trigger>
              <Flex align="center" gap="2">
                <Calendar className="w-4 h-4" />
                {dateRange === 'all' ? 'All Time' : dateRange === 'today' ? 'Today' : dateRange === '7d' ? 'Last 7 Days' : dateRange === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
              </Flex>
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="all">All Time</Select.Item>
              <Select.Item value="today">Today</Select.Item>
              <Select.Item value="7d">Last 7 Days</Select.Item>
              <Select.Item value="30d">Last 30 Days</Select.Item>
              <Select.Item value="90d">Last 90 Days</Select.Item>
            </Select.Content>
          </Select.Root>
        </Flex>

        {/* Overview Stats */}
        <Grid columns={{ initial: '2', md: '4' }} gap="4">
          {isLoading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="card-simple">
                  <Flex direction="column" gap="3" p="4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-16" />
                  </Flex>
                </Card>
              ))}
            </>
          ) : (
            <>
              <StatCard
                label="Total Games"
                value={displayStats.totalGames}
                icon={<Dices className="w-5 h-5" />}
                color="cyan"
              />
              <StatCard
                label="Win Rate"
                value={`${displayStats.winRate.toFixed(1)}%`}
                icon={<Target className="w-5 h-5" />}
                color="purple"
                comparison="Platform: ~50%"
              />
              <StatCard
                label="Wins"
                value={displayStats.wins}
                icon={<Trophy className="w-5 h-5" />}
                color="green"
              />
              <StatCard
                label="Losses"
                value={displayStats.losses}
                icon={<TrendingDown className="w-5 h-5" />}
                color="red"
              />
            </>
          )}
        </Grid>

        {/* Rankings (if available) */}
        {playerRank && playerRank.player_total_games > 0 && (
          <Card className="card-solid border-cyan-500/50 animate-fade-in">
            <Flex direction="column" gap="4" p="5">
              <Flex align="center" gap="2">
                <Award className="w-5 h-5 text-cyan-400" />
                <Heading size="4">Your Rankings</Heading>
              </Flex>
              <Grid columns={{ initial: '2', md: '4' }} gap="4">
                <RankCard label="By Wins" rank={playerRank.rank_by_wins} total={playerRank.total_players} color="green" />
                <RankCard label="By Profit" rank={playerRank.rank_by_profit} total={playerRank.total_players} color="cyan" />
                <RankCard label="By Win Rate" rank={playerRank.rank_by_winrate} total={playerRank.total_players} color="yellow" />
                <RankCard label="By Volume" rank={playerRank.rank_by_volume} total={playerRank.total_players} color="purple" />
              </Grid>
            </Flex>
          </Card>
        )}

        {/* Charts Row */}
        <Grid columns={{ initial: '1', md: '2' }} gap="4">
          {/* Win Rate Trend */}
          <Card className="card-simple p-6 animate-fade-in">
            <Flex direction="column" gap="4">
              <Flex align="center" gap="2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <Heading size="4">Win Rate Trend</Heading>
              </Flex>
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
                <Flex align="center" justify="center" style={{ height: 250 }}>
                  <Text color="gray">Play at least 5 games to see trends</Text>
                </Flex>
              )}
            </Flex>
          </Card>

          {/* Profit Timeline */}
          <Card className="card-simple p-6 animate-fade-in">
            <Flex direction="column" gap="4">
              <Flex align="center" gap="2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                <Heading size="4">Profit Timeline</Heading>
              </Flex>
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
                <Flex align="center" justify="center" style={{ height: 250 }}>
                  <Text color="gray">No resolved games yet</Text>
                </Flex>
              )}
            </Flex>
          </Card>
        </Grid>

        {/* Streaks & Best/Worst Days */}
        <Grid columns={{ initial: '1', md: '2' }} gap="4">
          {/* Streaks */}
          <Card className="card-simple animate-fade-in">
            <Flex direction="column" gap="4" p="5">
              <Flex align="center" gap="2">
                <Flame className="w-5 h-5 text-orange-400" />
                <Heading size="4">Streaks</Heading>
              </Flex>
              <Grid columns="3" gap="4">
                <Box className="p-4 rounded-lg bg-slate-800/50 hover-lift">
                  <Flex direction="column" gap="2">
                    <Text size="2" color="gray">Current Streak</Text>
                    <Flex align="center" gap="2">
                      <Text size="6" weight="bold" className={streaks.currentStreak >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {Math.abs(streaks.currentStreak)}
                      </Text>
                      <Badge color={streaks.currentStreak >= 0 ? 'green' : 'red'} variant="soft">
                        {streaks.currentStreak >= 0 ? 'Wins' : 'Losses'}
                      </Badge>
                    </Flex>
                  </Flex>
                </Box>
                <Box className="p-4 rounded-lg bg-slate-800/50 hover-lift">
                  <Flex direction="column" gap="2">
                    <Text size="2" color="gray">Longest Win</Text>
                    <Flex align="center" gap="2">
                      <Text size="6" weight="bold" className="text-green-400">
                        {streaks.longestWinStreak}
                      </Text>
                      <Badge color="green" variant="soft">Wins</Badge>
                    </Flex>
                  </Flex>
                </Box>
                <Box className="p-4 rounded-lg bg-slate-800/50 hover-lift">
                  <Flex direction="column" gap="2">
                    <Text size="2" color="gray">Longest Loss</Text>
                    <Flex align="center" gap="2">
                      <Text size="6" weight="bold" className="text-red-400">
                        {streaks.longestLossStreak}
                      </Text>
                      <Badge color="red" variant="soft">Losses</Badge>
                    </Flex>
                  </Flex>
                </Box>
              </Grid>
            </Flex>
          </Card>

          {/* Best/Worst Days */}
          <Card className="card-simple animate-fade-in">
            <Flex direction="column" gap="4" p="5">
              <Flex align="center" gap="2">
                <Calendar className="w-5 h-5 text-purple-400" />
                <Heading size="4">Best & Worst Days</Heading>
              </Flex>
              {dayStats.bestDay ? (
                <Grid columns="2" gap="4">
                  <Box className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 hover-lift">
                    <Flex direction="column" gap="2">
                      <Text size="2" color="gray">Best Day</Text>
                      <Text size="1" className="text-green-400">{dayStats.bestDay.date}</Text>
                      <Text size="4" weight="bold" className="text-green-400">
                        +{dayStats.bestDay.profit.toFixed(4)} ETH
                      </Text>
                      <Text size="1" color="gray">
                        {dayStats.bestDay.wins}W / {dayStats.bestDay.losses}L
                      </Text>
                    </Flex>
                  </Box>
                  <Box className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 hover-lift">
                    <Flex direction="column" gap="2">
                      <Text size="2" color="gray">Worst Day</Text>
                      <Text size="1" className="text-red-400">{dayStats.worstDay.date}</Text>
                      <Text size="4" weight="bold" className="text-red-400">
                        {dayStats.worstDay.profit.toFixed(4)} ETH
                      </Text>
                      <Text size="1" color="gray">
                        {dayStats.worstDay.wins}W / {dayStats.worstDay.losses}L
                      </Text>
                    </Flex>
                  </Box>
                </Grid>
              ) : (
                <Box className="p-8 rounded-lg bg-slate-800/30 text-center">
                  <Text size="2" color="gray">No games played yet</Text>
                </Box>
              )}
            </Flex>
          </Card>
        </Grid>

        {/* Financial Overview */}
        <Card className="card-simple animate-fade-in">
          <Flex direction="column" gap="4" p="5">
            <Flex align="center" gap="2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <Heading size="4">Financial Overview</Heading>
            </Flex>
            <Grid columns={{ initial: '1', md: '3' }} gap="4">
              <Box className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30 hover-lift">
                <Flex direction="column" gap="2">
                  <Text size="2" color="gray">Total Wagered</Text>
                  <Flex align="baseline" gap="1">
                    <Text size="5" weight="bold">{formatAmount(displayStats.totalWagered)}</Text>
                    <Text size="2" color="gray">ETH</Text>
                  </Flex>
                </Flex>
              </Box>
              <Box className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 hover-lift">
                <Flex direction="column" gap="2">
                  <Text size="2" color="gray">Total Won</Text>
                  <Flex align="baseline" gap="1">
                    <Text size="5" weight="bold" className="text-green-400">
                      {formatAmount(displayStats.totalWon)}
                    </Text>
                    <Text size="2" color="gray">ETH</Text>
                  </Flex>
                </Flex>
              </Box>
              <Box className={`p-4 rounded-lg ${displayStats.netProfit >= 0n ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border hover-lift`}>
                <Flex direction="column" gap="2">
                  <Text size="2" color="gray">Net Profit</Text>
                  <Flex align="baseline" gap="1">
                    <Text
                      size="5"
                      weight="bold"
                      className={displayStats.netProfit >= 0n ? 'text-green-400' : 'text-red-400'}
                    >
                      {displayStats.netProfit >= 0n ? '+' : ''}
                      {formatAmount(displayStats.netProfit)}
                    </Text>
                    <Text size="2" color="gray">ETH</Text>
                  </Flex>
                </Flex>
              </Box>
            </Grid>
          </Flex>
        </Card>

        {/* Tier Breakdown */}
        <Card className="card-simple animate-fade-in">
          <Flex direction="column" gap="4" p="5">
            <Flex align="center" gap="2">
              <Target className="w-5 h-5 text-purple-400" />
              <Heading size="4">Performance by Tier</Heading>
            </Flex>
            {tierStats.length > 0 ? (
              <Flex direction="column" gap="3">
                {tierStats.map((tier) => (
                  <Flex
                    key={tier.tier}
                    align="center"
                    justify="between"
                    className="p-4 rounded-lg bg-slate-800/50 hover-lift transition-all"
                  >
                    <Flex align="center" gap="3">
                      <Badge size="2" color="cyan" variant="soft">
                        {tier.name}
                      </Badge>
                      <Text size="2" color="gray">
                        {tier.games} games
                      </Text>
                    </Flex>
                    <Flex align="center" gap="4">
                      <Text size="2">
                        <span className="text-green-400">{tier.wins}W</span>
                        {' / '}
                        <span className="text-red-400">{tier.games - tier.wins}L</span>
                      </Text>
                      <Box className="w-24">
                        <Flex align="center" gap="2">
                          <Box
                            className="flex-1 h-2 rounded-full overflow-hidden"
                            style={{ backgroundColor: theme.charts.tierProgress.background }}
                          >
                            <Box
                              className="h-full transition-all"
                              style={{
                                width: `${tier.winRate}%`,
                                background: `linear-gradient(to right, ${theme.charts.tierProgress.gradient.from}, ${theme.charts.tierProgress.gradient.to})`,
                              }}
                            />
                          </Box>
                          <Text size="1" color="gray" className="w-10 text-right">
                            {tier.winRate.toFixed(0)}%
                          </Text>
                        </Flex>
                      </Box>
                    </Flex>
                  </Flex>
                ))}
              </Flex>
            ) : (
              <Box className="p-8 rounded-lg bg-slate-800/30 text-center">
                <Text size="2" color="gray">
                  No games played yet. Start playing to see your tier breakdown!
                </Text>
              </Box>
            )}
          </Flex>
        </Card>
      </Flex>
    </DashboardLayout>
  );
}

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
  const colorClasses = {
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    red: 'text-red-400',
  };

  return (
    <Card className="card-simple hover-lift animate-fade-in">
      <Flex direction="column" gap="3" p="4">
        <Flex align="center" justify="between">
          <Text size="2" color="gray">{label}</Text>
          <span className={colorClasses[color]}>{icon}</span>
        </Flex>
        <Text size="7" weight="bold">{value}</Text>
        {comparison && (
          <Text size="1" color="gray">{comparison}</Text>
        )}
      </Flex>
    </Card>
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
  const colorClasses = {
    green: 'text-green-400 border-green-500/30',
    cyan: 'text-cyan-400 border-cyan-500/30',
    yellow: 'text-yellow-400 border-yellow-500/30',
    purple: 'text-purple-400 border-purple-500/30',
  };

  const percentile = ((total - rank + 1) / total) * 100;

  return (
    <Box className={`p-4 rounded-lg bg-slate-800/50 border ${colorClasses[color]} hover-lift`}>
      <Flex direction="column" gap="2" align="center">
        <Text size="1" color="gray">{label}</Text>
        <Text size="5" weight="bold" className={colorClasses[color].split(' ')[0]}>
          #{rank}
        </Text>
        <Text size="1" color="gray">Top {percentile.toFixed(0)}%</Text>
      </Flex>
    </Box>
  );
}
