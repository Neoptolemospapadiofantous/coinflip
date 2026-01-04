'use client';

import { memo, useState, useCallback } from 'react';
import { Button, Flex, Text, DropdownMenu } from '@radix-ui/themes';
import { Download, FileText, FileSpreadsheet, Check, Loader2 } from 'lucide-react';
import { Game } from '@/types/game';
import { getCoinSideLabel, formatAddress } from '@/lib/utils';

type ExportFormat = 'csv' | 'json';

interface ExportButtonProps {
  games: Game[];
  userAddress?: string;
  filename?: string;
  disabled?: boolean;
  className?: string;
}

function gameToRow(game: Game, userAddress?: string): Record<string, string> {
  const normalizedUserAddress = userAddress?.toLowerCase();
  const isCreator = game.creator_address.toLowerCase() === normalizedUserAddress;
  const isWin = game.status === 'resolved' && game.winner_address?.toLowerCase() === normalizedUserAddress;
  const playerChoice = isCreator ? game.creator_choice : game.joiner_choice;

  return {
    'Game ID': game.id,
    'Status': game.status,
    'Result': game.status === 'resolved' ? (isWin ? 'Won' : 'Lost') : '-',
    'Amount (ETH)': (Number(game.amount) / 1e18).toFixed(6),
    'Payout (ETH)': game.payout ? (Number(game.payout) / 1e18).toFixed(6) : '-',
    'P/L (ETH)': game.status === 'resolved'
      ? isWin
        ? `+${((Number(game.payout || 0) - Number(game.amount)) / 1e18).toFixed(6)}`
        : `-${(Number(game.amount) / 1e18).toFixed(6)}`
      : '-',
    'Your Choice': playerChoice !== null && playerChoice !== undefined ? getCoinSideLabel(playerChoice) : '-',
    'Coin Result': game.coin_result !== null ? getCoinSideLabel(game.coin_result) : '-',
    'Opponent': isCreator
      ? (game.joiner_address ? formatAddress(game.joiner_address) : '-')
      : formatAddress(game.creator_address),
    'Created': new Date(game.created_at).toISOString(),
    'Resolved': game.resolved_at ? new Date(game.resolved_at).toISOString() : '-',
    'TX Hash': game.resolved_tx_hash || game.matched_tx_hash || game.tx_hash,
  };
}

function convertToCSV(data: Record<string, string>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma or quote
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    ),
  ];

  return csvRows.join('\n');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const ExportButton = memo(function ExportButton({
  games,
  userAddress,
  filename = 'coinflip-games',
  disabled = false,
  className = '',
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<ExportFormat | null>(null);

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (games.length === 0) return;

    setIsExporting(true);

    // Small delay for UX feedback
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const rows = games.map(game => gameToRow(game, userAddress));
      const timestamp = new Date().toISOString().split('T')[0];

      if (format === 'csv') {
        const csv = convertToCSV(rows);
        downloadFile(csv, `${filename}-${timestamp}.csv`, 'text/csv;charset=utf-8');
      } else {
        const json = JSON.stringify(rows, null, 2);
        downloadFile(json, `${filename}-${timestamp}.json`, 'application/json');
      }

      setExportSuccess(format);
      setTimeout(() => setExportSuccess(null), 2000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [games, userAddress, filename]);

  const isDisabled = disabled || games.length === 0 || isExporting;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger disabled={isDisabled}>
        <Button
          variant="soft"
          size="2"
          disabled={isDisabled}
          className={`cursor-pointer ${className}`}
        >
          <Flex align="center" gap="2">
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : exportSuccess ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {isExporting ? 'Exporting...' : exportSuccess ? 'Exported!' : 'Export'}
            </span>
          </Flex>
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content>
        <DropdownMenu.Item onClick={() => handleExport('csv')} className="cursor-pointer">
          <Flex align="center" gap="2">
            <FileSpreadsheet className="w-4 h-4" />
            <Text>Export as CSV</Text>
          </Flex>
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => handleExport('json')} className="cursor-pointer">
          <Flex align="center" gap="2">
            <FileText className="w-4 h-4" />
            <Text>Export as JSON</Text>
          </Flex>
        </DropdownMenu.Item>

        {games.length > 0 && (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item disabled>
              <Text size="1" color="gray">{games.length} games will be exported</Text>
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
});
