'use client';

import { Flex, Box, Text, Container } from '@radix-ui/themes';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

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

      {/* Right side - can add notifications, search, etc. */}
      <Flex align="center" gap="4">
        {/* Placeholder for future additions */}
      </Flex>
    </Box>
  );
}
