'use client';

import { Badge, Flex, Text } from '@radix-ui/themes';
import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';

type GameStatus = 'pending' | 'matched' | 'resolved' | 'cancelled';

interface StatusBadgeProps {
  status: GameStatus;
  size?: '1' | '2' | '3';
  showIcon?: boolean;
}

const statusConfig: Record<
  GameStatus,
  {
    label: string;
    icon: React.ReactNode;
    className: string;
    color: 'yellow' | 'cyan' | 'green' | 'red';
  }
> = {
  pending: {
    label: 'Waiting',
    icon: <Clock className="w-3 h-3" />,
    className: 'badge-pending pulse-pending',
    color: 'yellow',
  },
  matched: {
    label: 'In Progress',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    className: 'badge-matched',
    color: 'cyan',
  },
  resolved: {
    label: 'Resolved',
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: 'badge-resolved',
    color: 'green',
  },
  cancelled: {
    label: 'Cancelled',
    icon: <XCircle className="w-3 h-3" />,
    className: 'badge-cancelled',
    color: 'red',
  },
};

export function StatusBadge({ status, size = '2', showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      size={size}
      color={config.color}
      variant="soft"
      radius="full"
      className={config.className}
    >
      {showIcon && (
        <Flex align="center" gap="1">
          {config.icon}
          <Text size={size}>{config.label}</Text>
        </Flex>
      )}
      {!showIcon && config.label}
    </Badge>
  );
}
