'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Coins, Menu, X, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Flex, Heading, Badge, Box, Container, Button, Tooltip } from '@radix-ui/themes';
import Link from 'next/link';
import { SoundToggle } from '@/components/ui/SoundToggle';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useConnectionStatus } from '@/hooks/useRealtimeSync';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { isConnected, isConnecting, isDisconnected } = useConnectionStatus();

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { href: '/play', label: 'Play', glowClass: 'hover:glow-primary' },
    { href: '/queue', label: 'Queue', glowClass: 'hover:glow-accent' },
    { href: '/history', label: 'History', glowClass: 'hover:glow-success' },
    { href: '/leaderboard', label: 'Leaderboard', glowClass: 'hover:glow-warning' },
  ];

  return (
    <Box className="card-solid border-b border-cyan-500/30 sticky top-0 z-50 backdrop-blur-xl">
      <Container size="4">
        <Flex align="center" justify="between" py="4">
          {/* Logo */}
          <Link href="/" className="no-underline">
            <Flex align="center" gap="2" className="group cursor-pointer">
              <Box className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/50 group-hover:scale-110 group-hover:border-cyan-500/70 transition-all duration-300">
                <Coins className="w-6 h-6 text-cyan-300 group-hover:rotate-180 transition-transform duration-500" />
              </Box>
              <Flex align="center" gap="2">
                <Heading size="6" className="text-gradient-primary">
                  CoinFlip
                </Heading>
                <Badge
                  color="cyan"
                  variant="soft"
                  radius="full"
                  className="neon-border-primary animate-pulse-slow hidden sm:flex"
                >
                  v1.0
                </Badge>
              </Flex>
            </Flex>
          </Link>

          {/* Desktop Navigation */}
          <Flex gap="2" className="hidden md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive(item.href) ? 'solid' : 'soft'}
                  size="2"
                  className={`
                    hover:scale-105 transition-all duration-200 cursor-pointer
                    ${item.glowClass}
                    ${isActive(item.href) ? 'border-2 border-cyan-500/70' : ''}
                  `}
                >
                  {item.label}
                </Button>
              </Link>
            ))}
          </Flex>

          {/* Right side actions */}
          <Flex align="center" gap="3">
            {/* Connection Status Indicator */}
            <Tooltip content={
              isConnected ? 'Real-time updates active' :
              isConnecting ? 'Connecting to server...' :
              'Disconnected - using fallback polling'
            }>
              <Flex
                align="center"
                gap="1"
                className={`px-2 py-1 rounded-full text-xs ${
                  isConnected ? 'bg-green-500/10 text-green-400' :
                  isConnecting ? 'bg-yellow-500/10 text-yellow-400' :
                  'bg-red-500/10 text-red-400'
                }`}
              >
                {isConnected && <Wifi className="w-3 h-3" />}
                {isConnecting && <Loader2 className="w-3 h-3 animate-spin" />}
                {isDisconnected && <WifiOff className="w-3 h-3" />}
                <span className="hidden sm:inline">
                  {isConnected ? 'Live' : isConnecting ? 'Connecting' : 'Offline'}
                </span>
              </Flex>
            </Tooltip>

            <SoundToggle />
            <div className="hidden md:block">
              <ConnectButton />
            </div>

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
            {navItems.map((item) => (
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
              <ConnectButton />
            </Box>
          </Flex>
        )}
      </Container>
    </Box>
  );
}
