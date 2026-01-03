'use client';

import { Flex, Card, Text, Heading, Box, Grid, Badge } from '@radix-ui/themes';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Dices,
  TrendingUp,
  TrendingDown,
  Trophy,
  Target,
  Flame,
  Calendar,
  Clock,
  BarChart3,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { usePlayerStats, usePlayerGames } from '@/hooks/useGames';
import { formatEther } from 'viem';

export default function StatsPage() {
  const { address } = useAccount();
  const { data: playerStats } = usePlayerStats(address);
  const { data: recentGames = [] } = usePlayerGames(address, 100);

  const formatAmount = (wei: string | bigint | undefined) => {
    if (!wei || wei === '0' || wei === 0n) return '0';
    const eth = parseFloat(formatEther(typeof wei === 'bigint' ? wei : BigInt(wei)));
    return eth.toFixed(4);
  };

  // Calculate win rate from wins and losses
  const totalResolved = (playerStats?.wins ?? 0) + (playerStats?.losses ?? 0);
  const calculatedWinRate = totalResolved > 0 ? ((playerStats?.wins ?? 0) / totalResolved) * 100 : 50;

  // Calculate net profit
  const netProfit = (playerStats?.totalWon ?? BigInt(0)) - (playerStats?.totalWagered ?? BigInt(0));

  // Calculate streaks
  const calculateStreaks = () => {
    let currentStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;
    let lastResult: 'win' | 'loss' | null = null;

    const resolvedGames = recentGames
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
  };

  const streaks = calculateStreaks();

  // Calculate tier breakdown
  const tierBreakdown = () => {
    const tiers: Record<number, { games: number; wins: number }> = {};

    for (const game of recentGames.filter((g) => g.status === 'resolved')) {
      if (!tiers[game.tier]) {
        tiers[game.tier] = { games: 0, wins: 0 };
      }
      tiers[game.tier].games++;
      if (game.winner_address?.toLowerCase() === address?.toLowerCase()) {
        tiers[game.tier].wins++;
      }
    }

    return Object.entries(tiers).map(([tier, data]) => ({
      tier: parseInt(tier),
      games: data.games,
      wins: data.wins,
      winRate: data.games > 0 ? (data.wins / data.games) * 100 : 0,
    }));
  };

  const tierStats = tierBreakdown();

  return (
    <DashboardLayout title="Statistics" description="Your detailed gaming statistics and analytics.">
      <Flex direction="column" gap="6">
        {/* Overview Stats */}
        <Grid columns={{ initial: '2', md: '4' }} gap="4">
          <StatCard
            label="Total Games"
            value={playerStats?.totalGames ?? 0}
            icon={<Dices className="w-5 h-5" />}
            color="cyan"
          />
          <StatCard
            label="Win Rate"
            value={`${calculatedWinRate.toFixed(1)}%`}
            icon={<Target className="w-5 h-5" />}
            color="purple"
          />
          <StatCard
            label="Wins"
            value={playerStats?.wins ?? 0}
            icon={<Trophy className="w-5 h-5" />}
            color="green"
          />
          <StatCard
            label="Losses"
            value={playerStats?.losses ?? 0}
            icon={<TrendingDown className="w-5 h-5" />}
            color="red"
          />
        </Grid>

        {/* Streaks */}
        <Card className="card-simple">
          <Flex direction="column" gap="4" p="5">
            <Flex align="center" gap="2">
              <Flame className="w-5 h-5 text-orange-400" />
              <Heading size="4">Streaks</Heading>
            </Flex>
            <Grid columns={{ initial: '1', md: '3' }} gap="4">
              <Box className="p-4 rounded-lg bg-slate-800/50">
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
              <Box className="p-4 rounded-lg bg-slate-800/50">
                <Flex direction="column" gap="2">
                  <Text size="2" color="gray">Longest Win Streak</Text>
                  <Flex align="center" gap="2">
                    <Text size="6" weight="bold" className="text-green-400">
                      {streaks.longestWinStreak}
                    </Text>
                    <Badge color="green" variant="soft">Wins</Badge>
                  </Flex>
                </Flex>
              </Box>
              <Box className="p-4 rounded-lg bg-slate-800/50">
                <Flex direction="column" gap="2">
                  <Text size="2" color="gray">Longest Loss Streak</Text>
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

        {/* Financial Overview */}
        <Card className="card-simple">
          <Flex direction="column" gap="4" p="5">
            <Flex align="center" gap="2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <Heading size="4">Financial Overview</Heading>
            </Flex>
            <Grid columns={{ initial: '1', md: '3' }} gap="4">
              <Box className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                <Flex direction="column" gap="2">
                  <Text size="2" color="gray">Total Wagered</Text>
                  <Flex align="baseline" gap="1">
                    <Text size="5" weight="bold">{formatAmount(playerStats?.totalWagered)}</Text>
                    <Text size="2" color="gray">ETH</Text>
                  </Flex>
                </Flex>
              </Box>
              <Box className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <Flex direction="column" gap="2">
                  <Text size="2" color="gray">Total Won</Text>
                  <Flex align="baseline" gap="1">
                    <Text size="5" weight="bold" className="text-green-400">
                      {formatAmount(playerStats?.totalWon)}
                    </Text>
                    <Text size="2" color="gray">ETH</Text>
                  </Flex>
                </Flex>
              </Box>
              <Box className={`p-4 rounded-lg ${netProfit >= 0n ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border`}>
                <Flex direction="column" gap="2">
                  <Text size="2" color="gray">Net Profit</Text>
                  <Flex align="baseline" gap="1">
                    <Text
                      size="5"
                      weight="bold"
                      className={netProfit >= 0n ? 'text-green-400' : 'text-red-400'}
                    >
                      {netProfit >= 0n ? '+' : ''}
                      {formatAmount(netProfit)}
                    </Text>
                    <Text size="2" color="gray">ETH</Text>
                  </Flex>
                </Flex>
              </Box>
            </Grid>
          </Flex>
        </Card>

        {/* Tier Breakdown */}
        <Card className="card-simple">
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
                    className="p-4 rounded-lg bg-slate-800/50"
                  >
                    <Flex align="center" gap="3">
                      <Badge size="2" color="cyan" variant="soft">
                        Tier {tier.tier}
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
                          <Box className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <Box
                              className="h-full bg-gradient-to-r from-cyan-500 to-green-500"
                              style={{ width: `${tier.winRate}%` }}
                            />
                          </Box>
                          <Text size="1" color="gray">
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
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'cyan' | 'purple' | 'green' | 'red';
}) {
  const colorClasses = {
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    red: 'text-red-400',
  };

  return (
    <Card className="card-simple">
      <Flex direction="column" gap="3" p="4">
        <Flex align="center" justify="between">
          <Text size="2" color="gray">{label}</Text>
          <span className={colorClasses[color]}>{icon}</span>
        </Flex>
        <Text size="7" weight="bold">{value}</Text>
      </Flex>
    </Card>
  );
}
