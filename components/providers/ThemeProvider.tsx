'use client';

import { Theme } from '@radix-ui/themes';
import { useTheme } from '@/store/uiStore';
import { useEffect, useState } from 'react';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Resolve system theme preference
  const resolvedAppearance = (() => {
    if (theme.appearance === 'system') {
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'dark'; // Default for SSR
    }
    return theme.appearance;
  })();

  // Listen for system theme changes
  useEffect(() => {
    if (theme.appearance !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      // Force re-render when system theme changes
      setMounted((m) => m);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme.appearance]);

  // Use default theme during SSR/hydration to prevent mismatch
  if (!mounted) {
    return (
      <Theme
        appearance="dark"
        accentColor="cyan"
        grayColor="slate"
        radius="medium"
        scaling="100%"
        panelBackground="translucent"
      >
        {children}
      </Theme>
    );
  }

  return (
    <Theme
      appearance={resolvedAppearance}
      accentColor={theme.accentColor}
      grayColor={theme.grayColor}
      radius={theme.radius}
      scaling={theme.scaling}
      panelBackground={theme.panelBackground}
    >
      {children}
    </Theme>
  );
}

// Hook for components that need to respond to theme
export function useResolvedTheme() {
  const theme = useTheme();
  const [resolvedAppearance, setResolvedAppearance] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (theme.appearance === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setResolvedAppearance(mediaQuery.matches ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => {
        setResolvedAppearance(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      setResolvedAppearance(theme.appearance);
    }
  }, [theme.appearance]);

  return {
    ...theme,
    resolvedAppearance,
    isDark: resolvedAppearance === 'dark',
    isLight: resolvedAppearance === 'light',
  };
}
