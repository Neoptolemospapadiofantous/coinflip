'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Bell,
  Trophy,
  Dices,
  Clock,
  CheckCheck,
  Trash2,
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
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const getIconBg = (type: Notification['type']) => {
    switch (type) {
      case 'game_won':
        return 'rgba(34,197,94,0.15)';
      case 'game_lost':
        return 'rgba(239,68,68,0.15)';
      case 'game_matched':
        return 'rgba(168,85,247,0.15)';
      case 'game_created':
        return 'rgba(6,182,212,0.15)';
      default:
        return 'rgba(255,255,255,0.06)';
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

  const glassCard: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
  };

  const ghostButton: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  return (
    <DashboardLayout title="Notifications" description="Stay updated on your game activity.">
      <div className="flex flex-col gap-6">
        {/* Header Actions */}
        <div style={glassCard} className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-cyan-400" />
              <span className="text-sm font-medium text-white">
                {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Filter pill toggle */}
              <div
                className="flex p-1 rounded-lg gap-1"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <button
                  onClick={() => setFilter('all')}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer"
                  style={
                    filter === 'all'
                      ? { background: 'linear-gradient(135deg, #06b6d4, #7c3aed)', border: 'none', color: '#fff' }
                      : { background: 'transparent', border: 'none', color: '#94a3b8' }
                  }
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer flex items-center gap-1.5"
                  style={
                    filter === 'unread'
                      ? { background: 'linear-gradient(135deg, #06b6d4, #7c3aed)', border: 'none', color: '#fff' }
                      : { background: 'transparent', border: 'none', color: '#94a3b8' }
                  }
                >
                  Unread
                  {unreadCount > 0 && (
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(6,182,212,0.25)', color: '#67e8f9' }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all duration-200 cursor-pointer"
                  style={ghostButton}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length > 0 ? (
          <div className="flex flex-col gap-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: notification.read
                    ? '1px solid rgba(255,255,255,0.07)'
                    : '1px solid rgba(6,182,212,0.25)',
                  borderRadius: '16px',
                  borderLeft: notification.read
                    ? '1px solid rgba(255,255,255,0.07)'
                    : '3px solid rgba(6,182,212,0.6)',
                }}
                className="transition-all duration-200"
              >
                <div className="flex items-start justify-between p-4 gap-4">
                  <div className="flex items-start gap-4">
                    {/* Icon container */}
                    <div
                      className="p-2 rounded-lg flex-shrink-0"
                      style={{ background: getIconBg(notification.type) }}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{notification.title}</span>
                        {!notification.read && (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: '#67e8f9' }}
                          />
                        )}
                      </div>
                      <p className="text-sm text-slate-300">{notification.message}</p>
                      <p className="text-xs text-slate-500">{formatTimestamp(notification.timestamp)}</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 transition-all duration-200 cursor-pointer"
                        style={ghostButton}
                        title="Mark as read"
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 transition-all duration-200 cursor-pointer"
                      style={ghostButton}
                      title="Delete notification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={glassCard} className="py-16 flex flex-col items-center gap-4">
            <div
              className="p-4 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Bell className="w-8 h-8 text-slate-500" />
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <h3 className="text-base font-semibold text-slate-400">No notifications</h3>
              <p className="text-sm text-slate-500 max-w-xs">
                {filter === 'unread'
                  ? "You've read all your notifications!"
                  : 'You have no notifications yet. Start playing to get updates!'}
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
