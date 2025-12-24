import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 5-Color System for CoinFlip
        // These map to Tailwind's default color scales (cyan-*, yellow-*, green-*, red-*, purple-*)

        // Game state colors (semantic mapping)
        game: {
          pending: '#facc15',     // yellow-400 (Warning)
          matched: '#06b6d4',     // cyan-500 (Primary)
          resolved: '#22c55e',    // green-500 (Success)
          cancelled: '#ef4444',   // red-500 (Danger)
        },
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'flip': 'flip 0.6s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-in',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        // Glow animation using cyan (primary)
        glow: {
          '0%': {
            boxShadow: '0 0 5px rgba(6, 182, 212, 0.5), 0 0 20px rgba(6, 182, 212, 0.3)',
          },
          '100%': {
            boxShadow: '0 0 10px rgba(6, 182, 212, 0.8), 0 0 30px rgba(6, 182, 212, 0.5)',
          },
        },
        flip: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'shimmer-gradient':
          'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
export default config
