'use client';

import { useEffect, useState, useRef } from 'react';
import { Flex, Text } from '@radix-ui/themes';
import { WifiOff, RefreshCw, X, Zap } from 'lucide-react';
import { useConnectionStatus } from '@/hooks/useRealtimeSync';
import { useDataMode } from '@/lib/data';

export function ConnectionStatusBanner() {
  const { isConnected, isPolling, isDisconnected } = useConnectionStatus();
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const wasConnectedRef = useRef(true);
  const dataMode = useDataMode();

  // In decentralized mode, never show connection banner (no Supabase connection to lose)
  if (dataMode === 'blockchain') {
    return null;
  }

  // Show banner when connection degrades (was connected, now disconnected or polling)
  useEffect(() => {
    if (isConnected) {
      // Reset when connected
      wasConnectedRef.current = true;
      setShowBanner(false);
      setDismissed(false);
    } else if (wasConnectedRef.current && (isDisconnected || isPolling)) {
      // Connection degraded - show banner (only if not dismissed)
      if (!dismissed) {
        setShowBanner(true);
      }
    }
  }, [isConnected, isDisconnected, isPolling, dismissed]);

  // Auto-hide banner after 30 seconds of polling
  useEffect(() => {
    if (showBanner && isPolling) {
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [showBanner, isPolling]);

  if (!showBanner) return null;

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
  };

  return (
    <div className="fixed top-16 left-0 right-0 z-40 animate-slide-down">
      <Flex
        align="center"
        justify="center"
        gap="3"
        className={`py-2 px-4 ${
          isDisconnected
            ? 'bg-red-500/90 border-b border-red-600'
            : 'bg-yellow-500/90 border-b border-yellow-600'
        }`}
      >
        {isDisconnected ? (
          <>
            <WifiOff className="w-4 h-4 text-white" />
            <Text size="2" weight="medium" className="text-white">
              Connection lost. Reconnecting...
            </Text>
          </>
        ) : isPolling ? (
          <>
            <RefreshCw className="w-4 h-4 text-white animate-spin" />
            <Text size="2" weight="medium" className="text-white">
              Real-time updates unavailable. Using fallback polling.
            </Text>
            <Flex align="center" gap="1" className="opacity-80">
              <Text size="1" className="text-white">
                Data refreshes every few seconds
              </Text>
            </Flex>
          </>
        ) : null}

        <button
          onClick={handleDismiss}
          className="ml-2 p-1 rounded hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </Flex>
    </div>
  );
}

// Also export a small inline status indicator for use in headers/footers
export function ConnectionStatusIndicator() {
  const { isConnected, isConnecting, isPolling } = useConnectionStatus();
  const dataMode = useDataMode();

  // In decentralized mode, show blockchain indicator
  if (dataMode === 'blockchain') {
    return (
      <Flex align="center" gap="1" className="text-yellow-400">
        <Zap className="w-3 h-3" />
        <Text size="1">Blockchain</Text>
      </Flex>
    );
  }

  if (isConnected) {
    return (
      <Flex align="center" gap="1" className="text-green-400">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <Text size="1">Live</Text>
      </Flex>
    );
  }

  if (isConnecting) {
    return (
      <Flex align="center" gap="1" className="text-yellow-400">
        <RefreshCw className="w-3 h-3 animate-spin" />
        <Text size="1">Connecting...</Text>
      </Flex>
    );
  }

  if (isPolling) {
    return (
      <Flex align="center" gap="1" className="text-yellow-400">
        <RefreshCw className="w-3 h-3 animate-spin" />
        <Text size="1">Polling</Text>
      </Flex>
    );
  }

  return (
    <Flex align="center" gap="1" className="text-red-400">
      <WifiOff className="w-3 h-3" />
      <Text size="1">Offline</Text>
    </Flex>
  );
}
