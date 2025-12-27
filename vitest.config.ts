import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment
    environment: 'happy-dom',

    // Global setup
    globals: true,
    setupFiles: ['./tests/setup.ts'],

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        'contracts/**',
        'scripts/**',
        'docs/**',
        'artifacts/**',
        'cache/**',
        'typechain-types/**',
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      },
    },

    // Include patterns (exclude contract tests - they use Hardhat)
    include: ['tests/**/*.test.{ts,tsx}'],

    // Exclude patterns
    exclude: ['node_modules', 'contracts', 'scripts', 'tests/contracts/**'],

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Reporter
    reporters: ['verbose'],

    // Type checking
    typecheck: {
      enabled: false, // We use tsc separately
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
