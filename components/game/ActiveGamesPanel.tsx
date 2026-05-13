'use client';

import { useMemo, useState, memo, useCallback, useEffect, useRef } from 'react';
import { ScrollArea } from '@radix-ui/themes';
import { useGameStore, MAX_CONCURRENT_GAMES } from '@/store/gameStore';
import { useUserActiveGames } from '@/hooks/useGames';
import { usePendingTransactions, PendingTransaction } from '@/hooks/usePendingTransactions';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { Game } from '@/types/game';
import { Users, Loader2, Trophy, Wifi, WifiOff, Clock, ChevronDown, ChevronUp, RefreshCw, Zap } from 'lucide-react';
import { formatCurrency, formatGameId, devLog } from '@/lib/utils';
import { useAccount } from 'wagmi';
import { useConnectionStatus } from '@/hooks/useRealtimeSync';
import { formatGameTimeRemaining, isGameWarning, isGameExpired } from '@/hooks/useGameTimeout';
import { useSharedTimer } from '@/hooks/useSharedTimer';
import { useDataMode } from '@/lib/data';

function ConnectionStatusIndicator() {
  const { isConnected, isConnecting, isPolling } = useConnectionStatus();
  const dataMode = useDataMode();

  if (dataMode === 'blockchain') {
    return <span title="Decentralized Mode"><Zap className="w-3 h-3 text-yellow-400" /></span>;
  }
  if (isConnected) return <span title="Live Sync"><Wifi className="w-3 h-3 text-green-400" /></span>;
  if (isConnecting) return <span title="Connecting"><Loader2 className="w-3 h-3 text-yellow-400 animate-spin" /></span>;
  if (isPolling) return <span title="Polling"><RefreshCw className="w-3 h-3 text-yellow-400 animate-spin" /></span>;
  return <span title="Offline"><WifiOff className="w-3 h-3 text-red-400" /></span>;
}

interface PendingTxCardProps { tx: PendingTransaction; }

const PendingTxCard = memo(function PendingTxCard({ tx }: PendingTxCardProps) {
  const amount = tx.amount_eth ? BigInt(tx.amount_eth) : BigInt(0);

  const getTypeLabel = () => {
    switch (tx.tx_type) {
      case 'create': return 'Creating';
      case 'join': return 'Joining';
      case 'cancel': return 'Cancelling';
      default: return 'Processing';
    }
  };

  return (
    <div className="rounded-xl p-3 opacity-75 transition-all"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{tx.choice ? '🪙' : '👑'}</span>
          <span className="text-sm font-bold text-slate-200">{formatCurrency(amount)}</span>
        </div>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-purple-300"
          style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.25)' }}>
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        </span>
      </div>
      <p className="text-xs text-slate-500">{getTypeLabel()}...</p>
    </div>
  );
});

interface ActiveGameCardProps { game: Game; onViewGame: (game: Game) => void; userAddress?: string; }

const ActiveGameCard = memo(function ActiveGameCard({ game, onViewGame, userAddress }: ActiveGameCardProps) {
  const isCreator = game.creator_address?.toLowerCase() === userAddress?.toLowerCase();
  const isWinner = game.winner_address?.toLowerCase() === userAddress?.toLowerCase();
  const userChoice = isCreator ? game.creator_choice : game.joiner_choice;

  useSharedTimer(1000, game.status === 'pending');

  const warning = game.status === 'pending' && isGameWarning(game);
  const expired = game.status === 'pending' && isGameExpired(game);

  const statusStyle = () => {
    if (game.status === 'resolved') return isWinner ? { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', color: '#86efac' } : { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', color: '#fca5a5' };
    if (game.status === 'matched') return { bg: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.3)', color: '#67e8f9' };
    if (expired) return { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', color: '#f87171' };
    if (warning) return { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)', color: '#fb923c' };
    return { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.25)', color: '#fbbf24' };
  };

  const getStatusIcon = () => {
    if (game.status === 'pending') return <Users className="w-2.5 h-2.5" />;
    if (game.status === 'matched') return <Loader2 className="w-2.5 h-2.5 animate-spin" />;
    return <Trophy className="w-2.5 h-2.5" />;
  };

  const getStatusText = () => {
    if (game.status === 'pending') return 'Waiting';
    if (game.status === 'matched') return 'Flipping';
    if (game.status === 'resolved') return isWinner ? 'Won!' : 'Lost';
    return game.status;
  };

  const cardBorderStyle = () => {
    if (game.status === 'resolved' && isWinner) return 'rgba(34,197,94,0.4)';
    if (expired) return 'rgba(239,68,68,0.4)';
    if (warning) return 'rgba(249,115,22,0.4)';
    return 'rgba(255,255,255,0.07)';
  };

  const s = statusStyle();

  return (
    <div
      className="rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.02]"
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${cardBorderStyle()}` }}
      onClick={() => onViewGame(game)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{userChoice ? '🪙' : '👑'}</span>
          <span className="text-sm font-bold text-slate-200">{formatCurrency(BigInt(game.amount))}</span>
        </div>
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
          style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
        >
          {getStatusIcon()} {getStatusText()}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-600">{formatGameId(game.id)}</span>
        {game.status === 'pending' && (
          <span className={`flex items-center gap-1 text-[10px] ${expired ? 'text-red-400' : warning ? 'text-yellow-400' : 'text-slate-500'}`}>
            <Clock className="w-2.5 h-2.5" /> {formatGameTimeRemaining(game)}
          </span>
        )}
        {game.status === 'resolved' && (
          <span className={`text-[10px] font-bold ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
            {isWinner ? `+${formatCurrency(BigInt(game.payout || 0))}` : `-${formatCurrency(BigInt(game.amount))}`}
          </span>
        )}
        {game.status === 'matched' && <span className="text-[10px] text-cyan-400">Flipping...</span>}
      </div>
    </div>
  );
});

export function ActiveGamesPanel() {
  const { address } = useAccount();
  const { data: dbActiveGames = [], isLoading: isLoadingGames } = useUserActiveGames(address);
  const { pendingTransactions, isLoading: isLoadingTx } = usePendingTransactions();
  const { activeGamesCollapsed, setActiveGamesCollapsed } = useUserPreferences();
  const { queueModal } = useGameStore();

  const [hadGames, setHadGames] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCollapsed = activeGamesCollapsed;

  const { pendingCreateTxs, visibleGames, totalCount } = useMemo(() => {
    const createTxs = pendingTransactions.filter(tx => tx.tx_type === 'create');
    const seen = new Set<string>();
    const visible = dbActiveGames
      .filter(g => g.status === 'pending' || g.status === 'matched')
      .filter(g => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });
    return { pendingCreateTxs: createTxs, visibleGames: visible, totalCount: createTxs.length + visible.length };
  }, [pendingTransactions, dbActiveGames]);

  const isLoading = isLoadingGames || isLoadingTx;

  const toggleCollapsed = useCallback(() => setActiveGamesCollapsed(!isCollapsed), [isCollapsed, setActiveGamesCollapsed]);

  const handleViewGame = useCallback((game: Game) => {
    if (game.status === 'matched' || game.status === 'resolved') {
      queueModal(game, game.status === 'matched' ? 'matched' : 'resolved');
    }
  }, [queueModal]);

  useEffect(() => {
    devLog.log('[ActiveGamesPanel] State:', { userAddress: address?.toLowerCase(), pendingTxs: pendingCreateTxs.length, visibleGames: visibleGames.length, totalCount, isLoading, hadGames });
  }, [address, pendingCreateTxs.length, visibleGames.length, totalCount, isLoading, hadGames]);

  useEffect(() => {
    if (totalCount > 0) {
      if (hideTimeoutRef.current) { clearTimeout(hideTimeoutRef.current); hideTimeoutRef.current = null; }
      setHadGames(true);
    } else if (!isLoading && hadGames) {
      if (!hideTimeoutRef.current) {
        hideTimeoutRef.current = setTimeout(() => {
          devLog.log('[ActiveGamesPanel] Timeout fired, checking if should hide');
          setHadGames(false);
          hideTimeoutRef.current = null;
        }, 1000);
      }
    }
    return () => {};
  }, [totalCount, isLoading, hadGames]);

  useEffect(() => { return () => { if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current); }; }, []);

  if (totalCount === 0 && !hadGames) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-40 w-72 rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(5,8,22,0.9)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(168,85,247,0.25)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(168,85,247,0.08)',
      }}
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Active Games</span>
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold text-cyan-300"
              style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)' }}
            >
              {totalCount}/{MAX_CONCURRENT_GAMES}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionStatusIndicator />
            <button
              onClick={toggleCollapsed}
              title={isCollapsed ? 'Expand' : 'Collapse'}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Games List */}
        {!isCollapsed && (
          <ScrollArea style={{ maxHeight: '240px' }}>
            <div className="flex flex-col gap-2">
              {pendingCreateTxs.map(tx => <PendingTxCard key={`tx-${tx.id}`} tx={tx} />)}
              {visibleGames.map(game => (
                <ActiveGameCard key={game.id} game={game} onViewGame={handleViewGame} userAddress={address} />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
