'use client';

import { Flex, Box, Text } from '@radix-ui/themes';
import { Coins, ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Toaster } from '@/components/ui/Toaster';

interface AuthLayoutProps {
  children: React.ReactNode;
}

// Map paths to readable names
const pathNames: Record<string, string> = {
  '/login': 'Sign In',
  '/register': 'Create Account',
  '/forgot-password': 'Reset Password',
};

/**
 * Minimal layout for auth pages (login, register, forgot-password)
 * No header or footer - just centered content with branding
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  const pathname = usePathname();
  const currentPageName = pathNames[pathname] || 'Auth';

  return (
    <Flex
      direction="column"
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-guard"
    >
      {/* Background effects */}
      <Box className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <Box
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl animate-float bg-orb-cyan"
        />
        <Box
          className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl animate-float bg-orb-purple"
          style={{ animationDelay: '-3s' }}
        />
        {/* Grid pattern */}
        <Box
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </Box>

      {/* Top bar with logo and breadcrumb */}
      <Flex align="center" justify="between" className="relative z-10 px-6 py-4">
        {/* Logo */}
        <Link href="/" className="no-underline">
          <Flex align="center" gap="2" className="group cursor-pointer">
            <Box className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/50 group-hover:scale-110 group-hover:border-cyan-500/70 transition-all duration-300">
              <Coins className="w-5 h-5 text-cyan-300 group-hover:rotate-180 transition-transform duration-500" />
            </Box>
            <Text size="4" weight="bold" className="text-gradient-primary hidden sm:block">
              CoinFlip
            </Text>
          </Flex>
        </Link>

        {/* Breadcrumb */}
        <Flex align="center" gap="2" className="text-sm">
          <Link href="/" className="no-underline">
            <Flex align="center" gap="1" className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer">
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </Flex>
          </Link>
          <ChevronRight className="w-4 h-4 text-slate-600" />
          <Text className="text-slate-200">{currentPageName}</Text>
        </Flex>
      </Flex>

      {/* Main content - centered */}
      <Flex
        direction="column"
        align="center"
        justify="center"
        className="flex-1 relative z-10 px-4 py-16"
      >
        {children}
      </Flex>

      {/* Footer text */}
      <Box className="relative z-10 pb-6 text-center">
        <Text size="1" color="gray">
          &copy; {new Date().getFullYear()} CoinFlip. All rights reserved.
        </Text>
      </Box>

      {/* Toast notifications */}
      <Toaster />
    </Flex>
  );
}
