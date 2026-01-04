'use client';

import { AppLayout } from '@/components/layout/AppLayout';
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
  Tabs,
  Skeleton,
  TextField,
} from '@radix-ui/themes';
import { Trophy, TrendingUp, Zap, Crown, Users, Search, Medal, Target } from 'lucide-react';
import { formatAddress, formatCurrency } from '@/lib/utils';
import { createAvatar } from '@dicebear/core';
import { identicon } from '@dicebear/collection';
import { memo, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import {
  useLeaderboard,
  usePlayerRank,
  useLeaderboardStats,
  LeaderboardEntry,
  formatLeaderboardValue,
} from '@/hooks/useLeaderboard';
import type { LeaderboardType } from '@/lib/queryKeys';

// Memoized avatar component
const PlayerAvatar = memo(function PlayerAvatar({
  address,
  size = 40,
}: {
  address: string;
  size?: number;
}) {
  const avatarSrc = useMemo(() => {
    const avatar = createAvatar(identicon, {
      seed: address,
      size,
    });
    return avatar.toDataUri();
  }, [address, size]);

  return (
    <img
      src={avatarSrc}
      alt={`Avatar for ${address.slice(0, 6)}...${address.slice(-4)}`}
      className="rounded-full overflow-hidden border-2 border-cyan-500/30"
      style={{ width: size, height: size }}
    />
  );
});

function RankBadge({ rank }: { rank: number }) {
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
    3: <Medal className="w-4 h-4" />,
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

// Podium component for top 3
function Podium({ leaders, isLoading }: { leaders: LeaderboardEntry[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="card-simple p-8">
        <Grid columns="3" gap="6" className="max-w-4xl mx-auto">
          {[8, 0, 12].map((mt, i) => (
            <Flex key={i} direction="column" align="center" gap="3" style={{ marginTop: mt * 4 }}>
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </Flex>
          ))}
        </Grid>
      </Card>
    );
  }

  if (leaders.length < 3) {
    return (
      <Card className="card-simple p-8">
        <Flex direction="column" align="center" gap="4" py="8">
          <Trophy className="w-12 h-12 text-gray-500" />
          <Text color="gray">Not enough players yet. Be among the first!</Text>
        </Flex>
      </Card>
    );
  }

  const positions = [
    { index: 1, mt: 8, color: 'gray-400', border: 'border-gray-400/40', badge: '2nd' },
    { index: 0, mt: 0, color: 'yellow-400', border: 'border-yellow-400/60', badge: null },
    { index: 2, mt: 12, color: 'purple-400', border: 'border-purple-400/40', badge: '3rd' },
  ];

  return (
    <Card className="card-simple p-8">
      <Grid columns="3" gap="6" className="max-w-4xl mx-auto">
        {positions.map(({ index, mt, color, border, badge }) => {
          const player = leaders[index];
          if (!player) return null;

          return (
            <Flex
              key={player.player_address}
              direction="column"
              align="center"
              gap="3"
              style={{ marginTop: mt * 4 }}
            >
              <div className="relative">
                {index === 0 && (
                  <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-xl animate-pulse-slow" />
                )}
                <PlayerAvatar address={player.player_address} />
                {badge ? (
                  <div className="absolute -top-2 -right-2">
                    <Badge color={index === 1 ? 'gray' : 'purple'} size="1">
                      {badge}
                    </Badge>
                  </div>
                ) : (
                  <div className="absolute -top-2 -right-2">
                    <Crown className="w-6 h-6 text-yellow-400" />
                  </div>
                )}
              </div>
              <Text size={index === 0 ? '3' : '2'} weight="bold" className={`text-${color}`}>
                {formatAddress(player.player_address)}
              </Text>
              <Card className={`w-full card-solid p-4 border-2 ${border}`}>
                <Flex direction="column" gap="2" align="center">
                  <Text size="1" color="gray">Wins</Text>
                  <Heading size={index === 0 ? '7' : '6'} className={`text-${color}`}>
                    {player.wins}
                  </Heading>
                  <Text size="1" color="gray">
                    {player.win_rate.toFixed(1)}% WR
                  </Text>
                </Flex>
              </Card>
            </Flex>
          );
        })}
      </Grid>
    </Card>
  );
}

// Your Position card
function YourPosition() {
  const { address } = useAccount();
  const { data: rank, isLoading } = usePlayerRank();

  if (!address) return null;

  if (isLoading) {
    return (
      <Card className="card-solid border-cyan-500/50 p-6 animate-fade-in">
        <Flex direction="column" gap="4">
          <Flex align="center" gap="2">
            <Target className="w-5 h-5 text-cyan-400" />
            <Text weight="medium">Your Position</Text>
          </Flex>
          <Grid columns="4" gap="4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </Grid>
        </Flex>
      </Card>
    );
  }

  if (!rank || rank.player_total_games === 0) {
    return (
      <Card className="card-solid border-cyan-500/50 p-6 animate-fade-in">
        <Flex direction="column" gap="3" align="center">
          <Target className="w-8 h-8 text-cyan-400" />
          <Text color="gray">Play some games to appear on the leaderboard!</Text>
        </Flex>
      </Card>
    );
  }

  const rankItems = [
    { label: 'By Wins', rank: rank.rank_by_wins, icon: Trophy, color: 'green' },
    { label: 'By Profit', rank: rank.rank_by_profit, icon: TrendingUp, color: 'cyan' },
    { label: 'By Win Rate', rank: rank.rank_by_winrate, icon: Zap, color: 'yellow' },
    { label: 'By Volume', rank: rank.rank_by_volume, icon: Users, color: 'purple' },
  ];

  return (
    <Card className="card-solid border-cyan-500/50 p-6 animate-fade-in">
      <Flex direction="column" gap="4">
        <Flex align="center" justify="between">
          <Flex align="center" gap="2">
            <Target className="w-5 h-5 text-cyan-400" />
            <Text weight="medium">Your Position</Text>
          </Flex>
          <Badge color="cyan" variant="soft">
            {rank.player_total_games} games played
          </Badge>
        </Flex>

        <Grid columns={{ initial: '2', md: '4' }} gap="4">
          {rankItems.map(({ label, rank: position, icon: Icon, color }) => (
            <Card key={label} className="card-simple p-4">
              <Flex direction="column" gap="2" align="center">
                <Icon className={`w-4 h-4 text-${color}-400`} />
                <Text size="1" color="gray">{label}</Text>
                <Heading size="5">
                  #{position}
                  <Text size="1" color="gray"> / {rank.total_players}</Text>
                </Heading>
              </Flex>
            </Card>
          ))}
        </Grid>

        <Flex gap="4" justify="center" className="pt-2">
          <Text size="2">
            <span className="text-gray-400">Wins:</span>{' '}
            <span className="text-green-400 font-medium">{rank.player_wins}</span>
          </Text>
          <Text size="2">
            <span className="text-gray-400">Win Rate:</span>{' '}
            <span className="text-yellow-400 font-medium">{rank.player_win_rate.toFixed(1)}%</span>
          </Text>
          <Text size="2">
            <span className="text-gray-400">Profit:</span>{' '}
            <span className={`font-medium ${BigInt(rank.player_total_profit) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(rank.player_total_profit)}
            </span>
          </Text>
        </Flex>
      </Flex>
    </Card>
  );
}

// Leaderboard table component
function LeaderboardTable({
  type,
  searchQuery,
}: {
  type: LeaderboardType;
  searchQuery: string;
}) {
  const { data: entries = [], isLoading } = useLeaderboard(type, { limit: 100 });
  const { address } = useAccount();

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries;
    const query = searchQuery.toLowerCase();
    return entries.filter((e) => e.player_address.toLowerCase().includes(query));
  }, [entries, searchQuery]);

  if (isLoading) {
    return (
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Rank</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Player</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Wins</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Games</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Win Rate</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{type === 'volume' ? 'Volume' : 'Profit'}</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {[...Array(10)].map((_, i) => (
            <Table.Row key={i}>
              <Table.Cell><Skeleton className="w-10 h-10 rounded-full" /></Table.Cell>
              <Table.Cell>
                <Flex gap="3" align="center">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </Flex>
              </Table.Cell>
              <Table.Cell><Skeleton className="h-4 w-12" /></Table.Cell>
              <Table.Cell><Skeleton className="h-4 w-12" /></Table.Cell>
              <Table.Cell><Skeleton className="h-5 w-16 rounded-full" /></Table.Cell>
              <Table.Cell><Skeleton className="h-4 w-20" /></Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    );
  }

  if (filteredEntries.length === 0) {
    return (
      <Flex direction="column" align="center" gap="4" py="8">
        {searchQuery ? (
          <>
            <Search className="w-12 h-12 text-gray-500" />
            <Text color="gray">No players found matching "{searchQuery}"</Text>
          </>
        ) : (
          <>
            <Users className="w-12 h-12 text-gray-500" />
            <Text color="gray">No players on the leaderboard yet. Be the first!</Text>
          </>
        )}
      </Flex>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Rank</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Player</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Wins</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Games</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Win Rate</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{type === 'volume' ? 'Volume' : 'Profit'}</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {filteredEntries.map((player) => {
            const isCurrentUser = address?.toLowerCase() === player.player_address.toLowerCase();
            const profitValue = type === 'volume' ? player.total_wagered : player.total_profit;
            const profitNum = BigInt(profitValue);

            return (
              <Table.Row
                key={player.player_address}
                className={isCurrentUser ? 'bg-cyan-500/10' : 'hover:bg-white/5'}
              >
                <Table.Cell>
                  <RankBadge rank={player.rank} />
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="3" align="center">
                    <PlayerAvatar address={player.player_address} />
                    <Flex direction="column">
                      <Text weight="medium">
                        {formatAddress(player.player_address)}
                      </Text>
                      {isCurrentUser && (
                        <Badge color="cyan" size="1" variant="soft">You</Badge>
                      )}
                    </Flex>
                  </Flex>
                </Table.Cell>
                <Table.Cell>
                  <Text weight="bold" className="text-green-400">
                    {player.wins}
                  </Text>
                </Table.Cell>
                <Table.Cell>{player.total_games}</Table.Cell>
                <Table.Cell>
                  <Badge
                    color={
                      player.win_rate >= 60
                        ? 'green'
                        : player.win_rate >= 50
                        ? 'yellow'
                        : 'red'
                    }
                  >
                    {player.win_rate.toFixed(1)}%
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text className={type === 'volume' ? 'text-purple-400' : profitNum >= 0 ? 'text-cyan-400' : 'text-red-400'}>
                    {type !== 'volume' && profitNum >= 0 && '+'}
                    {formatCurrency(profitValue)}
                  </Text>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </div>
  );
}

// Stats cards
function StatsCards() {
  const { data: stats, isLoading } = useLeaderboardStats();

  if (isLoading) {
    return (
      <Grid columns={{ initial: '1', md: '3' }} gap="4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="card-simple p-6">
            <Flex direction="column" gap="3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-24" />
            </Flex>
          </Card>
        ))}
      </Grid>
    );
  }

  return (
    <Grid columns={{ initial: '1', md: '3' }} gap="4">
      <Card className="card-simple border-cyan-500/60 p-6 hover-lift">
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Users className="w-5 h-5 text-cyan-400" />
            <Text size="2" color="gray">Total Players</Text>
          </Flex>
          <Heading size="7" className="text-cyan-400">
            {formatLeaderboardValue(stats?.total_players ?? 0, 'number')}
          </Heading>
        </Flex>
      </Card>

      <Card className="card-simple border-purple-500/60 p-6 hover-lift">
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Zap className="w-5 h-5 text-purple-400" />
            <Text size="2" color="gray">Total Volume</Text>
          </Flex>
          <Heading size="7" className="text-purple-400">
            {formatCurrency(stats?.total_volume ?? '0')}
          </Heading>
        </Flex>
      </Card>

      <Card className="card-simple border-green-500/60 p-6 hover-lift">
        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <Text size="2" color="gray">Avg Win Rate</Text>
          </Flex>
          <Heading size="7" className="text-green-400">
            {(stats?.avg_win_rate ?? 50).toFixed(1)}%
          </Heading>
        </Flex>
      </Card>
    </Grid>
  );
}

export default function LeaderboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<LeaderboardType>('wins');
  const { data: winsLeaders = [], isLoading: winsLoading } = useLeaderboard('wins', { limit: 3 });

  return (
    <AppLayout title="Leaderboard" description="Top players ranked by performance" requireAuth>
      <Section size="3">
        <Container size="4">
          <Flex direction="column" gap="6">
            {/* Header */}
            <Flex direction="column" align="center" gap="4" className="text-center animate-fade-in">
              <Trophy className="w-16 h-16 text-yellow-400 glow-warning" />
              <Heading size="8" className="text-gradient-rainbow">
                Leaderboard
              </Heading>
              <Text size="4" color="gray">
                Top players ranked by wins, profit, and win rate
              </Text>
            </Flex>

            {/* Your Position */}
            <YourPosition />

            {/* Top 3 Podium */}
            <Podium leaders={winsLeaders} isLoading={winsLoading} />

            {/* Full Leaderboard */}
            <Card className="card-simple">
              <Tabs.Root
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as LeaderboardType)}
              >
                <Flex justify="between" align="center" p="4" className="border-b border-slate-700/50">
                  <Tabs.List>
                    <Tabs.Trigger value="wins">
                      <Flex align="center" gap="1">
                        <Trophy className="w-4 h-4" />
                        Most Wins
                      </Flex>
                    </Tabs.Trigger>
                    <Tabs.Trigger value="profit">
                      <Flex align="center" gap="1">
                        <TrendingUp className="w-4 h-4" />
                        Most Profit
                      </Flex>
                    </Tabs.Trigger>
                    <Tabs.Trigger value="winrate">
                      <Flex align="center" gap="1">
                        <Zap className="w-4 h-4" />
                        Win Rate
                      </Flex>
                    </Tabs.Trigger>
                    <Tabs.Trigger value="volume">
                      <Flex align="center" gap="1">
                        <Users className="w-4 h-4" />
                        Volume
                      </Flex>
                    </Tabs.Trigger>
                  </Tabs.List>

                  {/* Search */}
                  <TextField.Root
                    placeholder="Search player..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    size="2"
                    className="w-48"
                  >
                    <TextField.Slot>
                      <Search className="w-3 h-3" />
                    </TextField.Slot>
                  </TextField.Root>
                </Flex>

                <Tabs.Content value="wins" className="p-4">
                  <LeaderboardTable type="wins" searchQuery={searchQuery} />
                </Tabs.Content>

                <Tabs.Content value="profit" className="p-4">
                  <LeaderboardTable type="profit" searchQuery={searchQuery} />
                </Tabs.Content>

                <Tabs.Content value="winrate" className="p-4">
                  <Text size="2" color="gray" className="mb-4">
                    Minimum 10 games required for win rate ranking
                  </Text>
                  <LeaderboardTable type="winrate" searchQuery={searchQuery} />
                </Tabs.Content>

                <Tabs.Content value="volume" className="p-4">
                  <LeaderboardTable type="volume" searchQuery={searchQuery} />
                </Tabs.Content>
              </Tabs.Root>
            </Card>

            {/* Stats Cards */}
            <StatsCards />
          </Flex>
        </Container>
      </Section>
    </AppLayout>
  );
}
