// This file runs once when the server starts
// Perfect place for global polyfills

export async function register() {
  if (typeof window === 'undefined') {
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
