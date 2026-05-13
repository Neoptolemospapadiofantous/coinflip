'use client';

import { memo } from 'react';
import { Table, Skeleton } from '@radix-ui/themes';
import { ExternalLink } from 'lucide-react';
import { Game } from '@/types/game';
import { formatCurrency, formatRelativeTime, formatGameId, getCoinSideLabel, formatTxHash, getBlockExplorerUrl, formatAddress } from '@/lib/utils';

interface RecentGamesTableProps {
  games: Game[];
  userAddress?: string;
  chainId?: number;
  isLoading?: boolean;
  showPlayer?: boolean;
  compact?: boolean;
  maxRows?: number;
  emptyMessage?: string;
}

function GamesTableSkeleton({ rows = 5, compact = false }: { rows?: number; compact?: boolean }) {
  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Game</Table.ColumnHeaderCell>
          {!compact && <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>}
          <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Result</Table.ColumnHeaderCell>
          {!compact && <Table.ColumnHeaderCell>TX</Table.ColumnHeaderCell>}
          <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {Array.from({ length: rows }).map((_, i) => (
          <Table.Row key={i}>
            <Table.Cell><Skeleton className="h-4 w-12" /></Table.Cell>
            {!compact && <Table.Cell><Skeleton className="h-5 w-16 rounded-full" /></Table.Cell>}
            <Table.Cell><Skeleton className="h-4 w-20" /></Table.Cell>
            <Table.Cell><Skeleton className="h-4 w-24" /></Table.Cell>
            {!compact && <Table.Cell><Skeleton className="h-4 w-20" /></Table.Cell>}
            <Table.Cell><Skeleton className="h-4 w-16" /></Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

export const RecentGamesTable = memo(function RecentGamesTable({
  games,
  userAddress,
  chainId,
  isLoading = false,
  showPlayer = false,
  compact = false,
  maxRows = 50,
  emptyMessage = 'No games found',
}: RecentGamesTableProps) {
  if (isLoading) {
    return <GamesTableSkeleton rows={Math.min(5, maxRows)} compact={compact} />;
  }

  if (games.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingTop: '32px', paddingBottom: '32px' }}>
        <span style={{ fontSize: '14px', color: 'rgba(156,163,175,1)' }}>{emptyMessage}</span>
      </div>
    );
  }

  const displayGames = games.slice(0, maxRows);
  const normalizedUserAddress = userAddress?.toLowerCase();

  const getStatusBadge = (game: Game, isWin: boolean) => {
    let color: string;
    let label: string;

    if (game.status === 'resolved') {
      color = isWin ? '#86efac' : '#fca5a5';
      label = isWin ? 'Won' : 'Lost';
    } else if (game.status === 'matched') {
      color = '#67e8f9';
      label = 'Matched';
    } else if (game.status === 'cancelled') {
      color = 'rgba(156,163,175,1)';
      label = 'Cancelled';
    } else {
      color = '#fbbf24';
      label = 'Pending';
    }

    return (
      <span style={{
        background: color + '20',
        border: '1px solid ' + color + '40',
        color,
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
      }}>
        {label}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Game</Table.ColumnHeaderCell>
            {showPlayer && <Table.ColumnHeaderCell>Player</Table.ColumnHeaderCell>}
            {!compact && <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>}
            <Table.ColumnHeaderCell>Amount</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Result</Table.ColumnHeaderCell>
            {!compact && <Table.ColumnHeaderCell>TX</Table.ColumnHeaderCell>}
            <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {displayGames.map((game) => {
            const isCreator = game.creator_address.toLowerCase() === normalizedUserAddress;
            const isWin = game.status === 'resolved' && game.winner_address?.toLowerCase() === normalizedUserAddress;
            const txHash = game.resolved_tx_hash || game.matched_tx_hash || game.tx_hash;
            const playerAddress = showPlayer
              ? (isCreator ? game.joiner_address : game.creator_address)
              : null;

            return (
              <Table.Row key={game.id} className="hover:bg-white/[0.03] transition-colors">
                <Table.Cell>
                  <code className="text-cyan-400">{formatGameId(game.id)}</code>
                </Table.Cell>

                {showPlayer && (
                  <Table.Cell>
                    <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>
                      {playerAddress ? formatAddress(playerAddress) : '-'}
                    </span>
                  </Table.Cell>
                )}

                {!compact && (
                  <Table.Cell>
                    {getStatusBadge(game, isWin)}
                  </Table.Cell>
                )}

                <Table.Cell>
                  <span style={{ fontSize: '12px' }}>{formatCurrency(game.amount)}</span>
                </Table.Cell>

                <Table.Cell>
                  {game.status === 'resolved' ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className={compact ? 'text-sm' : ''}>
                        {getCoinSideLabel(isCreator ? game.creator_choice : game.joiner_choice || false)}
                      </span>
                      {isWin && (
                        <span style={{ color: '#86efac', fontWeight: 700, fontSize: compact ? '11px' : '12px' }}>
                          +{formatCurrency(game.payout || '0')}
                        </span>
                      )}
                      {!isWin && normalizedUserAddress && (
                        <span style={{ color: '#fca5a5', fontSize: compact ? '11px' : '12px' }}>
                          -{formatCurrency(game.amount)}
                        </span>
                      )}
                    </div>
                  ) : game.status === 'cancelled' ? (
                    <span style={{ color: 'rgba(156,163,175,1)', fontSize: compact ? '11px' : '12px' }}>Refunded</span>
                  ) : (
                    <span style={{ color: 'rgba(156,163,175,1)', fontSize: compact ? '11px' : '12px' }}>
                      {getCoinSideLabel(game.creator_choice)}
                    </span>
                  )}
                </Table.Cell>

                {!compact && chainId && (
                  <Table.Cell>
                    {txHash ? (
                      <a
                        href={getBlockExplorerUrl(chainId, txHash, 'tx')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <code className="text-xs">{formatTxHash(txHash)}</code>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'rgba(156,163,175,1)' }}>-</span>
                    )}
                  </Table.Cell>
                )}

                <Table.Cell>
                  <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>
                    {formatRelativeTime(game.created_at)}
                  </span>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </div>
  );
});
