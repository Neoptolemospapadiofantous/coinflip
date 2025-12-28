'use client';

import { Theme } from '@radix-ui/themes';
import { useTheme } from '@/store/uiStore';
import { useEffect, useState } from 'react';
import { theme as themeConfig } from '@/lib/theme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch and inject CSS custom properties
  useEffect(() => {
    setMounted(true);

    // Inject theme colors as CSS custom properties
    const root = document.documentElement;
    const { colors, gameStates } = themeConfig;

    // Primary colors
    root.style.setProperty('--color-primary', colors.primary.main);
    root.style.setProperty('--color-primary-light', colors.primary.light);
    root.style.setProperty('--color-primary-dark', colors.primary.dark);
    root.style.setProperty('--color-primary-rgb', colors.primary.rgb);

    // Warning colors
    root.style.setProperty('--color-warning', colors.warning.main);
    root.style.setProperty('--color-warning-light', colors.warning.light);
    root.style.setProperty('--color-warning-dark', colors.warning.dark);
    root.style.setProperty('--color-warning-rgb', colors.warning.rgb);

    // Success colors
    root.style.setProperty('--color-success', colors.success.main);
    root.style.setProperty('--color-success-light', colors.success.light);
    root.style.setProperty('--color-success-dark', colors.success.dark);
    root.style.setProperty('--color-success-rgb', colors.success.rgb);

    // Danger colors
    root.style.setProperty('--color-danger', colors.danger.main);
    root.style.setProperty('--color-danger-light', colors.danger.light);
    root.style.setProperty('--color-danger-dark', colors.danger.dark);
    root.style.setProperty('--color-danger-rgb', colors.danger.rgb);

    // Accent colors
    root.style.setProperty('--color-accent', colors.accent.main);
    root.style.setProperty('--color-accent-light', colors.accent.light);
    root.style.setProperty('--color-accent-dark', colors.accent.dark);
    root.style.setProperty('--color-accent-rgb', colors.accent.rgb);

    // Game state colors
    root.style.setProperty('--color-game-pending', gameStates.pending);
    root.style.setProperty('--color-game-matched', gameStates.matched);
    root.style.setProperty('--color-game-resolved', gameStates.resolved);
    root.style.setProperty('--color-game-cancelled', gameStates.cancelled);
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
