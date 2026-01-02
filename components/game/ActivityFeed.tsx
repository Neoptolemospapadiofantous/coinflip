'use client';

import { memo, useEffect, useRef, useCallback } from 'react';
import { Card, Flex, Text, Badge, ScrollArea, IconButton } from '@radix-ui/themes';
import { useActivityFeed, ActivityFeedItem } from '@/hooks/useRealtimeStats';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { Trophy, Swords, Plus, Sparkles, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { useState } from 'react';

// How long items stay visible (in seconds)
const ACTIVITY_VISIBLE_DURATION = 10;

// Compact time ago format
function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// Check if item is still within visible duration
function isItemVisible(createdAt: string): boolean {
  const seconds = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  return seconds < ACTIVITY_VISIBLE_DURATION;
}

// Get opacity based on age (fade out in last 3 seconds)
function getItemOpacity(createdAt: string): number {
  const seconds = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  const remaining = ACTIVITY_VISIBLE_DURATION - seconds;
  if (remaining > 3) return 1;
  if (remaining <= 0) return 0;
  return remaining / 3; // Fade from 1 to 0 over last 3 seconds
}

// Activity item with animation support
const ActivityItem = memo(function ActivityItem({
  item,
  isNew = false,
  opacity = 1,
}: {
  item: ActivityFeedItem;
  isNew?: boolean;
  opacity?: number;
}) {
  const config = {
    game_created: {
      icon: <Plus className="w-3 h-3" />,
      color: 'blue' as const,
      bgClass: 'bg-blue-500/10',
      getMessage: () => {
        const amount = item.amount ? formatCurrency(BigInt(item.amount)) : '';
        return <><span className="text-white font-medium">{formatAddress(item.player_address)}</span> created <span className="text-cyan-400">{amount}</span></>;
      },
    },
    game_matched: {
      icon: <Swords className="w-3 h-3" />,
      color: 'yellow' as const,
      bgClass: 'bg-yellow-500/10',
      getMessage: () => {
        const amount = item.amount ? formatCurrency(BigInt(item.amount)) : '';
        return <><span className="text-white font-medium">{formatAddress(item.player_address)}</span> joined <span className="text-cyan-400">{amount}</span></>;
      },
    },
    game_resolved: {
      icon: <Trophy className="w-3 h-3" />,
      color: 'green' as const,
      bgClass: 'bg-green-500/10',
      getMessage: () => {
        const payout = item.payout ? formatCurrency(BigInt(item.payout)) : '';
        return <><span className="text-white font-medium">{formatAddress(item.player_address)}</span> won <span className="text-green-400 font-medium">{payout}</span></>;
      },
    },
    big_win: {
      icon: <Sparkles className="w-3 h-3" />,
      color: 'purple' as const,
      bgClass: 'bg-purple-500/10',
      getMessage: () => {
        const payout = item.payout ? formatCurrency(BigInt(item.payout)) : '';
        return <><span className="text-white font-medium">{formatAddress(item.player_address)}</span> won <span className="text-purple-400 font-bold">{payout}</span> 🎉</>;
      },
    },
  }[item.event_type] || {
    icon: <Radio className="w-3 h-3" />,
    color: 'gray' as const,
    bgClass: 'bg-gray-500/10',
    getMessage: () => <span className="text-gray-400">Activity</span>,
  };

  return (
    <Flex
      align="center"
      gap="2"
      py="1.5"
      px="2"
      style={{ opacity }}
      className={`
        rounded-md transition-all duration-500
        ${config.bgClass}
        ${isNew ? 'animate-slide-in-right ring-1 ring-purple-500/50' : ''}
      `}
    >
      <Badge color={config.color} variant="soft" size="1" className="shrink-0">
        {config.icon}
      </Badge>
      <Text size="1" className="flex-1 truncate text-gray-300">
        {config.getMessage()}
      </Text>
      <Text size="1" className="text-gray-600 shrink-0 tabular-nums">
        {timeAgo(item.created_at)}
      </Text>
    </Flex>
  );
});

interface ActivityFeedProps {
  limit?: number;
  collapsible?: boolean;
  className?: string;
}

export function ActivityFeed({
  limit = 8,
  collapsible = true,
  className = '',
}: ActivityFeedProps) {
  const { data: activities, isLoading } = useActivityFeed(limit);
  const { activityFeedCollapsed, setActivityFeedCollapsed } = useUserPreferences();
  const [newItemIds, setNewItemIds] = useState<Set<number>>(new Set());
  const [, setTick] = useState(0); // Force re-render for fade effect
  const prevActivitiesRef = useRef<ActivityFeedItem[]>([]);

  // Use preference for collapsed state
  const isCollapsed = activityFeedCollapsed;
  const toggleCollapsed = useCallback(() => {
    setActivityFeedCollapsed(!isCollapsed);
  }, [isCollapsed, setActivityFeedCollapsed]);

  // Timer to update opacity/visibility every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track new items for animation
  useEffect(() => {
    if (!activities || activities.length === 0) return;

    const prevIds = new Set(prevActivitiesRef.current.map(a => a.id));
    const newIds = activities.filter(a => !prevIds.has(a.id)).map(a => a.id);

    if (newIds.length > 0) {
      setNewItemIds(new Set(newIds));
      // Clear "new" status after animation
      const timeout = setTimeout(() => setNewItemIds(new Set()), 2000);
      prevActivitiesRef.current = activities;
      return () => clearTimeout(timeout);
    }

    prevActivitiesRef.current = activities;
  }, [activities]);

  // Filter to only show visible items (within duration)
  const visibleActivities = activities?.filter(item => isItemVisible(item.created_at)) || [];

  // Don't render if no visible activities and not loading
  if (!isLoading && visibleActivities.length === 0) {
    return null;
  }

  return (
    <Card className={`card-solid border-purple-500/30 backdrop-blur-sm ${className}`}>
      <Flex direction="column" gap="2" p="3">
        {/* Header */}
        <Flex justify="between" align="center">
          <Flex align="center" gap="2">
            {/* Live indicator */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
            <Text size="2" weight="medium" className="text-purple-200">
              Live Activity
            </Text>
          </Flex>
          {collapsible && (
            <IconButton
              size="1"
              variant="ghost"
              color="gray"
              onClick={toggleCollapsed}
              className="opacity-60 hover:opacity-100"
            >
              {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </IconButton>
          )}
        </Flex>

        {/* Activity List */}
        {!isCollapsed && (
          <ScrollArea style={{ maxHeight: '220px' }} scrollbars="vertical">
            <Flex direction="column" gap="1">
              {isLoading ? (
                // Loading skeleton
                Array.from({ length: 3 }).map((_, i) => (
                  <Flex key={i} align="center" gap="2" py="1.5" px="2" className="bg-gray-800/30 rounded-md animate-pulse">
                    <div className="w-5 h-5 bg-gray-700 rounded" />
                    <div className="flex-1 h-3 bg-gray-700 rounded" />
                    <div className="w-6 h-3 bg-gray-700 rounded" />
                  </Flex>
                ))
              ) : visibleActivities.length > 0 ? (
                visibleActivities.map((item) => (
                  <ActivityItem
                    key={item.id}
                    item={item}
                    isNew={newItemIds.has(item.id)}
                    opacity={getItemOpacity(item.created_at)}
                  />
                ))
              ) : (
                <Flex align="center" justify="center" py="4">
                  <Text size="1" color="gray">
                    Waiting for activity...
                  </Text>
                </Flex>
              )}
            </Flex>
          </ScrollArea>
        )}

        {/* Collapsed summary */}
        {isCollapsed && visibleActivities.length > 0 && (
          <Text size="1" color="gray" className="text-center">
            {visibleActivities.length} recent events
          </Text>
        )}
      </Flex>
    </Card>
  );
}

// Mini ticker version for embedding elsewhere
export function ActivityTicker() {
  const { data: activities } = useActivityFeed(1);
  const [visible, setVisible] = useState(true);

  // Auto-cycle visibility for animation effect
  useEffect(() => {
    if (!activities || activities.length === 0) return;
    setVisible(true);
    const timeout = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timeout);
  }, [activities]);

  if (!activities || activities.length === 0 || !visible) return null;

  const latest = activities[0];
  const config = {
    game_created: { emoji: '🎮', text: 'New game' },
    game_matched: { emoji: '⚔️', text: 'Game matched' },
    game_resolved: { emoji: '🏆', text: 'Winner' },
    big_win: { emoji: '🎉', text: 'Big win' },
  }[latest.event_type] || { emoji: '📢', text: 'Activity' };

  return (
    <Flex
      align="center"
      gap="1"
      className="text-xs text-gray-400 animate-fade-in"
    >
      <span>{config.emoji}</span>
      <span>{formatAddress(latest.player_address)}</span>
    </Flex>
  );
}
