/**
 * Data Layer
 *
 * Unified data abstraction for decentralized and centralized modes.
 *
 * Usage:
 * ```tsx
 * // In a component
 * const source = useDataSource();
 * const games = await source.getGames();
 *
 * // Check feature availability
 * const hasRealtime = useFeature('realtime');
 *
 * // Get enhanced features (Supabase-only)
 * const enhanced = useEnhancedDataSource();
 * if (enhanced) {
 *   const prefs = await enhanced.getUserPreferences(address);
 * }
 * ```
 */

// Types
export * from './types';

// Data sources
export { BlockchainDataSource, getBlockchainDataSource } from './blockchain';
export { SupabaseDataSource, getSupabaseDataSource } from './supabase-source';

// Provider and hooks
export {
  DataProvider,
  useDataContext,
  useDataSource,
  useEnhancedDataSource,
  useFeature,
  useFeatures,
  useDataMode,
  useIsLoggedIn,
} from './provider';
