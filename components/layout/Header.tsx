'use client';

import { Menu, X } from 'lucide-react';
import { WalletButton } from '@/components/ui/WalletButton';
import { Flex, Box, Container } from '@radix-ui/themes';
import { LogoIcon } from '@/components/ui/LogoIcon';
import Link from 'next/link';
import { SoundToggle } from '@/components/ui/SoundToggle';
import { MusicToggle } from '@/components/ui/MusicToggle';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { SyncStatus } from '@/components/ui/SyncStatus';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  href: string;
  label: string;
  requiresAuth?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/play',        label: 'Play' },
  { href: '/queue',       label: 'Queue' },
  { href: '/history',     label: 'History',     requiresAuth: true },
  { href: '/leaderboard', label: 'Leaderboard', requiresAuth: true },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');
  const visibleNavItems = NAV_ITEMS.filter(item => !item.requiresAuth || isAuthenticated);

  return (
    <Box
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(2, 6, 23, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 40px rgba(0,0,0,0.4)',
      }}
    >
      <Container size="4">
        <Flex align="center" justify="between" style={{ height: '60px' }} gap="4">

          {/* ── Logo ── */}
          <Link href="/" className="no-underline flex-shrink-0">
            <Flex align="center" gap="2" className="group cursor-pointer">
              <LogoIcon
                size={30}
                className="transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
              />
              <span className="hidden sm:flex items-baseline gap-0 text-lg tracking-tight">
                <span style={{ color: '#94a3b8', fontWeight: 400 }}>Coin</span>
                <span style={{ background: 'linear-gradient(to right, #67e8f9, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>Flip</span>
              </span>
            </Flex>
          </Link>

          {/* ── Desktop Nav ── */}
          <Flex gap="1" align="center" className="hidden md:flex flex-1 px-4">
            {visibleNavItems.map(item => (
              <Link key={item.href} href={item.href} className="no-underline">
                <button
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                    ${isActive(item.href)
                      ? 'text-cyan-300'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]'
                    }
                  `}
                  style={isActive(item.href) ? {
                    background: 'rgba(6,182,212,0.12)',
                    boxShadow: 'inset 0 0 0 1px rgba(6,182,212,0.3)',
                  } : undefined}
                >
                  {item.label}
                </button>
              </Link>
            ))}
          </Flex>

          {/* ── Right Controls ── */}
          <Flex align="center" gap="2" className="flex-shrink-0">
            <Box className="hidden sm:block">
              <SyncStatus />
            </Box>

            <div className="hidden sm:block w-px h-5 bg-white/10" />

            <Flex align="center" gap="1">
              <MusicToggle />
              <SoundToggle />
              {isAuthenticated && <ThemeSwitcher />}
            </Flex>

            <div className="hidden md:block w-px h-5 bg-white/10" />

            <Box className="hidden md:block">
              <WalletButton />
            </Box>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all duration-200 cursor-pointer"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </Flex>
        </Flex>

        {/* ── Mobile Menu ── */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 animate-slide-down border-t border-white/[0.06] mt-0 pt-3">
            <div className="flex flex-col gap-1">
              {visibleNavItems.map(item => (
                <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className="no-underline">
                  <button
                    className={`
                      w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer
                      ${isActive(item.href)
                        ? 'text-cyan-300 bg-cyan-500/10'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                      }
                    `}
                    style={isActive(item.href) ? { boxShadow: 'inset 0 0 0 1px rgba(6,182,212,0.25)' } : undefined}
                  >
                    {item.label}
                  </button>
                </Link>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/[0.06]">
              <WalletButton />
            </div>
          </div>
        )}
      </Container>
    </Box>
  );
}
