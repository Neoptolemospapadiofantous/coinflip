'use client';

import { useAccount, useBalance } from 'wagmi';
import { useTiers } from '@/hooks/useTiers';
import { useGameStore } from '@/store/gameStore';
import { formatCurrency, devLog } from '@/lib/utils';
import { PLATFORM_FEE_PERCENT, WINNER_PAYOUT_PERCENT } from '@/lib/constants';
import { Skeleton, Tooltip } from '@radix-ui/themes';
import { Users, Lock, Clock, TrendingUp } from 'lucide-react';
import { NetworkIndicator } from '@/components/ui/NetworkIndicator';
import { usePendingByTier, useTierMatchTimes, getEstimatedMatchTime } from '@/hooks/useRealtimeStats';

export function TierSelector() {
  const { data: tiers, isLoading } = useTiers();
  const { selectedTier, setSelectedTier } = useGameStore();
  const { address, isConnected, chain } = useAccount();
  const { data: balance, isLoading: isBalanceLoading, error: balanceError } = useBalance({
    address,
    chainId: chain?.id,
    query: {
      enabled: Boolean(address && chain?.id),
      refetchOnWindowFocus: true,
      staleTime: 10000,
    },
  });

  const { data: pendingByTier } = usePendingByTier();
  const { data: matchTimes } = useTierMatchTimes();

  const getPendingCount = (tierId: number) =>
    pendingByTier?.find(t => t.tier === tierId)?.pending_count ?? 0;

  if (balanceError) devLog.error('Balance fetch error:', balanceError);

  if (isLoading || (isConnected && isBalanceLoading && !balance)) {
    return <TierSelectorSkeleton />;
  }

  const selectedTierData = tiers?.find(t => t.id === selectedTier);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Choose Your Bet</h3>
          <p className="text-sm text-slate-400 mt-0.5">Select amount — you'll be matched with a player at the same tier.</p>
        </div>
        {isConnected && balance && (
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-0.5">Balance</p>
            <p className="text-sm font-semibold text-slate-200">{formatCurrency(balance.value)}</p>
          </div>
        )}
        {isConnected && !balance && !isBalanceLoading && (
          <p className="text-sm text-red-400">Balance unavailable</p>
        )}
      </div>

      <NetworkIndicator />

      {/* Tier Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {tiers?.map(tier => {
          const tierAmount = BigInt(tier.amount);
          const canAfford = balance ? balance.value >= tierAmount : false;
          const isSelected = selectedTier === tier.id;
          const pendingCount = getPendingCount(tier.id);
          const matchEta = getEstimatedMatchTime(matchTimes ?? null, tier.id);
          const hasWaiters = pendingCount > 0;

          return (
            <Tooltip
              key={tier.id}
              content={!canAfford ? 'Insufficient balance' : `Win $${tier.winAmountUsd} · ${WINNER_PAYOUT_PERCENT}% payout`}
            >
              <button
                onClick={() => canAfford && setSelectedTier(tier.id)}
                disabled={!canAfford}
                className={`
                  relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200 cursor-pointer
                  touch-target w-full
                  ${!canAfford ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.03] hover:-translate-y-0.5'}
                  ${isSelected ? 'text-cyan-300' : 'text-slate-300'}
                `}
                style={
                  isSelected
                    ? {
                        background: 'rgba(6,182,212,0.1)',
                        borderColor: 'rgba(6,182,212,0.5)',
                        boxShadow: '0 0 20px rgba(6,182,212,0.2), inset 0 0 20px rgba(6,182,212,0.05)',
                      }
                    : hasWaiters
                    ? {
                        background: 'rgba(34,197,94,0.05)',
                        borderColor: 'rgba(34,197,94,0.2)',
                      }
                    : {
                        background: 'rgba(255,255,255,0.03)',
                        borderColor: 'rgba(255,255,255,0.08)',
                      }
                }
              >
                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400"
                    style={{ boxShadow: '0 0 6px rgba(6,182,212,0.8)' }} />
                )}

                {/* Amount */}
                <span className={`text-2xl font-black tracking-tight ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                  ${tier.amountUsd}
                </span>

                {/* Win amount */}
                <span className="text-xs text-slate-500 font-medium">
                  Win <span className={isSelected ? 'text-cyan-400' : 'text-green-400'}>${tier.winAmountUsd}</span>
                </span>

                {/* Status badge */}
                {!canAfford ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-red-400"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <Lock className="w-2.5 h-2.5" /> Low bal
                  </span>
                ) : hasWaiters ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-green-400"
                    style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                    <Users className="w-2.5 h-2.5" />
                    <span className="hidden sm:inline">{pendingCount} waiting</span>
                    <span className="sm:hidden">{pendingCount}</span>
                  </span>
                ) : matchEta.estimate !== 'N/A' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-slate-400"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Clock className="w-2.5 h-2.5" />
                    <span className="hidden sm:inline">{matchEta.estimate}</span>
                  </span>
                ) : null}
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Selected summary */}
      {selectedTierData && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl animate-slide-up"
          style={{ background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)' }}
        >
          <TrendingUp className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-cyan-300">
              ${selectedTierData.amountUsd} bet selected
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Win up to ${selectedTierData.winAmountUsd} · {WINNER_PAYOUT_PERCENT}% payout · {PLATFORM_FEE_PERCENT}% platform fee
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function TierSelectorSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Skeleton><div className="h-7 w-40 rounded-lg" /></Skeleton>
        <Skeleton><div className="h-5 w-24 rounded-lg" /></Skeleton>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i}><div className="h-28 rounded-2xl" /></Skeleton>
        ))}
      </div>
    </div>
  );
}
