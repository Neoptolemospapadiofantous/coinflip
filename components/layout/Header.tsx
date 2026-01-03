'use client';

import { Coins, Menu, X } from 'lucide-react';
import { WalletButton } from '@/components/ui/WalletButton';
import { Flex, Heading, Badge, Box, Container, Button } from '@radix-ui/themes';
import Link from 'next/link';
import { SoundToggle } from '@/components/ui/SoundToggle';
import { MusicToggle } from '@/components/ui/MusicToggle';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { SyncStatus } from '@/components/ui/SyncStatus';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

// Navigation items with auth requirements
interface NavItem {
  href: string;
  label: string;
  glowClass: string;
  requiresAuth?: boolean; // If true, only show for registered users
}

const NAV_ITEMS: NavItem[] = [
  { href: '/play', label: 'Play', glowClass: 'hover:glow-primary' },
  { href: '/queue', label: 'Queue', glowClass: 'hover:glow-accent' },
  { href: '/history', label: 'History', glowClass: 'hover:glow-success', requiresAuth: true },
  { href: '/leaderboard', label: 'Leaderboard', glowClass: 'hover:glow-warning', requiresAuth: true },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const isActive = (path: string) => pathname === path;

  // Filter nav items based on auth status
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.requiresAuth || isAuthenticated
  );

  return (
    <Box className="card-solid border-b border-cyan-500/30 sticky top-0 z-50 backdrop-blur-xl">
      <Container size="4">
        <Flex align="center" justify="between" py="3" gap="4">
          {/* Left: Logo + Navigation */}
          <Flex align="center" gap="6">
            {/* Logo */}
            <Link href="/" className="no-underline">
              <Flex align="center" gap="2" className="group cursor-pointer">
                <Box className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/50 group-hover:scale-110 group-hover:border-cyan-500/70 transition-all duration-300">
                  <Coins className="w-5 h-5 text-cyan-300 group-hover:rotate-180 transition-transform duration-500" />
                </Box>
                <Heading size="5" className="text-gradient-primary hidden sm:block">
                  CoinFlip
                </Heading>
                <Badge
                  color="cyan"
                  variant="soft"
                  radius="full"
                  className="neon-border-primary animate-pulse-slow hidden lg:flex text-xs"
                >
                  v1.0
                </Badge>
              </Flex>
            </Link>

            {/* Desktop Navigation */}
            <Flex gap="2" className="hidden md:flex">
              {visibleNavItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive(item.href) ? 'solid' : 'soft'}
                    size="2"
                    className={`
                      hover:scale-105 transition-all duration-200 cursor-pointer
                      ${item.glowClass}
                      ${isActive(item.href) ? 'border border-cyan-500/70' : ''}
                    `}
                  >
                    {item.label}
                  </Button>
                </Link>
              ))}
            </Flex>
          </Flex>

          {/* Right: Status + Controls + Wallet */}
          <Flex align="center" gap="3">
            {/* Status Indicator */}
            <Box className="hidden sm:block">
              <SyncStatus />
            </Box>

            {/* Divider */}
            <Box className="hidden sm:block w-px h-6 bg-slate-600/50" />

            {/* Audio Controls Group */}
            <Flex align="center" gap="2">
              <MusicToggle />
              <SoundToggle />
              {isAuthenticated && <ThemeSwitcher />}
            </Flex>

            {/* Divider */}
            <Box className="hidden md:block w-px h-6 bg-slate-600/50" />

            {/* Wallet */}
            <Box className="hidden md:block">
              <WalletButton />
            </Box>

            {/* Mobile menu button */}
            <Button
              variant="soft"
              size="2"
              className="md:hidden cursor-pointer"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </Flex>
        </Flex>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <Flex
            direction="column"
            gap="2"
            className="md:hidden pb-4 animate-slide-down"
          >
            {visibleNavItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant={isActive(item.href) ? 'solid' : 'soft'}
                  size="3"
                  className={`
                    w-full cursor-pointer transition-all duration-200
                    ${item.glowClass}
                    ${isActive(item.href) ? 'border-2 border-cyan-500/70' : ''}
                  `}
                >
                  {item.label}
                </Button>
              </Link>
            ))}
            <Box className="mt-2 pt-2 border-t border-slate-700/50">
              <WalletButton />
            </Box>
          </Flex>
        )}
      </Container>
    </Box>
  );
}
