'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { Table, Skeleton } from '@radix-ui/themes';
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
  const gradients: Record<number, string> = {
    1: 'linear-gradient(135deg, #fde047, #eab308)',
    2: 'linear-gradient(135deg, #22d3ee, #0891b2)',
    3: 'linear-gradient(135deg, #c084fc, #9333ea)',
  };

  const glowShadows: Record<number, string> = {
    1: '0 0 12px rgba(234,179,8,0.5)',
    2: '0 0 12px rgba(6,182,212,0.5)',
    3: '0 0 12px rgba(147,51,234,0.5)',
  };

  const icons: Record<number, React.ReactNode> = {
    1: <Crown className="w-4 h-4" />,
    2: <Trophy className="w-4 h-4" />,
    3: <Medal className="w-4 h-4" />,
  };

  if (rank <= 3) {
    return (
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: gradients[rank],
          boxShadow: glowShadows[rank],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
        }}
      >
        {icons[rank]}
      </div>
    );
  }

  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      {rank}
    </div>
  );
}

// Win-rate badge
function WinRateBadge({ rate }: { rate: number }) {
  const color =
    rate >= 60
      ? { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', text: '#4ade80' }
      : rate >= 50
      ? { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.3)', text: '#facc15' }
      : { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', text: '#f87171' };

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 9999,
        background: color.bg,
        border: `1px solid ${color.border}`,
        color: color.text,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {rate.toFixed(1)}%
    </span>
  );
}

// Podium component for top 3
function Podium({ leaders, isLoading }: { leaders: LeaderboardEntry[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: 32,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
            maxWidth: 896,
            margin: '0 auto',
          }}
        >
          {[8, 0, 12].map((mt, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                marginTop: mt * 4,
              }}
            >
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (leaders.length < 3) {
    return (
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Trophy className="w-12 h-12 text-gray-500" />
        <p style={{ color: '#94a3b8', margin: 0 }}>Not enough players yet. Be among the first!</p>
      </div>
    );
  }

  const podiumConfig = [
    {
      index: 1,
      mt: 8,
      textColor: '#94a3b8',
      borderColor: 'rgba(148,163,184,0.4)',
      glowColor: 'rgba(148,163,184,0.15)',
      labelColor: '#cbd5e1',
    },
    {
      index: 0,
      mt: 0,
      textColor: '#facc15',
      borderColor: 'rgba(250,204,21,0.6)',
      glowColor: 'rgba(250,204,21,0.2)',
      labelColor: '#fde047',
    },
    {
      index: 2,
      mt: 12,
      textColor: '#c084fc',
      borderColor: 'rgba(192,132,252,0.4)',
      glowColor: 'rgba(192,132,252,0.15)',
      labelColor: '#d8b4fe',
    },
  ];

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: 32,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
          maxWidth: 896,
          margin: '0 auto',
        }}
      >
        {podiumConfig.map(({ index, mt, textColor, borderColor, glowColor, labelColor }) => {
          const player = leaders[index];
          if (!player) return null;

          return (
            <div
              key={player.player_address}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                marginTop: mt * 4,
              }}
            >
              {/* Avatar with badge */}
              <div style={{ position: 'relative' }}>
                {index === 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(250,204,21,0.2)',
                      borderRadius: '50%',
                      filter: 'blur(16px)',
                    }}
                  />
                )}
                <PlayerAvatar address={player.player_address} />
                <div style={{ position: 'absolute', top: -8, right: -8 }}>
                  {index === 0 ? (
                    <Crown className="w-6 h-6" style={{ color: '#facc15' }} />
                  ) : (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        borderRadius: 9999,
                        background: index === 1 ? 'rgba(148,163,184,0.2)' : 'rgba(192,132,252,0.2)',
                        border: `1px solid ${index === 1 ? 'rgba(148,163,184,0.4)' : 'rgba(192,132,252,0.4)'}`,
                        color: textColor,
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {index === 1 ? '2nd' : '3rd'}
                    </span>
                  )}
                </div>
              </div>

              {/* Address */}
              <p
                style={{
                  color: labelColor,
                  fontWeight: index === 0 ? 700 : 600,
                  fontSize: index === 0 ? 15 : 13,
                  margin: 0,
                  textAlign: 'center',
                }}
              >
                {formatAddress(player.player_address)}
              </p>

              {/* Stats card */}
              <div
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: `2px solid ${borderColor}`,
                  boxShadow: `0 0 16px ${glowColor}`,
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Wins</p>
                <p
                  style={{
                    color: textColor,
                    fontSize: index === 0 ? 32 : 26,
                    fontWeight: 800,
                    lineHeight: 1,
                    margin: 0,
                  }}
                >
                  {player.wins}
                </p>
                <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>
                  {player.win_rate.toFixed(1)}% WR
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Your Position card
function YourPosition() {
  const { address } = useAccount();
  const { data: rank, isLoading } = usePlayerRank();

  if (!address) return null;

  if (isLoading) {
    return (
      <div
        style={{
          background: 'rgba(6,182,212,0.05)',
          border: '1px solid rgba(6,182,212,0.25)',
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Target className="w-5 h-5 text-cyan-400" />
          <span style={{ color: '#e2e8f0', fontWeight: 500 }}>Your Position</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!rank || rank.player_total_games === 0) {
    return (
      <div
        style={{
          background: 'rgba(6,182,212,0.05)',
          border: '1px solid rgba(6,182,212,0.25)',
          borderRadius: 16,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Target className="w-8 h-8 text-cyan-400" />
        <p style={{ color: '#94a3b8', margin: 0 }}>Play some games to appear on the leaderboard!</p>
      </div>
    );
  }

  const rankItems = [
    { label: 'By Wins', rank: rank.rank_by_wins, icon: Trophy, color: '#4ade80' },
    { label: 'By Profit', rank: rank.rank_by_profit, icon: TrendingUp, color: '#22d3ee' },
    { label: 'By Win Rate', rank: rank.rank_by_winrate, icon: Zap, color: '#facc15' },
    { label: 'By Volume', rank: rank.rank_by_volume, icon: Users, color: '#c084fc' },
  ];

  return (
    <div
      style={{
        background: 'rgba(6,182,212,0.05)',
        border: '1px solid rgba(6,182,212,0.25)',
        borderRadius: 16,
        padding: 24,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target className="w-5 h-5 text-cyan-400" />
          <span style={{ color: '#e2e8f0', fontWeight: 500 }}>Your Position</span>
        </div>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 9999,
            background: 'rgba(6,182,212,0.15)',
            border: '1px solid rgba(6,182,212,0.3)',
            color: '#22d3ee',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {rank.player_total_games} games played
        </span>
      </div>

      {/* Rank grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {rankItems.map(({ label, rank: position, icon: Icon, color }) => (
          <div
            key={label}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon style={{ width: 16, height: 16, color }} />
            <p style={{ color: '#64748b', fontSize: 11, margin: 0 }}>{label}</p>
            <p style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 800, margin: 0, lineHeight: 1 }}>
              #{position}
              <span style={{ color: '#64748b', fontSize: 11, fontWeight: 400 }}> / {rank.total_players}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13 }}>
          <span style={{ color: '#94a3b8' }}>Wins: </span>
          <span style={{ color: '#4ade80', fontWeight: 600 }}>{rank.player_wins}</span>
        </span>
        <span style={{ fontSize: 13 }}>
          <span style={{ color: '#94a3b8' }}>Win Rate: </span>
          <span style={{ color: '#facc15', fontWeight: 600 }}>{rank.player_win_rate.toFixed(1)}%</span>
        </span>
        <span style={{ fontSize: 13 }}>
          <span style={{ color: '#94a3b8' }}>Profit: </span>
          <span
            style={{
              color: BigInt(rank.player_total_profit) >= 0 ? '#4ade80' : '#f87171',
              fontWeight: 600,
            }}
          >
            {formatCurrency(rank.player_total_profit)}
          </span>
        </span>
      </div>
    </div>
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
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: '48px 0',
        }}
      >
        {searchQuery ? (
          <>
            <Search className="w-12 h-12 text-gray-500" />
            <p style={{ color: '#94a3b8', margin: 0 }}>No players found matching "{searchQuery}"</p>
          </>
        ) : (
          <>
            <Users className="w-12 h-12 text-gray-500" />
            <p style={{ color: '#94a3b8', margin: 0 }}>No players on the leaderboard yet. Be the first!</p>
          </>
        )}
      </div>
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
                style={
                  isCurrentUser
                    ? {
                        background: 'rgba(6,182,212,0.08)',
                        outline: '1px solid rgba(6,182,212,0.2)',
                        outlineOffset: '-1px',
                      }
                    : undefined
                }
                className={isCurrentUser ? '' : 'hover:bg-white/[0.03]'}
              >
                <Table.Cell>
                  <RankBadge rank={player.rank} />
                </Table.Cell>
                <Table.Cell>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <PlayerAvatar address={player.player_address} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ color: '#e2e8f0', fontWeight: 500, fontSize: 14 }}>
                        {formatAddress(player.player_address)}
                      </span>
                      {isCurrentUser && (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '1px 8px',
                            borderRadius: 9999,
                            background: 'rgba(6,182,212,0.15)',
                            border: '1px solid rgba(6,182,212,0.3)',
                            color: '#22d3ee',
                            fontSize: 11,
                            fontWeight: 600,
                            alignSelf: 'flex-start',
                          }}
                        >
                          You
                        </span>
                      )}
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span style={{ color: '#4ade80', fontWeight: 700 }}>{player.wins}</span>
                </Table.Cell>
                <Table.Cell>
                  <span style={{ color: '#94a3b8' }}>{player.total_games}</span>
                </Table.Cell>
                <Table.Cell>
                  <WinRateBadge rate={player.win_rate} />
                </Table.Cell>
                <Table.Cell>
                  <span
                    style={{
                      color:
                        type === 'volume'
                          ? '#c084fc'
                          : profitNum >= 0
                          ? '#22d3ee'
                          : '#f87171',
                      fontWeight: 500,
                    }}
                  >
                    {type !== 'volume' && profitNum >= 0 && '+'}
                    {formatCurrency(profitValue)}
                  </span>
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: 24,
            }}
          >
            <Skeleton className="h-5 w-32 mb-3" />
            <Skeleton className="h-10 w-24" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      icon: Users,
      iconColor: '#22d3ee',
      borderColor: 'rgba(6,182,212,0.3)',
      glowColor: 'rgba(6,182,212,0.08)',
      label: 'Total Players',
      value: formatLeaderboardValue(stats?.total_players ?? 0, 'number'),
      valueColor: '#22d3ee',
    },
    {
      icon: Zap,
      iconColor: '#c084fc',
      borderColor: 'rgba(147,51,234,0.3)',
      glowColor: 'rgba(147,51,234,0.08)',
      label: 'Total Volume',
      value: formatCurrency(stats?.total_volume ?? '0'),
      valueColor: '#c084fc',
    },
    {
      icon: TrendingUp,
      iconColor: '#4ade80',
      borderColor: 'rgba(34,197,94,0.3)',
      glowColor: 'rgba(34,197,94,0.08)',
      label: 'Avg Win Rate',
      value: `${(stats?.avg_win_rate ?? 50).toFixed(1)}%`,
      valueColor: '#4ade80',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
      }}
    >
      {cards.map(({ icon: Icon, iconColor, borderColor, glowColor, label, value, valueColor }) => (
        <div
          key={label}
          style={{
            background: `linear-gradient(135deg, ${glowColor}, rgba(255,255,255,0.02))`,
            border: `1px solid ${borderColor}`,
            borderRadius: 16,
            padding: 24,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            cursor: 'default',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${glowColor}`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Icon style={{ width: 20, height: 20, color: iconColor }} />
            <span style={{ color: '#94a3b8', fontSize: 13 }}>{label}</span>
          </div>
          <p style={{ color: valueColor, fontSize: 30, fontWeight: 800, margin: 0, lineHeight: 1 }}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

// Tab trigger pill button
function TabTrigger({
  value,
  active,
  onClick,
  icon: Icon,
  label,
}: {
  value: string;
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: 9999,
        background: active ? 'rgba(6,182,212,0.15)' : 'transparent',
        border: active ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(255,255,255,0.08)',
        color: active ? '#22d3ee' : '#94a3b8',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon style={{ width: 14, height: 14 }} />
      {label}
    </button>
  );
}

export default function LeaderboardPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<LeaderboardType>('wins');
  const { data: winsLeaders = [], isLoading: winsLoading } = useLeaderboard('wins', { limit: 3 });

  const tabs: { value: LeaderboardType; icon: React.ElementType; label: string }[] = [
    { value: 'wins', icon: Trophy, label: 'Most Wins' },
    { value: 'profit', icon: TrendingUp, label: 'Most Profit' },
    { value: 'winrate', icon: Zap, label: 'Win Rate' },
    { value: 'volume', icon: Users, label: 'Volume' },
  ];

  return (
    <AppLayout title="Leaderboard" description="Top players ranked by performance" requireAuth>
      <div style={{ padding: '48px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Header */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                textAlign: 'center',
              }}
              className="animate-fade-in"
            >
              <Trophy
                style={{
                  width: 64,
                  height: 64,
                  color: '#facc15',
                  filter: 'drop-shadow(0 0 16px rgba(234,179,8,0.6))',
                }}
              />
              <h1
                style={{
                  margin: 0,
                  fontSize: 'clamp(2rem, 5vw, 3rem)',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Leaderboard
              </h1>
              <p style={{ color: '#64748b', fontSize: 16, margin: 0 }}>
                Top players ranked by wins, profit, and win rate
              </p>
            </div>

            {/* Your Position */}
            <YourPosition />

            {/* Top 3 Podium */}
            <Podium leaders={winsLeaders} isLoading={winsLoading} />

            {/* Full Leaderboard */}
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              {/* Tab bar + search */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {tabs.map(({ value, icon, label }) => (
                    <TabTrigger
                      key={value}
                      value={value}
                      active={activeTab === value}
                      onClick={() => setActiveTab(value)}
                      icon={icon}
                      label={label}
                    />
                  ))}
                </div>

                {/* Search field */}
                <div style={{ position: 'relative' }}>
                  <Search
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 14,
                      height: 14,
                      color: '#64748b',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    placeholder="Search player..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.05] border border-white/10 text-slate-200 placeholder:text-slate-600 outline-none focus:border-cyan-500/50 transition-all"
                    style={{ paddingLeft: 34, width: 192 }}
                  />
                </div>
              </div>

              {/* Tab content panels */}
              <div style={{ padding: 16 }}>
                {activeTab === 'wins' && (
                  <LeaderboardTable type="wins" searchQuery={searchQuery} />
                )}
                {activeTab === 'profit' && (
                  <LeaderboardTable type="profit" searchQuery={searchQuery} />
                )}
                {activeTab === 'winrate' && (
                  <>
                    <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px 0' }}>
                      Minimum 10 games required for win rate ranking
                    </p>
                    <LeaderboardTable type="winrate" searchQuery={searchQuery} />
                  </>
                )}
                {activeTab === 'volume' && (
                  <LeaderboardTable type="volume" searchQuery={searchQuery} />
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <StatsCards />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
