'use client';

import { Layout } from './Layout';
import { DashboardLayout } from './DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { Flex, Text } from '@radix-ui/themes';
import { Loader2 } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  fullWidth?: boolean;
  requireAuth?: boolean;
}

/**
 * Conditional layout wrapper that automatically switches between:
 * - DashboardLayout (sidebar) when user is logged in
 * - Regular Layout (header/footer) when user is a visitor
 *
 * Use this for pages that should work for both logged-in and visitor users.
 */
export function AppLayout({
  children,
  title,
  description,
  fullWidth = false,
  requireAuth = false,
}: AppLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // If auth is required, always use dashboard layout (which handles redirect)
  if (requireAuth) {
    return (
      <DashboardLayout title={title} description={description} fullWidth={fullWidth}>
        {children}
      </DashboardLayout>
    );
  }

  // Show neutral loading screen while checking auth
  if (isLoading) {
    return (
      <Flex align="center" justify="center" className="h-screen bg-slate-950">
        <Flex direction="column" align="center" gap="4">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <Text size="2" color="gray">Loading...</Text>
        </Flex>
      </Flex>
    );
  }

  // Logged-in users get DashboardLayout (sidebar, no header/footer)
  if (isAuthenticated) {
    return (
      <DashboardLayout title={title} description={description} fullWidth={fullWidth}>
        {children}
      </DashboardLayout>
    );
  }

  // Visitors get Layout (header + footer)
  return <Layout>{children}</Layout>;
}
