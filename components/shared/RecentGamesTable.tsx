'use client';

import { memo } from 'react';
import { Table, Badge, Flex, Text, Skeleton } from '@radix-ui/themes';
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
      <Flex direction="column" align="center" gap="3" py="8">
        <Text size="3" color="gray">{emptyMessage}</Text>
      </Flex>
    );
  }

  const displayGames = games.slice(0, maxRows);
  const normalizedUserAddress = userAddress?.toLowerCase();

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
              <Table.Row key={game.id} className="hover:bg-white/5 transition-colors">
                <Table.Cell>
                  <code className="text-cyan-400">{formatGameId(game.id)}</code>
                </Table.Cell>

                {showPlayer && (
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {playerAddress ? formatAddress(playerAddress) : '-'}
                    </Text>
                  </Table.Cell>
                )}

                {!compact && (
                  <Table.Cell>
                    <Badge
                      color={
                        game.status === 'resolved'
                          ? isWin ? 'green' : 'red'
                          : game.status === 'matched'
                          ? 'blue'
                          : game.status === 'cancelled'
                          ? 'gray'
                          : 'yellow'
                      }
                    >
                      {game.status === 'resolved'
                        ? isWin ? 'Won' : 'Lost'
                        : game.status === 'cancelled'
                        ? 'Cancelled'
                        : game.status === 'matched'
                        ? 'Matched'
                        : 'Pending'}
                    </Badge>
                  </Table.Cell>
                )}

                <Table.Cell>
                  <Text size="2">{formatCurrency(game.amount)}</Text>
                </Table.Cell>

                <Table.Cell>
                  {game.status === 'resolved' ? (
                    <Flex gap="2" align="center">
                      <span className={compact ? 'text-sm' : ''}>
                        {getCoinSideLabel(isCreator ? game.creator_choice : game.joiner_choice || false)}
                      </span>
                      {isWin && (
                        <Text color="green" weight="bold" size={compact ? '1' : '2'}>
                          +{formatCurrency(game.payout || '0')}
                        </Text>
                      )}
                      {!isWin && normalizedUserAddress && (
                        <Text color="red" size={compact ? '1' : '2'}>
                          -{formatCurrency(game.amount)}
                        </Text>
                      )}
                    </Flex>
                  ) : game.status === 'cancelled' ? (
                    <Text color="gray" size={compact ? '1' : '2'}>Refunded</Text>
                  ) : (
                    <Text color="gray" size={compact ? '1' : '2'}>
                      {getCoinSideLabel(game.creator_choice)}
                    </Text>
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
                      <Text size="1" color="gray">-</Text>
                    )}
                  </Table.Cell>
                )}

                <Table.Cell>
                  <Text size="2" color="gray">
                    {formatRelativeTime(game.created_at)}
                  </Text>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </div>
  );
});
