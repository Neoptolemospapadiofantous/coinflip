'use client';

import dynamic from 'next/dynamic';

// Dynamically import all wallet-related components with SSR disabled
// to prevent WalletConnect's indexedDB access errors during static generation
const Providers = dynamic(
  () => import('@/components/Providers').then(mod => ({ default: mod.Providers })),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-neutral-900" />,
  }
);

const ActiveGamesPanel = dynamic(
  () => import('@/components/game/ActiveGamesPanel').then(mod => ({ default: mod.ActiveGamesPanel })),
  { ssr: false }
);

const ActivityFeed = dynamic(
  () => import('@/components/game/ActivityFeed').then(mod => ({ default: mod.ActivityFeed })),
  { ssr: false }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      {children}
      <ActiveGamesPanel />
      <ActivityFeed
        limit={8}
        collapsible={true}
        className="fixed bottom-4 left-4 z-40 w-72"
      />
    </Providers>
  );
}
