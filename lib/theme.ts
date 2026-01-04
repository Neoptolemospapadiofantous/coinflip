/**
 * CoinFlip Theme Configuration
 *
 * 5-Color System for consistent design across the application
 */

export const theme = {
  colors: {
    // 1. PRIMARY - Main brand color, primary actions, matched games
    primary: {
      main: '#06b6d4',      // cyan-500
      light: '#22d3ee',     // cyan-400
      dark: '#0891b2',      // cyan-600
      rgb: '6, 182, 212',
    },

    // 2. WARNING - Pending status, coin gold, warnings, queue
    warning: {
      main: '#facc15',      // yellow-400
      light: '#fde047',     // yellow-300
      dark: '#eab308',      // yellow-500
      rgb: '250, 204, 21',
    },

    // 3. SUCCESS - Resolved games, wins, success states
    success: {
      main: '#22c55e',      // green-500
      light: '#4ade80',     // green-400
      dark: '#16a34a',      // green-600
      rgb: '34, 197, 94',
    },

    // 4. DANGER - Cancelled games, errors, losses
    danger: {
      main: '#ef4444',      // red-500
      light: '#f87171',     // red-400
      dark: '#dc2626',      // red-600
      rgb: '239, 68, 68',
    },

    // 5. ACCENT - Secondary highlights, tier accents, premium features
    accent: {
      main: '#a855f7',      // purple-500
      light: '#c084fc',     // purple-400
      dark: '#9333ea',      // purple-600
      rgb: '168, 85, 247',
    },

    // NEUTRAL - Not counted in 5, but essential for UI
    neutral: {
      50: '#f8fafc',        // slate-50
      100: '#f1f5f9',       // slate-100
      200: '#e2e8f0',       // slate-200
      300: '#cbd5e1',       // slate-300
      400: '#94a3b8',       // slate-400
      500: '#64748b',       // slate-500
      600: '#475569',       // slate-600
      700: '#334155',       // slate-700
      800: '#1e293b',       // slate-800
      900: '#0f172a',       // slate-900
      950: '#020617',       // slate-950
    },
  },

  // Semantic color mapping for game states
  gameStates: {
    pending: '#facc15',     // warning.main
    matched: '#06b6d4',     // primary.main
    resolved: '#22c55e',    // success.main
    cancelled: '#ef4444',   // danger.main
  },

  // Chart colors for consistent data visualization
  charts: {
    // Win Distribution pie chart
    winDistribution: {
      wins: '#22c55e',      // success.main - green
      losses: '#ef4444',    // danger.main - red
    },
    // Game by Tier / Performance progress bars
    tierProgress: {
      gradient: {
        from: '#06b6d4',    // primary.main - cyan
        to: '#a855f7',      // accent.main - purple
      },
      background: '#334155', // neutral.700
    },
    // Line/Area charts
    trends: {
      primary: '#06b6d4',   // primary.main - cyan
      secondary: '#a855f7', // accent.main - purple
      positive: '#22c55e',  // success.main - green
      negative: '#ef4444',  // danger.main - red
      neutral: '#94a3b8',   // neutral.400
    },
    // Tooltip styling
    tooltip: {
      background: 'rgba(15, 23, 42, 0.95)',
      border: 'rgba(6, 182, 212, 0.5)',
    },
  },

  // Radix UI color mapping
  radix: {
    primary: 'cyan',
    warning: 'yellow',
    success: 'green',
    danger: 'red',
    accent: 'purple',
    neutral: 'gray',
  },
} as const;

// Export color values for easy access
export const colors = {
  primary: theme.colors.primary.main,
  warning: theme.colors.warning.main,
  success: theme.colors.success.main,
  danger: theme.colors.danger.main,
  accent: theme.colors.accent.main,
} as const;

// Layout tokens for consistent spacing and sizing
export const layout = {
  // Breakpoints (match tailwind.config.ts)
  breakpoints: {
    xs: 475,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  },

  // Container max-widths
  containers: {
    narrow: '720px',
    content: '1200px',
    wide: '1400px',
    reading: '65ch',
  },

  // Spacing scale (in rem)
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },

  // Section vertical padding
  sectionPadding: {
    sm: { mobile: '1.5rem', tablet: '2rem', desktop: '2.5rem' },
    md: { mobile: '2rem', tablet: '3rem', desktop: '4rem' },
    lg: { mobile: '3rem', tablet: '4rem', desktop: '6rem' },
  },

  // Card padding
  cardPadding: {
    sm: { mobile: '0.75rem', desktop: '1rem' },
    md: { mobile: '1rem', desktop: '1.5rem' },
    lg: { mobile: '1.25rem', desktop: '2rem' },
  },

  // Border radius
  radius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },

  // Z-index scale
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
    toast: 1080,
  },
} as const;

// Typography scale
export const typography = {
  // Font sizes with line heights
  display: {
    lg: { size: '3.5rem', lineHeight: '1.1', letterSpacing: '-0.02em' },
    md: { size: '3rem', lineHeight: '1.1', letterSpacing: '-0.02em' },
    sm: { size: '2.25rem', lineHeight: '1.2', letterSpacing: '-0.01em' },
  },
  heading: {
    lg: { size: '1.875rem', lineHeight: '1.25' },
    md: { size: '1.5rem', lineHeight: '1.3' },
    sm: { size: '1.25rem', lineHeight: '1.4' },
  },
  body: {
    lg: { size: '1.125rem', lineHeight: '1.6' },
    md: { size: '1rem', lineHeight: '1.6' },
    sm: { size: '0.875rem', lineHeight: '1.5' },
  },
  caption: { size: '0.75rem', lineHeight: '1.4' },
} as const;

// Media query helpers
export const mediaQueries = {
  xs: `@media (min-width: ${layout.breakpoints.xs}px)`,
  sm: `@media (min-width: ${layout.breakpoints.sm}px)`,
  md: `@media (min-width: ${layout.breakpoints.md}px)`,
  lg: `@media (min-width: ${layout.breakpoints.lg}px)`,
  xl: `@media (min-width: ${layout.breakpoints.xl}px)`,
  '2xl': `@media (min-width: ${layout.breakpoints['2xl']}px)`,
  // Mobile-first helpers
  mobileOnly: `@media (max-width: ${layout.breakpoints.sm - 1}px)`,
  tabletOnly: `@media (min-width: ${layout.breakpoints.sm}px) and (max-width: ${layout.breakpoints.lg - 1}px)`,
  desktopOnly: `@media (min-width: ${layout.breakpoints.lg}px)`,
} as const;
