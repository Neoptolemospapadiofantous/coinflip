'use client';

import { Flex, Skeleton } from '@radix-ui/themes';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Dices, TrendingUp, TrendingDown, Trophy, Wallet, Clock,
  Zap, ArrowRight, Activity, Flame, Target, History,
} from 'lucide-react';
import Link from 'next/link';
import { useAccount, useChainId } from 'wagmi';
import { usePlayerStats, usePlayerGames } from '@/hooks/useGames';
import { usePlayerRank } from '@/hooks/useLeaderboard';
import { useAuth } from '@/hooks/useAuth';
import { formatEther } from 'viem';
import { useMemo } from 'react';
import { RecentGamesTable } from '@/components/shared';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { theme } from '@/lib/theme';

export default function DashboardPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { user } = useAuth();
  const { data: playerStats, isLoading: isLoadingStats } = usePlayerStats(address);
  const { data: playerRank, isLoading: isLoadingRank } = usePlayerRank(address);
  const { data: recentGames = [], isLoading: isLoadingGames } = usePlayerGames(address, 5);

  const formatAmount = (wei: string | undefined | bigint) => {
    if (!wei || wei === '0') return '0';
    return parseFloat(formatEther(BigInt(wei.toString()))).toFixed(4);
  };

  const totalResolved = (playerStats?.wins ?? 0) + (playerStats?.losses ?? 0);
  const winRate = totalResolved > 0 ? ((playerStats?.wins ?? 0) / totalResolved) * 100 : 50;
  const netProfit = (playerStats?.totalWon ?? BigInt(0)) - (playerStats?.totalWagered ?? BigInt(0));

  const winStreak = useMemo(() => {
    if (!recentGames || !address) return 0;
    let streak = 0;
    for (const game of recentGames) {
      if (game.status !== 'resolved') continue;
      if (game.winner_address?.toLowerCase() === address.toLowerCase()) streak++;
      else break;
    }
    return streak;
  }, [recentGames, address]);

  const pieData = useMemo(() => [
    { name: 'Wins', value: playerStats?.wins ?? 0, color: theme.charts.winDistribution.wins },
    { name: 'Losses', value: playerStats?.losses ?? 0, color: theme.charts.winDistribution.losses },
  ].filter(d => d.value > 0), [playerStats?.wins, playerStats?.losses]);

  const stats = [
    { label: 'Total Games', value: playerStats?.totalGames ?? 0, icon: <Dices className="w-5 h-5" />, color: '#67e8f9', glow: 'rgba(6,182,212,0.2)' },
    { label: 'Wins', value: playerStats?.wins ?? 0, icon: <Trophy className="w-5 h-5" />, color: '#86efac', glow: 'rgba(34,197,94,0.2)' },
    { label: 'Losses', value: playerStats?.losses ?? 0, icon: <TrendingDown className="w-5 h-5" />, color: '#fca5a5', glow: 'rgba(239,68,68,0.15)' },
    { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, icon: <TrendingUp className="w-5 h-5" />, color: '#c4b5fd', glow: 'rgba(168,85,247,0.2)' },
  ];

  return (
    <DashboardLayout title="Dashboard" description="Welcome back! Here's your gaming overview.">
      <div className="flex flex-col gap-6">
        {/* Welcome Card */}
        <div
          className="rounded-2xl p-5 flex items-center justify-between animate-fade-in"
          style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(168,85,247,0.08) 100%)',
            border: '1px solid rgba(6,182,212,0.2)',
            boxShadow: '0 0 30px rgba(6,182,212,0.05)',
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">
                Welcome back, {user?.email?.split('@')[0] || 'Player'}!
              </h2>
              {winStreak >= 2 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-orange-300 animate-pulse"
                  style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>
                  <Flame className="w-3 h-3" /> {winStreak} Win Streak!
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">Ready for another round? Your luck awaits.</p>
          </div>
          <Link href="/play">
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)', boxShadow: '0 0 20px rgba(6,182,212,0.25)' }}
            >
              <Dices className="w-4 h-4" /> Play Now <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="rounded-xl p-4 flex flex-col gap-3 animate-fade-in transition-all hover:scale-[1.02]"
              style={{
                background: 'rgba(5,8,22,0.7)',
                backdropFilter: 'blur(16px)',
                border: `1px solid rgba(255,255,255,0.07)`,
                animationDelay: `${i * 50}ms`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{stat.label}</span>
                <div className="p-1.5 rounded-lg" style={{ background: `${stat.glow}`, color: stat.color }}>
                  {stat.icon}
                </div>
              </div>
              {isLoadingStats ? (
                <Skeleton className="h-10 w-16" />
              ) : (
                <span className="text-3xl font-black" style={{ color: stat.color }}>{stat.value}</span>
              )}
            </div>
          ))}
        </div>

        {/* Financial Stats + Mini Chart */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Wagered', icon: <Wallet className="w-4 h-4 text-cyan-400" />, value: formatAmount(playerStats?.totalWagered?.toString()), color: 'text-slate-200' },
            { label: 'Total Won', icon: <Trophy className="w-4 h-4 text-green-400" />, value: formatAmount(playerStats?.totalWon?.toString()), color: 'text-green-400' },
            {
              label: 'Net Profit',
              icon: <Activity className="w-4 h-4 text-purple-400" />,
              value: (netProfit >= 0n ? '+' : '') + formatAmount(netProfit.toString()),
              color: netProfit >= 0n ? 'text-green-400' : 'text-red-400',
            },
          ].map((item) => (
            <div key={item.label}
              className="rounded-xl p-4 flex flex-col gap-3 transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(5,8,22,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2">
                {item.icon}
                <span className="text-xs text-slate-500">{item.label}</span>
              </div>
              {isLoadingStats ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-black ${item.color}`}>{item.value}</span>
                  <span className="text-xs text-slate-600">ETH</span>
                </div>
              )}
            </div>
          ))}

          {/* Mini Pie Chart */}
          <div
            className="rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(5,8,22,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <span className="text-xs text-slate-500">Win Distribution</span>
            {isLoadingStats ? (
              <Skeleton className="h-16 w-16 rounded-full" />
            ) : pieData.length > 0 ? (
              <ResponsiveContainer width={80} height={80}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={25} outerRadius={35} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-slate-600 py-4">No games yet</span>
            )}
            <div className="flex gap-3">
              <span className="text-xs text-green-400">{playerStats?.wins ?? 0}W</span>
              <span className="text-xs text-red-400">{playerStats?.losses ?? 0}L</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Active Games */}
          <div
            className="rounded-xl p-5 flex flex-col gap-4 transition-all hover:scale-[1.01]"
            style={{ background: 'rgba(5,8,22,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                <span className="font-semibold text-white">Active Games</span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-yellow-300"
                style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)' }}>
                {playerStats?.pending ?? 0} Active
              </span>
            </div>
            <p className="text-sm text-slate-400">You have games waiting to be matched or resolved.</p>
            <Link href="/queue" className="w-full">
              <button className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-slate-300 bg-white/[0.05] border border-white/10 hover:bg-white/[0.09] hover:text-white transition-all cursor-pointer">
                View Game Queue <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>

          {/* Ranking */}
          <div
            className="rounded-xl p-5 flex flex-col gap-4 transition-all hover:scale-[1.01]"
            style={{ background: 'rgba(5,8,22,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-400" />
                <span className="font-semibold text-white">Your Ranking</span>
              </div>
              <Link href="/leaderboard">
                <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer">
                  View Full <ArrowRight className="w-3 h-3" />
                </button>
              </Link>
            </div>

            {isLoadingRank ? (
              <Flex gap="4" justify="between">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-16" />)}
              </Flex>
            ) : playerRank && playerRank.player_total_games > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { icon: <Trophy className="w-4 h-4 text-green-400" />, rank: playerRank.rank_by_wins, label: 'Wins' },
                  { icon: <TrendingUp className="w-4 h-4 text-cyan-400" />, rank: playerRank.rank_by_profit, label: 'Profit' },
                  { icon: <Zap className="w-4 h-4 text-yellow-400" />, rank: playerRank.rank_by_winrate, label: 'Win %' },
                  { icon: <Wallet className="w-4 h-4 text-purple-400" />, rank: playerRank.rank_by_volume, label: 'Volume' },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-1 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {item.icon}
                    <span className="text-lg font-black text-white">#{item.rank}</span>
                    <span className="text-[10px] text-slate-500">{item.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-sm text-slate-500">Play some games to appear on the leaderboard!</p>
                <Link href="/play">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #06b6d4, #7c3aed)' }}>
                    <Dices className="w-4 h-4" /> Start Playing
                  </button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Games */}
        <div
          className="rounded-xl p-5 flex flex-col gap-4"
          style={{ background: 'rgba(5,8,22,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" />
              <span className="font-semibold text-white">Recent Games</span>
            </div>
            <Link href="/history">
              <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-purple-400 transition-colors cursor-pointer">
                View All History <ArrowRight className="w-3 h-3" />
              </button>
            </Link>
          </div>

          <RecentGamesTable
            games={recentGames}
            userAddress={address}
            chainId={chainId}
            isLoading={isLoadingGames}
            compact
            maxRows={5}
            emptyMessage="No games played yet. Start your first game!"
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
