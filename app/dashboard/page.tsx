'use client';

import { Flex, Card, Text, Heading, Box, Grid, Badge, Button, Skeleton } from '@radix-ui/themes';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Dices,
  TrendingUp,
  TrendingDown,
  Trophy,
  Wallet,
  Clock,
  Zap,
  ArrowRight,
  Activity,
  Flame,
  Target,
  History,
  Settings,
  Volume2,
  VolumeX,
  FastForward,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import { useAccount, useChainId } from 'wagmi';
import { usePlayerStats, usePlayerGames } from '@/hooks/useGames';
import { usePlayerRank } from '@/hooks/useLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { formatEther } from 'viem';
import { useMemo } from 'react';
import { RecentGamesTable } from '@/components/shared';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { theme } from '@/lib/theme';

export default function DashboardPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { user } = useAuth();
  const { data: playerStats, isLoading: isLoadingStats } = usePlayerStats(address);
  const { data: playerRank, isLoading: isLoadingRank } = usePlayerRank(address);
  const { data: recentGames = [], isLoading: isLoadingGames } = usePlayerGames(address, 5);
  const {
    soundEnabled,
    skipAnimation,
    setSoundEnabled,
    setSkipAnimation,
    isLoading: isLoadingPrefs,
  } = useUserPreferences();

  const formatAmount = (wei: string | undefined | bigint) => {
    if (!wei || wei === '0') return '0';
    const eth = parseFloat(formatEther(BigInt(wei.toString())));
    return eth.toFixed(4);
  };

  // Calculate win rate from wins and losses
  const totalResolved = (playerStats?.wins ?? 0) + (playerStats?.losses ?? 0);
  const winRate = totalResolved > 0 ? ((playerStats?.wins ?? 0) / totalResolved) * 100 : 50;

  // Calculate net profit
  const netProfit = (playerStats?.totalWon ?? BigInt(0)) - (playerStats?.totalWagered ?? BigInt(0));

  // Calculate win streak from recent games
  const winStreak = useMemo(() => {
    if (!recentGames || !address) return 0;
    let streak = 0;
    for (const game of recentGames) {
      if (game.status !== 'resolved') continue;
      if (game.winner_address?.toLowerCase() === address.toLowerCase()) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [recentGames, address]);

  // Pie chart data for win/loss - using theme colors
  const pieData = useMemo(() => [
    { name: 'Wins', value: playerStats?.wins ?? 0, color: theme.charts.winDistribution.wins },
    { name: 'Losses', value: playerStats?.losses ?? 0, color: theme.charts.winDistribution.losses },
  ].filter(d => d.value > 0), [playerStats?.wins, playerStats?.losses]);

  const stats = [
    {
      label: 'Total Games',
      value: playerStats?.totalGames ?? 0,
      icon: <Dices className="w-5 h-5 text-cyan-400" />,
      color: 'cyan',
    },
    {
      label: 'Wins',
      value: playerStats?.wins ?? 0,
      icon: <Trophy className="w-5 h-5 text-green-400" />,
      color: 'green',
    },
    {
      label: 'Losses',
      value: playerStats?.losses ?? 0,
      icon: <TrendingDown className="w-5 h-5 text-red-400" />,
      color: 'red',
    },
    {
      label: 'Win Rate',
      value: `${winRate.toFixed(1)}%`,
      icon: <TrendingUp className="w-5 h-5 text-purple-400" />,
      color: 'purple',
    },
  ];

  return (
    <DashboardLayout title="Dashboard" description="Welcome back! Here's your gaming overview.">
      <Flex direction="column" gap="6">
        {/* Welcome Card */}
        <Card className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 animate-fade-in hover-lift">
          <Flex justify="between" align="center" p="5">
            <Flex direction="column" gap="2">
              <Flex align="center" gap="3">
                <Heading size="6">
                  Welcome back, {user?.email?.split('@')[0] || 'Player'}!
                </Heading>
                {winStreak >= 2 && (
                  <Badge color="orange" variant="soft" className="animate-pulse">
                    <Flame className="w-3 h-3" />
                    {winStreak} Win Streak!
                  </Badge>
                )}
              </Flex>
              <Text size="2" color="gray">
                Ready for another round? Your luck awaits.
              </Text>
            </Flex>
            <Link href="/play">
              <Button size="3" className="cursor-pointer">
                <Dices className="w-4 h-4" />
                Play Now
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </Flex>
        </Card>

        {/* Stats Grid */}
        <Grid columns={{ initial: '2', md: '4' }} gap="4">
          {stats.map((stat, i) => (
            <Card
              key={stat.label}
              className="card-simple hover-lift animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <Flex direction="column" gap="3" p="4">
                <Flex align="center" justify="between">
                  <Text size="2" color="gray">
                    {stat.label}
                  </Text>
                  {stat.icon}
                </Flex>
                {isLoadingStats ? (
                  <Skeleton className="h-10 w-16" />
                ) : (
                  <Text size="7" weight="bold">
                    {stat.value}
                  </Text>
                )}
              </Flex>
            </Card>
          ))}
        </Grid>

        {/* Financial Stats + Mini Chart */}
        <Grid columns={{ initial: '1', md: '4' }} gap="4">
          <Card className="card-simple hover-lift animate-fade-in">
            <Flex direction="column" gap="3" p="4">
              <Flex align="center" gap="2">
                <Wallet className="w-5 h-5 text-cyan-400" />
                <Text size="2" color="gray">Total Wagered</Text>
              </Flex>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <Flex align="baseline" gap="2">
                  <Text size="6" weight="bold">
                    {formatAmount(playerStats?.totalWagered?.toString())}
                  </Text>
                  <Text size="2" color="gray">ETH</Text>
                </Flex>
              )}
            </Flex>
          </Card>

          <Card className="card-simple hover-lift animate-fade-in">
            <Flex direction="column" gap="3" p="4">
              <Flex align="center" gap="2">
                <Trophy className="w-5 h-5 text-green-400" />
                <Text size="2" color="gray">Total Won</Text>
              </Flex>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <Flex align="baseline" gap="2">
                  <Text size="6" weight="bold" className="text-green-400">
                    {formatAmount(playerStats?.totalWon?.toString())}
                  </Text>
                  <Text size="2" color="gray">ETH</Text>
                </Flex>
              )}
            </Flex>
          </Card>

          <Card className="card-simple hover-lift animate-fade-in">
            <Flex direction="column" gap="3" p="4">
              <Flex align="center" gap="2">
                <Activity className="w-5 h-5 text-purple-400" />
                <Text size="2" color="gray">Net Profit</Text>
              </Flex>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <Flex align="baseline" gap="2">
                  <Text
                    size="6"
                    weight="bold"
                    className={netProfit >= 0n ? 'text-green-400' : 'text-red-400'}
                  >
                    {netProfit >= 0n ? '+' : ''}
                    {formatAmount(netProfit.toString())}
                  </Text>
                  <Text size="2" color="gray">ETH</Text>
                </Flex>
              )}
            </Flex>
          </Card>

          {/* Mini Win/Loss Pie Chart */}
          <Card className="card-simple hover-lift animate-fade-in">
            <Flex direction="column" gap="2" p="4" align="center">
              <Text size="2" color="gray">Win Distribution</Text>
              {isLoadingStats ? (
                <Skeleton className="h-16 w-16 rounded-full" />
              ) : pieData.length > 0 ? (
                <ResponsiveContainer width={80} height={80}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={35}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Text size="1" color="gray">No games yet</Text>
              )}
              <Flex gap="3">
                <Text size="1" className="text-green-400">{playerStats?.wins ?? 0}W</Text>
                <Text size="1" className="text-red-400">{playerStats?.losses ?? 0}L</Text>
              </Flex>
            </Flex>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid columns={{ initial: '1', md: '3' }} gap="4">
          {/* Active Games Card */}
          <Card className="card-interactive hover-lift animate-fade-in">
            <Flex direction="column" gap="4" p="5">
              <Flex align="center" justify="between">
                <Flex align="center" gap="2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <Heading size="4">Active Games</Heading>
                </Flex>
                <Badge color="yellow" variant="soft">
                  {playerStats?.pending ?? 0} Active
                </Badge>
              </Flex>
              <Text size="2" color="gray">
                You have games waiting to be matched or resolved.
              </Text>
              <Link href="/queue">
                <Button variant="soft" size="2" className="cursor-pointer w-full">
                  View Game Queue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </Flex>
          </Card>

          {/* Quick Settings Card */}
          <Card className="card-simple hover-lift animate-fade-in">
            <Flex direction="column" gap="4" p="5">
              <Flex align="center" gap="2">
                <Settings className="w-5 h-5 text-cyan-400" />
                <Heading size="4">Quick Settings</Heading>
              </Flex>

              {isLoadingPrefs ? (
                <Flex direction="column" gap="3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </Flex>
              ) : (
                <Flex direction="column" gap="3">
                  {/* Sound Toggle */}
                  <Button
                    variant={soundEnabled ? 'solid' : 'soft'}
                    color={soundEnabled ? 'cyan' : 'gray'}
                    size="2"
                    className="cursor-pointer w-full justify-start"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <VolumeX className="w-4 h-4" />
                    )}
                    Sound Effects
                    <Badge
                      color={soundEnabled ? 'green' : 'gray'}
                      variant="soft"
                      className="ml-auto"
                    >
                      {soundEnabled ? 'ON' : 'OFF'}
                    </Badge>
                  </Button>

                  {/* Animation Toggle */}
                  <Button
                    variant={!skipAnimation ? 'solid' : 'soft'}
                    color={!skipAnimation ? 'cyan' : 'gray'}
                    size="2"
                    className="cursor-pointer w-full justify-start"
                    onClick={() => setSkipAnimation(!skipAnimation)}
                  >
                    {skipAnimation ? (
                      <FastForward className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Coin Animation
                    <Badge
                      color={!skipAnimation ? 'green' : 'gray'}
                      variant="soft"
                      className="ml-auto"
                    >
                      {skipAnimation ? 'SKIP' : 'ON'}
                    </Badge>
                  </Button>
                </Flex>
              )}
            </Flex>
          </Card>

          {/* Your Ranking Card */}
          <Card className="card-interactive hover-lift animate-fade-in">
            <Flex direction="column" gap="4" p="5">
              <Flex align="center" justify="between">
                <Flex align="center" gap="2">
                  <Target className="w-5 h-5 text-cyan-400" />
                  <Heading size="4">Your Ranking</Heading>
                </Flex>
                <Link href="/leaderboard">
                  <Button variant="ghost" size="1" className="cursor-pointer">
                    View Full
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </Flex>

              {isLoadingRank ? (
                <Flex gap="4" justify="between">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-16" />
                  ))}
                </Flex>
              ) : playerRank && playerRank.player_total_games > 0 ? (
                <Grid columns="4" gap="3">
                  <Flex direction="column" align="center" gap="1" className="p-2 rounded-lg bg-slate-800/50">
                    <Trophy className="w-4 h-4 text-green-400" />
                    <Text size="4" weight="bold">#{playerRank.rank_by_wins}</Text>
                    <Text size="1" color="gray">Wins</Text>
                  </Flex>
                  <Flex direction="column" align="center" gap="1" className="p-2 rounded-lg bg-slate-800/50">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <Text size="4" weight="bold">#{playerRank.rank_by_profit}</Text>
                    <Text size="1" color="gray">Profit</Text>
                  </Flex>
                  <Flex direction="column" align="center" gap="1" className="p-2 rounded-lg bg-slate-800/50">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <Text size="4" weight="bold">#{playerRank.rank_by_winrate}</Text>
                    <Text size="1" color="gray">Win %</Text>
                  </Flex>
                  <Flex direction="column" align="center" gap="1" className="p-2 rounded-lg bg-slate-800/50">
                    <Wallet className="w-4 h-4 text-purple-400" />
                    <Text size="4" weight="bold">#{playerRank.rank_by_volume}</Text>
                    <Text size="1" color="gray">Volume</Text>
                  </Flex>
                </Grid>
              ) : (
                <Flex direction="column" align="center" gap="2" className="p-4 rounded-lg bg-slate-800/50">
                  <Text size="2" color="gray">Play some games to appear on the leaderboard!</Text>
                  <Link href="/play">
                    <Button size="2" className="cursor-pointer">
                      <Dices className="w-4 h-4" />
                      Start Playing
                    </Button>
                  </Link>
                </Flex>
              )}
            </Flex>
          </Card>
        </Grid>

        {/* Recent Games */}
        <Card className="card-simple animate-fade-in">
          <Flex direction="column" gap="4" p="5">
            <Flex align="center" justify="between">
              <Flex align="center" gap="2">
                <History className="w-5 h-5 text-purple-400" />
                <Heading size="4">Recent Games</Heading>
              </Flex>
              <Link href="/history">
                <Button variant="ghost" size="1" className="cursor-pointer">
                  View All History
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </Flex>

            <RecentGamesTable
              games={recentGames}
              userAddress={address}
              chainId={chainId}
              isLoading={isLoadingGames}
              compact
              maxRows={5}
              emptyMessage="No games played yet. Start your first game!"
            />
          </Flex>
        </Card>
      </Flex>
    </DashboardLayout>
  );
}
