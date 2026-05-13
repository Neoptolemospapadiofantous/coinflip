'use client';

import React, { memo } from 'react';
import { Trophy, Target, TrendingUp, DollarSign, Zap, Users } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
  glowClass?: string;
}

const colorHexMap: Record<string, string> = {
  cyan: '#67e8f9',
  yellow: '#fbbf24',
  green: '#86efac',
  red: '#fca5a5',
  purple: '#c4b5fd',
};

export const StatsCard = memo(function StatsCard({ icon, label, value, color = 'cyan', glowClass = 'glow-primary' }: StatsCardProps) {
  const accentColor = colorHexMap[color] ?? colorHexMap.cyan;

  return (
    <div
      className={glowClass}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px',
        borderLeft: `3px solid ${accentColor}`,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          <span style={{ fontSize: '12px', color: 'rgba(156,163,175,1)' }}>
            {label}
          </span>
        </div>
        <span style={{ fontSize: '28px', fontWeight: 700, color: accentColor, lineHeight: 1.2 }}>
          {value}
        </span>
      </div>
    </div>
  );
});

interface GameStatsProps {
  totalGames?: number;
  wins?: number;
  totalWagered?: string;
  profitLoss?: string;
  winRate?: number;
  avgGameDuration?: number;
}

export const GameStatsGrid = memo(function GameStatsGrid({
  totalGames = 0,
  wins: _wins = 0,
  totalWagered = '0',
  profitLoss = '0',
  winRate = 0,
}: GameStatsProps) {
  const isProfit = BigInt(profitLoss) > BigInt(0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '16px' }} className="sm:grid-cols-2 md:grid-cols-4">
      <StatsCard
        icon={<Target className="w-5 h-5 text-cyan-400" />}
        label="Total Games"
        value={totalGames}
        color="cyan"
        glowClass="glow-primary"
      />

      <StatsCard
        icon={<Trophy className="w-5 h-5 text-green-400" />}
        label="Win Rate"
        value={`${winRate.toFixed(1)}%`}
        color="green"
        glowClass="glow-success"
      />

      <StatsCard
        icon={<DollarSign className="w-5 h-5 text-purple-400" />}
        label="Total Wagered"
        value={formatCurrency(totalWagered)}
        color="purple"
        glowClass="glow-accent"
      />

      <StatsCard
        icon={isProfit ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingUp className="w-5 h-5 text-red-400" />}
        label="Profit/Loss"
        value={`${isProfit ? '+' : ''}${formatCurrency(profitLoss)}`}
        color={isProfit ? 'green' : 'red'}
        glowClass={isProfit ? 'glow-success' : 'glow-danger'}
      />
    </div>
  );
});

export const GlobalStatsGrid = memo(function GlobalStatsGrid({
  totalGames = 0,
  activePlayers = 0,
  totalVolume = '0',
  avgWinRate = 0,
}: {
  totalGames?: number;
  activePlayers?: number;
  totalVolume?: string;
  avgWinRate?: number;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '16px' }} className="sm:grid-cols-2 md:grid-cols-4">
      <StatsCard
        icon={<Zap className="w-5 h-5 text-cyan-400" />}
        label="Total Games"
        value={formatNumber(totalGames)}
        color="cyan"
        glowClass="glow-primary"
      />

      <StatsCard
        icon={<Users className="w-5 h-5 text-purple-400" />}
        label="Active Players"
        value={formatNumber(activePlayers)}
        color="purple"
        glowClass="glow-accent"
      />

      <StatsCard
        icon={<DollarSign className="w-5 h-5 text-green-400" />}
        label="Total Volume"
        value={formatCurrency(totalVolume)}
        color="green"
        glowClass="glow-success"
      />

      <StatsCard
        icon={<Trophy className="w-5 h-5 text-yellow-400" />}
        label="Avg Win Rate"
        value={`${avgWinRate.toFixed(1)}%`}
        color="yellow"
        glowClass="glow-warning"
      />
    </div>
  );
});
