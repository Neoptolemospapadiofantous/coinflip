'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Flex, Text, Box, Avatar, Separator } from '@radix-ui/themes';
import {
  Dices,
  History,
  Trophy,
  Wallet,
  Settings,
  LogOut,
  Home,
  Users,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from 'wagmi';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <Home className="w-5 h-5" /> },
  { href: '/play', label: 'Play', icon: <Dices className="w-5 h-5" /> },
  { href: '/queue', label: 'Game Queue', icon: <Users className="w-5 h-5" /> },
  { href: '/history', label: 'History', icon: <History className="w-5 h-5" /> },
  { href: '/leaderboard', label: 'Leaderboard', icon: <Trophy className="w-5 h-5" /> },
  { href: '/stats', label: 'Statistics', icon: <BarChart3 className="w-5 h-5" /> },
];

const secondaryNavItems: NavItem[] = [
  { href: '/notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" /> },
  { href: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { address } = useAccount();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <Flex
      direction="column"
      className={`h-screen bg-slate-900/95 border-r border-slate-700/50 transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Logo / Brand */}
      <Flex
        align="center"
        justify={collapsed ? 'center' : 'between'}
        className="h-16 px-4 border-b border-slate-700/50"
      >
        {!collapsed && (
          <Link href="/dashboard">
            <Flex align="center" gap="2" className="cursor-pointer">
              <Dices className="w-8 h-8 text-cyan-400" />
              <Text size="5" weight="bold" className="text-gradient-cyan">
                CoinFlip
              </Text>
            </Flex>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard">
            <Dices className="w-8 h-8 text-cyan-400 cursor-pointer" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </Flex>

      {/* User Info */}
      <Box className="p-4 border-b border-slate-700/50">
        <Flex align="center" gap="3">
          <Avatar
            size="3"
            fallback={user?.email?.[0]?.toUpperCase() || 'U'}
            radius="full"
            className="bg-gradient-to-br from-cyan-500 to-purple-500"
          />
          {!collapsed && (
            <Flex direction="column" className="flex-1 min-w-0">
              <Text size="2" weight="medium" className="truncate">
                {user?.email?.split('@')[0] || 'User'}
              </Text>
              {address && (
                <Text size="1" color="gray" className="truncate">
                  {truncateAddress(address)}
                </Text>
              )}
            </Flex>
          )}
        </Flex>
      </Box>

      {/* Main Navigation */}
      <Flex direction="column" gap="1" className="flex-1 p-3 overflow-y-auto">
        <Text size="1" color="gray" weight="medium" className={`px-3 py-2 ${collapsed ? 'hidden' : ''}`}>
          MAIN MENU
        </Text>
        {mainNavItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            collapsed={collapsed}
          />
        ))}

        <Separator size="4" className="my-3" />

        <Text size="1" color="gray" weight="medium" className={`px-3 py-2 ${collapsed ? 'hidden' : ''}`}>
          ACCOUNT
        </Text>
        {secondaryNavItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            collapsed={collapsed}
          />
        ))}
      </Flex>

      {/* Wallet Status */}
      {address && (
        <Box className="p-3 border-t border-slate-700/50">
          <Flex
            align="center"
            gap="2"
            className={`p-3 rounded-lg bg-green-500/10 border border-green-500/30 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <Wallet className="w-4 h-4 text-green-400 flex-shrink-0" />
            {!collapsed && (
              <Text size="1" color="green" className="truncate">
                Wallet Connected
              </Text>
            )}
          </Flex>
        </Box>
      )}

      {/* Sign Out */}
      <Box className="p-3 border-t border-slate-700/50">
        <button
          onClick={() => signOut()}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <Text size="2">Sign Out</Text>}
        </button>
      </Box>
    </Flex>
  );
}

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  return (
    <Link href={item.href}>
      <Flex
        align="center"
        gap="3"
        className={`px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {!collapsed && (
          <Text size="2" weight={isActive ? 'medium' : 'regular'}>
            {item.label}
          </Text>
        )}
        {!collapsed && item.badge && item.badge > 0 && (
          <Box className="ml-auto px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
            <Text size="1">{item.badge}</Text>
          </Box>
        )}
      </Flex>
    </Link>
  );
}
