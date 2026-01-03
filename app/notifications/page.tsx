'use client';

import { useState } from 'react';
import { Flex, Card, Text, Heading, Box, Button, Badge, Separator } from '@radix-ui/themes';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Bell,
  Trophy,
  Dices,
  Clock,
  CheckCheck,
  Trash2,
  Filter,
  X,
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'game_matched' | 'game_won' | 'game_lost' | 'game_created';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  gameId?: string;
}

// Mock notifications - would come from API
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'game_won',
    title: 'You Won!',
    message: 'Congratulations! You won 0.095 ETH in game #1234',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    read: false,
    gameId: '1234',
  },
  {
    id: '2',
    type: 'game_matched',
    title: 'Game Matched',
    message: 'Your game #1233 has been matched. Waiting for VRF...',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    read: false,
    gameId: '1233',
  },
  {
    id: '3',
    type: 'game_lost',
    title: 'Better Luck Next Time',
    message: 'You lost game #1232. Try again!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: true,
    gameId: '1232',
  },
  {
    id: '4',
    type: 'game_created',
    title: 'Game Created',
    message: 'Your game #1231 is now in the queue waiting for a match.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    read: true,
    gameId: '1231',
  },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const markAsRead = (id: string) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'game_won':
        return <Trophy className="w-5 h-5 text-green-400" />;
      case 'game_lost':
        return <X className="w-5 h-5 text-red-400" />;
      case 'game_matched':
        return <Dices className="w-5 h-5 text-purple-400" />;
      case 'game_created':
        return <Clock className="w-5 h-5 text-cyan-400" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <DashboardLayout title="Notifications" description="Stay updated on your game activity.">
      <Flex direction="column" gap="6">
        {/* Header Actions */}
        <Card className="card-simple">
          <Flex align="center" justify="between" p="4">
            <Flex align="center" gap="3">
              <Bell className="w-5 h-5 text-cyan-400" />
              <Text size="3" weight="medium">
                {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
              </Text>
            </Flex>
            <Flex align="center" gap="3">
              {/* Filter Toggle */}
              <Flex className="p-1 rounded-lg bg-slate-800/50">
                <Button
                  variant={filter === 'all' ? 'solid' : 'ghost'}
                  size="1"
                  onClick={() => setFilter('all')}
                  className="cursor-pointer"
                >
                  All
                </Button>
                <Button
                  variant={filter === 'unread' ? 'solid' : 'ghost'}
                  size="1"
                  onClick={() => setFilter('unread')}
                  className="cursor-pointer"
                >
                  Unread
                  {unreadCount > 0 && (
                    <Badge size="1" color="cyan" className="ml-1">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </Flex>

              {unreadCount > 0 && (
                <Button
                  variant="soft"
                  size="2"
                  onClick={markAllAsRead}
                  className="cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </Button>
              )}

              {notifications.length > 0 && (
                <Button
                  variant="soft"
                  color="red"
                  size="2"
                  onClick={clearAll}
                  className="cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear all
                </Button>
              )}
            </Flex>
          </Flex>
        </Card>

        {/* Notifications List */}
        {filteredNotifications.length > 0 ? (
          <Flex direction="column" gap="3">
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`card-interactive transition-all ${
                  !notification.read ? 'border-l-4 border-l-cyan-500' : ''
                }`}
              >
                <Flex align="start" justify="between" p="4" gap="4">
                  <Flex align="start" gap="4">
                    <Box
                      className={`p-2 rounded-lg ${
                        notification.type === 'game_won'
                          ? 'bg-green-500/20'
                          : notification.type === 'game_lost'
                          ? 'bg-red-500/20'
                          : notification.type === 'game_matched'
                          ? 'bg-purple-500/20'
                          : 'bg-cyan-500/20'
                      }`}
                    >
                      {getNotificationIcon(notification.type)}
                    </Box>
                    <Flex direction="column" gap="1">
                      <Flex align="center" gap="2">
                        <Text size="2" weight="medium">
                          {notification.title}
                        </Text>
                        {!notification.read && (
                          <Box className="w-2 h-2 rounded-full bg-cyan-400" />
                        )}
                      </Flex>
                      <Text size="2" color="gray">
                        {notification.message}
                      </Text>
                      <Text size="1" color="gray">
                        {formatTimestamp(notification.timestamp)}
                      </Text>
                    </Flex>
                  </Flex>

                  <Flex align="center" gap="2">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="1"
                        onClick={() => markAsRead(notification.id)}
                        className="cursor-pointer"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="1"
                      color="red"
                      onClick={() => deleteNotification(notification.id)}
                      className="cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            ))}
          </Flex>
        ) : (
          <Card className="card-simple">
            <Flex direction="column" align="center" gap="4" p="8">
              <Box className="p-4 rounded-full bg-slate-800/50">
                <Bell className="w-8 h-8 text-slate-500" />
              </Box>
              <Flex direction="column" align="center" gap="2">
                <Heading size="4" color="gray">
                  No notifications
                </Heading>
                <Text size="2" color="gray" align="center">
                  {filter === 'unread'
                    ? "You've read all your notifications!"
                    : 'You have no notifications yet. Start playing to get updates!'}
                </Text>
              </Flex>
            </Flex>
          </Card>
        )}
      </Flex>
    </DashboardLayout>
  );
}
