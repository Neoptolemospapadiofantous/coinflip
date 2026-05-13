'use client';

import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';

type GameStatus = 'pending' | 'matched' | 'resolved' | 'cancelled';

interface StatusBadgeProps {
  status: GameStatus;
  size?: 'sm' | 'md' | 'lg';
  /** @deprecated use size instead */
  size_radix?: '1' | '2' | '3';
  showIcon?: boolean;
  className?: string;
}

const CONFIG: Record<GameStatus, { label: string; icon: React.ReactNode; style: React.CSSProperties; color: string }> = {
  pending: {
    label: 'Waiting',
    icon: <Clock className="w-3 h-3" />,
    style: { background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)', boxShadow: '0 0 8px rgba(250,204,21,0.12)' },
    color: '#fde047',
  },
  matched: {
    label: 'In Progress',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    style: { background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', boxShadow: '0 0 8px rgba(6,182,212,0.12)' },
    color: '#67e8f9',
  },
  resolved: {
    label: 'Resolved',
    icon: <CheckCircle2 className="w-3 h-3" />,
    style: { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', boxShadow: '0 0 8px rgba(34,197,94,0.12)' },
    color: '#86efac',
  },
  cancelled: {
    label: 'Cancelled',
    icon: <XCircle className="w-3 h-3" />,
    style: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' },
    color: '#fca5a5',
  },
};

const SIZE: Record<string, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-1 gap-1.5',
  lg: 'text-sm px-2.5 py-1 gap-1.5',
};

export function StatusBadge({ status, size = 'md', showIcon = true, className = '' }: StatusBadgeProps) {
  const cfg = CONFIG[status] ?? CONFIG.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${SIZE[size]} ${className}`}
      style={{ color: cfg.color, ...cfg.style }}
    >
      {showIcon && cfg.icon}
      {cfg.label}
    </span>
  );
}
