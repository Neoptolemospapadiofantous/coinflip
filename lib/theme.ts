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
