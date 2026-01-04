'use client';

import { Flex, Box, Text, Container, Button, Tooltip } from '@radix-ui/themes';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Volume2, VolumeX, Zap, ZapOff, Music, Music2 } from 'lucide-react';
import { soundManager } from '@/lib/sounds';
import { musicManager } from '@/lib/music';
import { useUIStore } from '@/store/uiStore';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  fullWidth?: boolean;
}

export function DashboardLayout({
  children,
  title,
  description,
  fullWidth = false,
}: DashboardLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [mounted, isLoading, isAuthenticated, router]);

  // Show loading while checking auth
  if (!mounted || isLoading) {
    return (
      <Flex align="center" justify="center" className="h-screen bg-slate-950">
        <Flex direction="column" align="center" gap="4">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <Text size="2" color="gray">Loading...</Text>
        </Flex>
      </Flex>
    );
  }

  // Redirect handled by useEffect, show nothing while redirecting
  if (!isAuthenticated) {
    return (
      <Flex align="center" justify="center" className="h-screen bg-slate-950">
        <Flex direction="column" align="center" gap="4">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <Text size="2" color="gray">Redirecting to login...</Text>
        </Flex>
      </Flex>
    );
  }

  return (
    <Flex className="h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <Flex direction="column" className="flex-1 overflow-hidden">
        {/* Top Header Bar */}
        <DashboardHeader title={title} description={description} />

        {/* Page Content */}
        <Box className="flex-1 overflow-y-auto">
          {fullWidth ? (
            <Box className="p-6">{children}</Box>
          ) : (
            <Container size="4" className="py-6 px-4">
              {children}
            </Container>
          )}
        </Box>
      </Flex>
    </Flex>
  );
}

function DashboardHeader({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  const {
    soundEnabled,
    skipAnimation,
    setSoundEnabled,
    setSkipAnimation,
  } = useUserPreferences();

  // Music from UI store
  const musicEnabled = useUIStore((state) => state.musicEnabled);
  const toggleMusic = useUIStore((state) => state.toggleMusic);

  // Sync sound manager with preferences
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Sync music manager with UI store
  useEffect(() => {
    musicManager.setEnabled(musicEnabled);
  }, [musicEnabled]);

  return (
    <Box className="h-16 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm px-6 flex items-center justify-between">
      <Flex direction="column" gap="0">
        {title && (
          <Text size="4" weight="bold" className="text-white">
            {title}
          </Text>
        )}
        {description && (
          <Text size="2" color="gray">
            {description}
          </Text>
        )}
      </Flex>

      {/* Right side - Quick settings */}
      <Flex align="center" gap="2">
        {/* Music Toggle */}
        <Tooltip content={musicEnabled ? 'Music: ON' : 'Music: OFF'}>
          <Button
            variant="ghost"
            size="2"
            color={musicEnabled ? 'purple' : 'gray'}
            className="cursor-pointer"
            onClick={toggleMusic}
          >
            {musicEnabled ? (
              <Music className="w-5 h-5" />
            ) : (
              <Music2 className="w-5 h-5" />
            )}
          </Button>
        </Tooltip>

        {/* Sound Toggle */}
        <Tooltip content={soundEnabled ? 'Sound: ON' : 'Sound: OFF'}>
          <Button
            variant="ghost"
            size="2"
            color={soundEnabled ? 'cyan' : 'gray'}
            className="cursor-pointer"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </Button>
        </Tooltip>

        {/* Animation Toggle */}
        <Tooltip content={skipAnimation ? 'Animation: SKIP' : 'Animation: ON'}>
          <Button
            variant="ghost"
            size="2"
            color={!skipAnimation ? 'cyan' : 'gray'}
            className="cursor-pointer"
            onClick={() => setSkipAnimation(!skipAnimation)}
          >
            {skipAnimation ? (
              <ZapOff className="w-5 h-5" />
            ) : (
              <Zap className="w-5 h-5" />
            )}
          </Button>
        </Tooltip>
      </Flex>
    </Box>
  );
}
