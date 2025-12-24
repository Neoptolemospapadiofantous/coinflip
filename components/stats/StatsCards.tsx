'use client';

import { Card, Flex, Text, Heading, Grid } from '@radix-ui/themes';
import { Trophy, Target, TrendingUp, DollarSign, Zap, Users } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
  glowClass?: string;
}

export function StatsCard({ icon, label, value, color = 'cyan', glowClass = 'glow-primary' }: StatsCardProps) {
  const colorClass = {
    cyan: 'text-cyan-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
  }[color] || 'text-cyan-400';

  return (
    <Card className={`card-simple card-hover ${glowClass}`}>
      <Flex direction="column" gap="2" p="4">
        <Flex align="center" gap="2">
          {icon}
          <Text size="2" color="gray">
            {label}
          </Text>
        </Flex>
        <Heading size="7" className={colorClass}>
          {value}
        </Heading>
      </Flex>
    </Card>
  );
}

interface GameStatsProps {
  totalGames?: number;
  wins?: number;
  totalWagered?: string;
  profitLoss?: string;
  winRate?: number;
  avgGameDuration?: number;
}

export function GameStatsGrid({
  totalGames = 0,
  wins = 0,
  totalWagered = '0',
  profitLoss = '0',
  winRate = 0,
}: GameStatsProps) {
  const isProfit = BigInt(profitLoss) > BigInt(0);

  return (
    <Grid columns={{ initial: '1', sm: '2', md: '4' }} gap="4">
      <StatsCard
        icon={<Target className="w-5 h-5 text-cyan-400" />}
        label="Total Games"
        value={totalGames}
        color="cyan"
        glowClass="glow-primary"
      />

      <StatsCard
        icon={<Trophy className="w-5 h-5 text-green-400" />}
        label="Win Rate"
        value={`${winRate.toFixed(1)}%`}
        color="green"
        glowClass="glow-success"
      />

      <StatsCard
        icon={<DollarSign className="w-5 h-5 text-purple-400" />}
        label="Total Wagered"
        value={formatCurrency(totalWagered)}
        color="purple"
        glowClass="glow-accent"
      />

      <StatsCard
        icon={isProfit ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingUp className="w-5 h-5 text-red-400" />}
        label="Profit/Loss"
        value={`${isProfit ? '+' : ''}${formatCurrency(profitLoss)}`}
        color={isProfit ? 'green' : 'red'}
        glowClass={isProfit ? 'glow-success' : 'glow-danger'}
      />
    </Grid>
  );
}

export function GlobalStatsGrid({
  totalGames = 0,
  activePlayers = 0,
  totalVolume = '0',
  avgWinRate = 0,
}: {
  totalGames?: number;
  activePlayers?: number;
  totalVolume?: string;
  avgWinRate?: number;
}) {
  return (
    <Grid columns={{ initial: '1', sm: '2', md: '4' }} gap="4">
      <StatsCard
        icon={<Zap className="w-5 h-5 text-cyan-400" />}
        label="Total Games"
        value={formatNumber(totalGames)}
        color="cyan"
        glowClass="glow-primary"
      />

      <StatsCard
        icon={<Users className="w-5 h-5 text-purple-400" />}
        label="Active Players"
        value={formatNumber(activePlayers)}
        color="purple"
        glowClass="glow-accent"
      />

      <StatsCard
        icon={<DollarSign className="w-5 h-5 text-green-400" />}
        label="Total Volume"
        value={formatCurrency(totalVolume)}
        color="green"
        glowClass="glow-success"
      />

      <StatsCard
        icon={<Trophy className="w-5 h-5 text-yellow-400" />}
        label="Avg Win Rate"
        value={`${avgWinRate.toFixed(1)}%`}
        color="yellow"
        glowClass="glow-warning"
      />
    </Grid>
  );
}
