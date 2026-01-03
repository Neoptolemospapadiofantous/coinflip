'use client';

import { Flex, Card, Text, Heading, Box, Grid, Badge, Button } from '@radix-ui/themes';
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
} from 'lucide-react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { usePlayerStats } from '@/hooks/useGames';
import { useAuth } from '@/hooks/useAuth';
import { formatEther } from 'viem';

export default function DashboardPage() {
  const { address } = useAccount();
  const { user } = useAuth();
  const { data: playerStats } = usePlayerStats(address);

  const formatAmount = (wei: string | undefined) => {
    if (!wei || wei === '0') return '0';
    const eth = parseFloat(formatEther(BigInt(wei)));
    return eth.toFixed(4);
  };

  // Calculate win rate from wins and losses
  const totalResolved = (playerStats?.wins ?? 0) + (playerStats?.losses ?? 0);
  const winRate = totalResolved > 0 ? ((playerStats?.wins ?? 0) / totalResolved) * 100 : 50;

  // Calculate net profit
  const netProfit = (playerStats?.totalWon ?? BigInt(0)) - (playerStats?.totalWagered ?? BigInt(0));

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
        <Card className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/30">
          <Flex justify="between" align="center" p="5">
            <Flex direction="column" gap="2">
              <Heading size="6">
                Welcome back, {user?.email?.split('@')[0] || 'Player'}!
              </Heading>
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
          {stats.map((stat) => (
            <Card key={stat.label} className="card-simple">
              <Flex direction="column" gap="3" p="4">
                <Flex align="center" justify="between">
                  <Text size="2" color="gray">
                    {stat.label}
                  </Text>
                  {stat.icon}
                </Flex>
                <Text size="7" weight="bold">
                  {stat.value}
                </Text>
              </Flex>
            </Card>
          ))}
        </Grid>

        {/* Financial Stats */}
        <Grid columns={{ initial: '1', md: '3' }} gap="4">
          <Card className="card-simple">
            <Flex direction="column" gap="3" p="4">
              <Flex align="center" gap="2">
                <Wallet className="w-5 h-5 text-cyan-400" />
                <Text size="2" color="gray">
                  Total Wagered
                </Text>
              </Flex>
              <Flex align="baseline" gap="2">
                <Text size="6" weight="bold">
                  {formatAmount(playerStats?.totalWagered?.toString())}
                </Text>
                <Text size="2" color="gray">
                  ETH
                </Text>
              </Flex>
            </Flex>
          </Card>

          <Card className="card-simple">
            <Flex direction="column" gap="3" p="4">
              <Flex align="center" gap="2">
                <Trophy className="w-5 h-5 text-green-400" />
                <Text size="2" color="gray">
                  Total Won
                </Text>
              </Flex>
              <Flex align="baseline" gap="2">
                <Text size="6" weight="bold" className="text-green-400">
                  {formatAmount(playerStats?.totalWon?.toString())}
                </Text>
                <Text size="2" color="gray">
                  ETH
                </Text>
              </Flex>
            </Flex>
          </Card>

          <Card className="card-simple">
            <Flex direction="column" gap="3" p="4">
              <Flex align="center" gap="2">
                <Activity className="w-5 h-5 text-purple-400" />
                <Text size="2" color="gray">
                  Net Profit
                </Text>
              </Flex>
              <Flex align="baseline" gap="2">
                <Text
                  size="6"
                  weight="bold"
                  className={netProfit >= 0n ? 'text-green-400' : 'text-red-400'}
                >
                  {netProfit >= 0n ? '+' : ''}
                  {formatAmount(netProfit.toString())}
                </Text>
                <Text size="2" color="gray">
                  ETH
                </Text>
              </Flex>
            </Flex>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid columns={{ initial: '1', md: '2' }} gap="4">
          {/* Active Games Card */}
          <Card className="card-interactive">
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

          {/* Recent Activity Card */}
          <Card className="card-interactive">
            <Flex direction="column" gap="4" p="5">
              <Flex align="center" justify="between">
                <Flex align="center" gap="2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  <Heading size="4">Quick Play</Heading>
                </Flex>
                <Badge color="cyan" variant="soft">
                  Instant Match
                </Badge>
              </Flex>
              <Text size="2" color="gray">
                Jump into a game instantly with our quick match feature.
              </Text>
              <Link href="/play">
                <Button size="2" className="cursor-pointer w-full">
                  <Dices className="w-4 h-4" />
                  Start New Game
                </Button>
              </Link>
            </Flex>
          </Card>
        </Grid>

        {/* Leaderboard Preview */}
        <Card className="card-simple">
          <Flex direction="column" gap="4" p="5">
            <Flex align="center" justify="between">
              <Flex align="center" gap="2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <Heading size="4">Your Ranking</Heading>
              </Flex>
              <Link href="/leaderboard">
                <Button variant="ghost" size="1" className="cursor-pointer">
                  View Full Leaderboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </Flex>
            <Flex align="center" gap="4" className="p-4 rounded-lg bg-slate-800/50">
              <Box className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                <Text size="5" weight="bold">
                  #?
                </Text>
              </Box>
              <Flex direction="column" gap="1">
                <Text size="3" weight="medium">
                  {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect Wallet'}
                </Text>
                <Text size="2" color="gray">
                  {playerStats?.totalGames ?? 0} games played
                </Text>
              </Flex>
              <Box className="ml-auto">
                <Text size="2" color="cyan">
                  {winRate.toFixed(1)}% win rate
                </Text>
              </Box>
            </Flex>
          </Flex>
        </Card>
      </Flex>
    </DashboardLayout>
  );
}
