'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Flex, Text, Box, Avatar } from '@radix-ui/themes';
import {
  Dices, History, Trophy, Wallet, Settings, LogOut,
  Home, Users, BarChart3, Bell, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { LogoIcon } from '@/components/ui/LogoIcon';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from 'wagmi';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',   icon: <Home      className="w-[18px] h-[18px]" /> },
  { href: '/play',        label: 'Play',         icon: <Dices     className="w-[18px] h-[18px]" /> },
  { href: '/queue',       label: 'Queue',        icon: <Users     className="w-[18px] h-[18px]" /> },
  { href: '/history',     label: 'History',      icon: <History   className="w-[18px] h-[18px]" /> },
  { href: '/leaderboard', label: 'Leaderboard',  icon: <Trophy    className="w-[18px] h-[18px]" /> },
  { href: '/stats',       label: 'Statistics',   icon: <BarChart3 className="w-[18px] h-[18px]" /> },
];

const secondaryNavItems: NavItem[] = [
  { href: '/notifications', label: 'Notifications', icon: <Bell     className="w-[18px] h-[18px]" /> },
  { href: '/settings',      label: 'Settings',      icon: <Settings className="w-[18px] h-[18px]" /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { address } = useAccount();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  return (
    <div
      className={`h-screen flex flex-col transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-[72px]' : 'w-60'}`}
      style={{
        background: 'rgba(5, 8, 22, 0.9)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-[60px] px-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {collapsed ? (
          <Link href="/dashboard" className="mx-auto">
            <LogoIcon size={28} className="transition-transform duration-300 hover:scale-110" />
          </Link>
        ) : (
          <Link href="/dashboard" className="no-underline flex items-center gap-2.5 flex-1">
            <LogoIcon size={26} />
            <span className="flex items-baseline gap-0 text-base tracking-tight">
              <span style={{ color: '#94a3b8', fontWeight: 400 }}>Coin</span>
              <span style={{ background: 'linear-gradient(to right,#67e8f9,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontWeight: 800 }}>Flip</span>
            </span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="px-3 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <Avatar
              size="2"
              fallback={(user?.email?.[0] ?? 'U').toUpperCase()}
              radius="full"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#a855f7)' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">
                {user?.email?.split('@')[0] ?? 'User'}
              </p>
              {address && (
                <p className="text-xs text-slate-500 truncate font-mono">
                  {truncateAddress(address)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {!collapsed && (
          <p className="px-3 pb-1.5 text-[10px] font-semibold text-slate-600 tracking-widest uppercase">
            Menu
          </p>
        )}
        {mainNavItems.map(item => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
        ))}

        <div className="my-3" style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

        {!collapsed && (
          <p className="px-3 pb-1.5 text-[10px] font-semibold text-slate-600 tracking-widest uppercase">
            Account
          </p>
        )}
        {secondaryNavItems.map(item => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
        ))}
      </div>

      {/* Wallet indicator */}
      {address && (
        <div className="px-3 py-2 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl ${collapsed ? 'justify-center' : ''}`}
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <Wallet className="w-4 h-4 text-green-400 flex-shrink-0" />
            {!collapsed && (
              <span className="text-xs text-green-400 font-medium truncate">Connected</span>
            )}
          </div>
        </div>
      )}

      {/* Sign Out */}
      <div className="px-3 pb-4 flex-shrink-0">
        <button
          onClick={() => signOut()}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200 cursor-pointer ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </div>
  );
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link href={item.href} className="no-underline block">
      <div
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer
          ${collapsed ? 'justify-center' : ''}
          ${active
            ? 'text-cyan-300'
            : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.05]'
          }
        `}
        style={active ? {
          background: 'rgba(6,182,212,0.1)',
          boxShadow: 'inset 0 0 0 1px rgba(6,182,212,0.2)',
        } : undefined}
        title={collapsed ? item.label : undefined}
      >
        <span className={`flex-shrink-0 ${active ? 'text-cyan-400' : ''}`}>{item.icon}</span>
        {!collapsed && (
          <span className={`text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
        )}
        {!collapsed && active && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 6px rgba(6,182,212,0.8)' }} />
        )}
      </div>
    </Link>
  );
}
