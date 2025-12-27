'use client';

import { Layout } from '@/components/layout/Layout';
import {
  Container,
  Section,
  Heading,
  Card,
  Flex,
  Text,
  Grid,
  Badge,
  Table,
  Avatar,
  Button,
  Tabs,
} from '@radix-ui/themes';
import { Trophy, TrendingUp, Zap, Crown } from 'lucide-react';
import { formatAddress, formatCurrency } from '@/lib/utils';
import { createAvatar } from '@dicebear/core';
import { identicon } from '@dicebear/collection';

// Mock leaderboard data (will be replaced with real data from database)
const mockLeaders = [
  {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb3',
    wins: 156,
    totalGames: 200,
    totalWagered: '25000000000000000000',
    profit: '5000000000000000000',
    winRate: 78,
  },
  {
    address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    wins: 142,
    totalGames: 185,
    totalWagered: '22000000000000000000',
    profit: '4200000000000000000',
    winRate: 76.7,
  },
  {
    address: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
    wins: 98,
    totalGames: 125,
    totalWagered: '18000000000000000000',
    profit: '3800000000000000000',
    winRate: 78.4,
  },
  {
    address: '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E',
    wins: 87,
    totalGames: 110,
    totalWagered: '15000000000000000000',
    profit: '3200000000000000000',
    winRate: 79.1,
  },
  {
    address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
    wins: 72,
    totalGames: 95,
    totalWagered: '12000000000000000000',
    profit: '2500000000000000000',
    winRate: 75.8,
  },
];

function PlayerAvatar({ address }: { address: string }) {
  const avatar = createAvatar(identicon, {
    seed: address,
    size: 40,
  });

  return (
    <img
      src={avatar.toDataUri()}
      alt={`Avatar for ${address.slice(0, 6)}...${address.slice(-4)}`}
      className="w-10 h-10 rounded-full overflow-hidden border-2 border-cyan-500/30"
    />
  );
}

function RankBadge({ rank }: { rank: number }) {
  // 5-Color System: 1st=Yellow(gold), 2nd=Cyan(silver), 3rd=Purple(bronze)
  const colors = {
    1: 'bg-gradient-to-br from-yellow-300 to-yellow-500',
    2: 'bg-gradient-to-br from-cyan-400 to-cyan-600',
    3: 'bg-gradient-to-br from-purple-400 to-purple-600',
  };

  const glowColors = {
    1: 'glow-warning',
    2: 'glow-primary',
    3: 'glow-accent',
  };

  const icons = {
    1: <Crown className="w-4 h-4" />,
    2: <Trophy className="w-4 h-4" />,
    3: <Trophy className="w-4 h-4" />,
  };

  if (rank <= 3) {
    return (
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          colors[rank as keyof typeof colors]
        } ${glowColors[rank as keyof typeof glowColors]} text-white font-bold`}
      >
        {icons[rank as keyof typeof icons]}
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-gray-400 font-bold">
      {rank}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Layout>
      <Section size="3">
        <Container size="4">
          <Flex direction="column" gap="6">
            {/* Header */}
            <Flex direction="column" align="center" gap="4" className="text-center">
              <Trophy className="w-16 h-16 text-yellow-400 glow-warning" />
              <Heading size="8" className="text-gradient-rainbow">
                Leaderboard
              </Heading>
              <Text size="4" color="gray">
                Top players ranked by wins, profit, and win rate
              </Text>
            </Flex>

            {/* Top 3 Podium */}
            <Card className="card-simple p-8">
              <Grid columns="3" gap="6" className="max-w-4xl mx-auto">
                {/* 2nd Place */}
                <Flex direction="column" align="center" gap="3" className="mt-8">
                  <div className="relative">
                    <PlayerAvatar address={mockLeaders[1].address} />
                    <div className="absolute -top-2 -right-2">
                      <Badge color="gray" size="1">
                        2nd
                      </Badge>
                    </div>
                  </div>
                  <Text size="2" weight="bold">
                    {formatAddress(mockLeaders[1].address)}
                  </Text>
                  <Card className="w-full card-solid p-4 border-2 border-gray-400/40">
                    <Flex direction="column" gap="2" align="center">
                      <Text size="1" color="gray">
                        Wins
                      </Text>
                      <Heading size="6" className="text-gray-400">
                        {mockLeaders[1].wins}
                      </Heading>
                      <Text size="1" color="gray">
                        {mockLeaders[1].winRate}% WR
                      </Text>
                    </Flex>
                  </Card>
                </Flex>

                {/* 1st Place */}
                <Flex direction="column" align="center" gap="3">
                  <div className="relative animate-pulse-slow">
                    <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-xl"></div>
                    <PlayerAvatar address={mockLeaders[0].address} />
                    <div className="absolute -top-2 -right-2">
                      <Crown className="w-6 h-6 text-yellow-400" />
                    </div>
                  </div>
                  <Text size="3" weight="bold" className="text-yellow-400">
                    {formatAddress(mockLeaders[0].address)}
                  </Text>
                  <Card className="w-full card-solid p-4 border-2 border-yellow-400/60">
                    <Flex direction="column" gap="2" align="center">
                      <Text size="1" color="gray">
                        Wins
                      </Text>
                      <Heading size="7" className="text-yellow-400">
                        {mockLeaders[0].wins}
                      </Heading>
                      <Text size="1" color="gray">
                        {mockLeaders[0].winRate}% WR
                      </Text>
                    </Flex>
                  </Card>
                </Flex>

                {/* 3rd Place */}
                <Flex direction="column" align="center" gap="3" className="mt-12">
                  <div className="relative">
                    <PlayerAvatar address={mockLeaders[2].address} />
                    <div className="absolute -top-2 -right-2">
                      <Badge color="purple" size="1">
                        3rd
                      </Badge>
                    </div>
                  </div>
                  <Text size="2" weight="bold">
                    {formatAddress(mockLeaders[2].address)}
                  </Text>
                  <Card className="w-full card-solid p-4 border-2 border-purple-400/40">
                    <Flex direction="column" gap="2" align="center">
                      <Text size="1" color="gray">
                        Wins
                      </Text>
                      <Heading size="6" className="text-purple-400">
                        {mockLeaders[2].wins}
                      </Heading>
                      <Text size="1" color="gray">
                        {mockLeaders[2].winRate}% WR
                      </Text>
                    </Flex>
                  </Card>
                </Flex>
              </Grid>
            </Card>

            {/* Full Leaderboard */}
            <Card className="card-simple">
              <Tabs.Root defaultValue="wins">
                <Tabs.List>
                  <Tabs.Trigger value="wins">Most Wins</Tabs.Trigger>
                  <Tabs.Trigger value="profit">Most Profit</Tabs.Trigger>
                  <Tabs.Trigger value="winrate">Win Rate</Tabs.Trigger>
                  <Tabs.Trigger value="volume">Volume</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="wins">
                  <div className="overflow-x-auto">
                    <Table.Root>
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>Rank</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Player</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Wins</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Games</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Win Rate</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Profit</Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {mockLeaders.map((player, index) => (
                          <Table.Row key={player.address}>
                            <Table.Cell>
                              <RankBadge rank={index + 1} />
                            </Table.Cell>
                            <Table.Cell>
                              <Flex gap="3" align="center">
                                <PlayerAvatar address={player.address} />
                                <Text weight="medium">{formatAddress(player.address)}</Text>
                              </Flex>
                            </Table.Cell>
                            <Table.Cell>
                              <Text weight="bold" className="text-green-400">
                                {player.wins}
                              </Text>
                            </Table.Cell>
                            <Table.Cell>{player.totalGames}</Table.Cell>
                            <Table.Cell>
                              <Badge color={player.winRate >= 75 ? 'green' : 'yellow'}>
                                {player.winRate.toFixed(1)}%
                              </Badge>
                            </Table.Cell>
                            <Table.Cell>
                              <Text className="text-cyan-400">
                                +{formatCurrency(player.profit)}
                              </Text>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </div>
                </Tabs.Content>

                <Tabs.Content value="profit">
                  <Flex direction="column" align="center" gap="4" py="8">
                    <TrendingUp className="w-12 h-12 text-cyan-400" />
                    <Text color="gray">Profit leaderboard coming soon...</Text>
                  </Flex>
                </Tabs.Content>

                <Tabs.Content value="winrate">
                  <Flex direction="column" align="center" gap="4" py="8">
                    <Zap className="w-12 h-12 text-yellow-400" />
                    <Text color="gray">Win rate leaderboard coming soon...</Text>
                  </Flex>
                </Tabs.Content>

                <Tabs.Content value="volume">
                  <Flex direction="column" align="center" gap="4" py="8">
                    <Trophy className="w-12 h-12 text-purple-400" />
                    <Text color="gray">Volume leaderboard coming soon...</Text>
                  </Flex>
                </Tabs.Content>
              </Tabs.Root>
            </Card>

            {/* Stats Cards */}
            <Grid columns={{ initial: '1', md: '3' }} gap="4">
              <Card className="card-simple border-cyan-500/60 p-6">
                <Flex direction="column" gap="3">
                  <Flex align="center" gap="2">
                    <Trophy className="w-5 h-5 text-cyan-400" />
                    <Text size="2" color="gray">
                      Total Games Played
                    </Text>
                  </Flex>
                  <Heading size="7" className="text-cyan-400">
                    {mockLeaders.reduce((sum, p) => sum + p.totalGames, 0)}
                  </Heading>
                </Flex>
              </Card>

              <Card className="card-simple border-purple-500/60 p-6">
                <Flex direction="column" gap="3">
                  <Flex align="center" gap="2">
                    <Zap className="w-5 h-5 text-purple-400" />
                    <Text size="2" color="gray">
                      Total Volume
                    </Text>
                  </Flex>
                  <Heading size="7" className="text-purple-400">
                    {formatCurrency(
                      mockLeaders
                        .reduce((sum, p) => sum + BigInt(p.totalWagered), BigInt(0))
                        .toString()
                    )}
                  </Heading>
                </Flex>
              </Card>

              <Card className="card-simple border-green-500/60 p-6">
                <Flex direction="column" gap="3">
                  <Flex align="center" gap="2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <Text size="2" color="gray">
                      Avg Win Rate
                    </Text>
                  </Flex>
                  <Heading size="7" className="text-green-400">
                    {(mockLeaders.reduce((sum, p) => sum + p.winRate, 0) / mockLeaders.length).toFixed(1)}%
                  </Heading>
                </Flex>
              </Card>
            </Grid>
          </Flex>
        </Container>
      </Section>
    </Layout>
  );
}
