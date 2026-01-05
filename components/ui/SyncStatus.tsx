'use client';

import { memo, useMemo } from 'react';
import { Flex, Text, Tooltip } from '@radix-ui/themes';
import { useIndexerStatus } from '@/hooks/useRealtimeStats';
import { useConnectionStatus } from '@/hooks/useRealtimeSync';
import { Wifi, WifiOff, Loader2, Zap } from 'lucide-react';
import { useDataMode } from '@/lib/data';

/**
 * Unified sync status indicator for the header
 * Shows realtime connection + blockchain sync in a single compact widget
 */
export const SyncStatus = memo(function SyncStatus() {
  const { isConnected, isConnecting, isPolling } = useConnectionStatus();
  const { syncStatus, lastBlock } = useIndexerStatus();
  const dataMode = useDataMode();

  // Calculate overall status
  const status = useMemo(() => {
    // In blockchain mode, show blockchain status
    if (dataMode === 'blockchain') {
      return 'blockchain';
    }
    if (!isConnected && !isPolling && !isConnecting) {
      return 'offline';
    }
    if (isConnecting) {
      return 'connecting';
    }
    if (syncStatus === 'stale') {
      return 'stale';
    }
    if (isPolling || syncStatus === 'syncing') {
      return 'syncing';
    }
    return 'live';
  }, [dataMode, isConnected, isConnecting, isPolling, syncStatus]);

  // Status configurations
  const config = useMemo(() => {
    switch (status) {
      case 'blockchain':
        return {
          icon: <Zap className="w-3 h-3" />,
          label: 'Blockchain',
          bgClass: 'bg-yellow-500/10 border-yellow-500/30',
          textClass: 'text-yellow-400',
          dotClass: 'bg-yellow-500',
          pulse: true,
          tooltip: 'Decentralized mode - reading directly from blockchain',
        };
      case 'live':
        return {
          icon: <Zap className="w-3 h-3" />,
          label: 'Live',
          bgClass: 'bg-green-500/10 border-green-500/30',
          textClass: 'text-green-400',
          dotClass: 'bg-green-500',
          pulse: true,
          tooltip: `Live updates active${lastBlock ? ` • Block ${Number(lastBlock).toLocaleString()}` : ''}`,
        };
      case 'syncing':
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          label: 'Syncing',
          bgClass: 'bg-yellow-500/10 border-yellow-500/30',
          textClass: 'text-yellow-400',
          dotClass: 'bg-yellow-500',
          pulse: false,
          tooltip: `Syncing blockchain data${lastBlock ? ` • Block ${Number(lastBlock).toLocaleString()}` : ''}`,
        };
      case 'connecting':
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          label: 'Connecting',
          bgClass: 'bg-yellow-500/10 border-yellow-500/30',
          textClass: 'text-yellow-400',
          dotClass: 'bg-yellow-500',
          pulse: false,
          tooltip: 'Establishing connection...',
        };
      case 'stale':
        return {
          icon: <Wifi className="w-3 h-3" />,
          label: 'Delayed',
          bgClass: 'bg-orange-500/10 border-orange-500/30',
          textClass: 'text-orange-400',
          dotClass: 'bg-orange-500',
          pulse: true,
          tooltip: `Data may be outdated${lastBlock ? ` • Last block ${Number(lastBlock).toLocaleString()}` : ''}`,
        };
      case 'offline':
      default:
        return {
          icon: <WifiOff className="w-3 h-3" />,
          label: 'Offline',
          bgClass: 'bg-red-500/10 border-red-500/30',
          textClass: 'text-red-400',
          dotClass: 'bg-red-500',
          pulse: true,
          tooltip: 'Connection lost - reconnecting...',
        };
    }
  }, [status, lastBlock]);

  return (
    <Tooltip content={config.tooltip}>
      <Flex
        align="center"
        gap="2"
        className={`px-2.5 py-1.5 rounded-full border transition-all duration-300 cursor-default ${config.bgClass}`}
      >
        {/* Animated status dot */}
        <span className="relative flex h-2 w-2">
          {config.pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotClass}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotClass}`} />
        </span>

        {/* Icon + Label */}
        <Flex align="center" gap="1" className={config.textClass}>
          {config.icon}
          <Text size="1" weight="medium" className="hidden sm:inline">
            {config.label}
          </Text>
        </Flex>

        {/* Block number (desktop only, when live) */}
        {status === 'live' && lastBlock && (
          <Text size="1" className="text-gray-500 hidden md:inline font-mono">
            #{Number(lastBlock).toLocaleString()}
          </Text>
        )}
      </Flex>
    </Tooltip>
  );
});

/**
 * Minimal dot indicator for very compact spaces
 */
export const SyncStatusDot = memo(function SyncStatusDot() {
  const { isConnected, isConnecting, isPolling } = useConnectionStatus();
  const { syncStatus } = useIndexerStatus();
  const dataMode = useDataMode();

  const status = useMemo(() => {
    if (dataMode === 'blockchain') return 'blockchain';
    if (!isConnected && !isPolling) return 'offline';
    if (syncStatus === 'stale') return 'stale';
    if (isConnecting || isPolling || syncStatus === 'syncing') return 'syncing';
    return 'synced';
  }, [dataMode, isConnected, isConnecting, isPolling, syncStatus]);

  const config = {
    blockchain: { color: 'bg-yellow-500', pulse: true, label: 'Blockchain mode' },
    synced: { color: 'bg-green-500', pulse: true, label: 'All systems operational' },
    syncing: { color: 'bg-yellow-500', pulse: false, label: 'Syncing data...' },
    stale: { color: 'bg-orange-500', pulse: true, label: 'Data may be outdated' },
    offline: { color: 'bg-red-500', pulse: true, label: 'Connection lost' },
  }[status];

  return (
    <Tooltip content={config.label}>
      <span className="relative flex h-2 w-2 cursor-default">
        {config.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color}`} />
      </span>
    </Tooltip>
  );
});
