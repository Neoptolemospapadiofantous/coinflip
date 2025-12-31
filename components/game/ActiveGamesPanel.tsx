'use client';

import { useMemo, useState, memo, useCallback } from 'react';
import { Card, Flex, Heading, Text, Badge, ScrollArea, IconButton } from '@radix-ui/themes';
import { useGameStore, MAX_CONCURRENT_GAMES } from '@/store/gameStore';
import { useUserActiveGames } from '@/hooks/useGames';
import { usePendingTransactions, PendingTransaction } from '@/hooks/usePendingTransactions';
import { Game } from '@/types/game';
import { Users, Loader2, Trophy, ChevronRight, Wifi, WifiOff, Clock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { formatCurrency, formatGameId, safeStorage } from '@/lib/utils';
import { useAccount } from 'wagmi';
import { useConnectionStatus } from '@/hooks/useRealtimeSync';
import { formatGameTimeRemaining, isGameWarning, isGameExpired } from '@/hooks/useGameTimeout';
import { parseEther } from 'viem';
import { useSharedTimer } from '@/hooks/useSharedTimer';

const PANEL_COLLAPSED_KEY = 'coinflip_active_games_collapsed';

// Connection status indicator component
function ConnectionStatusIndicator() {
  const { isConnected, isConnecting, isPolling } = useConnectionStatus();

  return (
    <Flex align="center" justify="center" gap="2">
      {isConnected ? (
        <>
          <Wifi className="w-3 h-3 text-green-400" />
          <Text size="1" className="text-green-400">Live</Text>
        </>
      ) : isConnecting ? (
        <>
          <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
          <Text size="1" className="text-yellow-400">Connecting...</Text>
        </>
      ) : isPolling ? (
        <>
          <RefreshCw className="w-3 h-3 text-yellow-400 animate-spin" />
          <Text size="1" className="text-yellow-400">Polling</Text>
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3 text-red-400" />
          <Text size="1" className="text-red-400">Offline</Text>
        </>
      )}
    </Flex>
  );
}

// Card for DB-backed pending transactions (Confirming... state)
interface PendingTxCardProps {
  tx: PendingTransaction;
}

const PendingTxCard = memo(function PendingTxCard({ tx }: PendingTxCardProps) {
  // Use amount_eth from pending transaction (stored as string, e.g., "0.001")
  const amount = tx.amount_eth ? parseEther(tx.amount_eth) : BigInt(0);

  const getTypeLabel = () => {
    switch (tx.tx_type) {
      case 'create': return 'Creating Game';
      case 'join': return 'Joining Game';
      case 'cancel': return 'Cancelling Game';
      default: return 'Processing';
    }
  };

  return (
    <Card className="card-simple opacity-75 transition-all">
      <Flex direction="column" gap="2" p="3">
        <Flex justify="between" align="center">
          <Text size="1" className="font-mono text-gray-500">
            Pending...
          </Text>
          <Badge size="1" color="purple" variant="soft">
            <Flex align="center" gap="1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Confirming...
            </Flex>
          </Badge>
        </Flex>

        <Flex justify="between" align="center">
          <Flex align="center" gap="2">
            <Text size="2">{tx.choice ? '🪙' : '👑'}</Text>
            <Text size="2" weight="bold">
              {formatCurrency(amount)}
            </Text>
          </Flex>
          <Text size="1" className="text-purple-400">{getTypeLabel()}</Text>
        </Flex>

        <Text size="1" className="text-purple-400">
          Waiting for blockchain confirmation...
        </Text>
      </Flex>
    </Card>
  );
});

interface ActiveGameCardProps {
  game: Game;
  onViewGame: (game: Game) => void;
  userAddress?: string;
}

// Memoized to prevent re-renders when parent updates but props haven't changed
// This component now only handles real DB-backed games (not optimistic/pending transactions)
const ActiveGameCard = memo(function ActiveGameCard({ game, onViewGame, userAddress }: ActiveGameCardProps) {
  const isCreator = game.creator_address?.toLowerCase() === userAddress?.toLowerCase();
  const isWinner = game.winner_address?.toLowerCase() === userAddress?.toLowerCase();
  const userChoice = isCreator ? game.creator_choice : game.joiner_choice;

  // Use shared timer for countdown - only enabled for pending games
  // This uses a single global timer shared across all cards
  useSharedTimer(1000, game.status === 'pending');

  // Time-based states for pending games
  const warning = game.status === 'pending' && isGameWarning(game);
  const expired = game.status === 'pending' && isGameExpired(game);

  const getStatusColor = () => {
    if (game.status === 'pending') {
      if (expired) return 'red';
      if (warning) return 'orange';
      return 'yellow';
    }
    switch (game.status) {
      case 'matched':
        return 'cyan';
      case 'resolved':
        return isWinner ? 'green' : 'red';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = () => {
    switch (game.status) {
      case 'pending':
        return <Users className="w-3 h-3" />;
      case 'matched':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'resolved':
        return <Trophy className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (game.status) {
      case 'pending':
        return 'Waiting';
      case 'matched':
        return 'Flipping';
      case 'resolved':
        return isWinner ? 'Won!' : 'Lost';
      default:
        return game.status;
    }
  };

  const getBorderClass = () => {
    if (game.status === 'resolved' && isWinner) return 'border-green-500/50';
    if (expired) return 'border-red-500/50';
    if (warning) return 'border-yellow-500/50';
    return '';
  };

  return (
    <Card
      className={`card-simple cursor-pointer hover:border-cyan-500/50 transition-all ${getBorderClass()}`}
      onClick={() => onViewGame(game)}
    >
      <Flex direction="column" gap="2" p="3">
        <Flex justify="between" align="center">
          <Text size="1" className="font-mono text-gray-500">
            {formatGameId(game.id)}
          </Text>
          <Badge size="1" color={getStatusColor()} variant="soft">
            <Flex align="center" gap="1">
              {getStatusIcon()}
              {getStatusText()}
            </Flex>
          </Badge>
        </Flex>

        <Flex justify="between" align="center">
          <Flex align="center" gap="2">
            <Text size="2">{userChoice ? '🪙' : '👑'}</Text>
            <Text size="2" weight="bold">
              {formatCurrency(BigInt(game.amount))}
            </Text>
          </Flex>
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </Flex>

        {/* Countdown timer for pending games */}
        {game.status === 'pending' && (
          <Flex align="center" gap="1">
            <Clock className={`w-3 h-3 ${expired ? 'text-red-400' : warning ? 'text-yellow-400' : 'text-gray-400'}`} />
            <Text size="1" className={expired ? 'text-red-400' : warning ? 'text-yellow-400' : 'text-gray-400'}>
              {formatGameTimeRemaining(game)}
            </Text>
          </Flex>
        )}

        {game.status === 'resolved' && (
          <Text size="1" className={isWinner ? 'text-green-400' : 'text-red-400'}>
            {isWinner ? `+${formatCurrency(BigInt(game.payout || 0))}` : `-${formatCurrency(BigInt(game.amount))}`}
          </Text>
        )}
      </Flex>
    </Card>
  );
});

export function ActiveGamesPanel() {
  const { address } = useAccount();
  // DB-backed active games (source of truth)
  const { data: dbActiveGames = [] } = useUserActiveGames(address);
  // DB-backed pending transactions (Confirming... state)
  const { pendingTransactions } = usePendingTransactions();
  const { queueModal } = useGameStore();

  // NOTE: Global ticker removed - each ActiveGameCard now manages its own timer
  // This prevents re-rendering all cards every second when only pending games need timers
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return safeStorage.getItem(PANEL_COLLAPSED_KEY) === 'true';
  });

  // Filter pending transactions to only show 'create' type (game creation confirmations)
  // Join/cancel transactions don't need to show in the panel as separate items
  const pendingCreateTxs = useMemo(() => {
    return pendingTransactions.filter(tx => tx.tx_type === 'create');
  }, [pendingTransactions]);

  // Persist collapse state
  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const newValue = !prev;
      safeStorage.setItem(PANEL_COLLAPSED_KEY, String(newValue));
      return newValue;
    });
  };

  // Real-time updates handled by useRealtimeSync invalidating the query

  // Memoized handler to prevent ActiveGameCard memo invalidation
  const handleViewGame = useCallback((game: Game) => {
    if (game.status === 'matched' || game.status === 'resolved') {
      queueModal(game, game.status === 'matched' ? 'matched' : 'resolved');
    }
  }, [queueModal]);

  // Filter to only show pending/matched games (resolved ones auto-close)
  // Also deduplicate by ID as a safeguard against race conditions
  const visibleGames = useMemo(() => {
    const seen = new Set<string>();
    return dbActiveGames
      .filter((g) => g.status === 'pending' || g.status === 'matched')
      .filter((g) => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });
  }, [dbActiveGames]);

  // Total count includes both pending transactions and visible games
  const totalCount = pendingCreateTxs.length + visibleGames.length;

  // Don't render if nothing to show
  if (totalCount === 0) {
    return null;
  }

  return (
    <Card className="card-solid border-purple-500/30 fixed bottom-4 right-4 z-40 w-72">
      <Flex direction="column" gap="3" p="3">
        <Flex justify="between" align="center">
          <Flex align="center" gap="2">
            <Heading size="3">Active Games</Heading>
            <Badge size="1" color="cyan">
              {totalCount}/{MAX_CONCURRENT_GAMES}
            </Badge>
          </Flex>
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            onClick={toggleCollapsed}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </IconButton>
        </Flex>

        {!isCollapsed && (
          <>
            <ScrollArea style={{ maxHeight: '200px' }}>
              <Flex direction="column" gap="2">
                {/* Pending transactions (Confirming...) - shown first */}
                {pendingCreateTxs.map((tx) => (
                  <PendingTxCard key={`tx-${tx.id}`} tx={tx} />
                ))}
                {/* DB-backed active games */}
                {visibleGames.map((game) => (
                  <ActiveGameCard
                    key={game.id}
                    game={game}
                    onViewGame={handleViewGame}
                    userAddress={address}
                  />
                ))}
              </Flex>
            </ScrollArea>

            <ConnectionStatusIndicator />
          </>
        )}
      </Flex>
    </Card>
  );
}
