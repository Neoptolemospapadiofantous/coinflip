// This file runs once when the server starts
// Perfect place for global polyfills and environment validation
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function register() {
  if (typeof window === 'undefined') {
    // Validate environment variables at startup (server-side only)
    try {
      const { validateEnv } = await import('@/lib/env');
      validateEnv();
      console.log('✅ Environment variables validated');
    } catch (error) {
      console.error('❌ Environment validation failed:', error);
      // In production, fail fast. In development, warn but continue.
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }

    // Polyfill indexedDB for WalletConnect during SSR
    // These are minimal polyfills to prevent SSR errors
    // @ts-expect-error - Minimal polyfill for SSR compatibility
    global.indexedDB = {
      open: () => ({} as any),
      deleteDatabase: () => ({} as any),
      cmp: () => 0,
    };

    // @ts-expect-error - Minimal polyfill for SSR compatibility
    global.IDBKeyRange = {
      bound: () => ({} as any),
      only: () => ({} as any),
      lowerBound: () => ({} as any),
      upperBound: () => ({} as any),
    };
  }
}
