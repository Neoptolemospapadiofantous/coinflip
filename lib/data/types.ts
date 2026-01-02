/**
 * Data Layer Abstraction Types
 *
 * This module defines interfaces for the data layer that can be implemented
 * by different backends (blockchain direct, Supabase, The Graph, etc.)
 *
 * Architecture:
 * - Decentralized mode: Uses BlockchainDataSource (direct RPC / The Graph)
 * - Centralized mode: Uses SupabaseDataSource (our indexed database)
 *
 * Components use these interfaces, not the implementations directly.
 */

import { Game } from '@/types/game';

// ============================================
// CORE DATA TYPES
// ============================================

export interface Tier {
  id: number;
  amount: string; // wei
  amountUsd: number;
  winAmount: string; // wei
  winAmountUsd: number;
  enabled: boolean;
}

export interface PlayerStats {
  address: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  totalWagered: string; // wei
  totalWon: string; // wei
  netProfit: string; // wei
}

export interface GameStats {
  totalGames: number;
  pendingGames: number;
  matchedGames: number;
  resolvedGames: number;
  cancelledGames: number;
  totalVolume: string; // wei
  uniquePlayers: number;
}

// ============================================
// DATA SOURCE INTERFACE
// ============================================

/**
 * Core interface for game data access
 * Implemented by BlockchainDataSource and SupabaseDataSource
 */
export interface GameDataSource {
  readonly name: 'blockchain' | 'supabase';
  readonly isRealtime: boolean;

  // Game queries
  getGames(limit?: number): Promise<Game[]>;
  getPendingGames(): Promise<Game[]>;
  getActiveGames(): Promise<Game[]>; // pending + matched
  getGame(id: string): Promise<Game | null>;
  getGameByTxHash(txHash: string): Promise<Game | null>;

  // Player queries
  getPlayerGames(address: string, limit?: number): Promise<Game[]>;
  getPlayerActiveGames(address: string): Promise<Game[]>;
  getPlayerStats(address: string): Promise<PlayerStats | null>;

  // Tier queries
  getTiers(): Promise<Tier[]>;
  getPendingCountByTier(): Promise<Record<number, number>>;

  // Global stats
  getGameStats(): Promise<GameStats>;

  // Subscriptions (returns unsubscribe function)
  subscribeToGame(gameId: string, callback: (game: Game) => void): () => void;
  subscribeToPlayerGames(address: string, callback: (games: Game[]) => void): () => void;
  subscribeToAllGames(callback: (games: Game[]) => void): () => void;

  // Health check
  isAvailable(): Promise<boolean>;
}

// ============================================
// ENHANCED FEATURES (Supabase Only)
// ============================================

/**
 * Extended interface for Supabase-only features
 * These features require login and are not available in blockchain mode
 */
export interface EnhancedDataSource extends GameDataSource {
  readonly name: 'supabase';

  // User preferences (cloud synced)
  getUserPreferences(address: string): Promise<UserPreferences | null>;
  updateUserPreferences(address: string, prefs: Partial<UserPreferences>): Promise<void>;

  // Pending transactions (cross-device)
  getPendingTransactions(address: string): Promise<PendingTransaction[]>;
  createPendingTransaction(tx: CreatePendingTransaction): Promise<PendingTransaction>;
  updatePendingTransaction(id: string, updates: Partial<PendingTransaction>): Promise<void>;
  deletePendingTransaction(id: string): Promise<void>;

  // Notifications
  getNotifications(address: string, gameId: string): Promise<GameNotifications | null>;
  updateNotifications(address: string, gameId: string, updates: Partial<GameNotifications>): Promise<void>;

  // Activity feed
  getActivityFeed(limit?: number): Promise<ActivityFeedItem[]>;
  subscribeToActivityFeed(callback: (items: ActivityFeedItem[]) => void): () => void;

  // Match time estimates
  getMatchTimeEstimates(): Promise<Record<number, MatchTimeEstimate>>;
}

// ============================================
// ENHANCED FEATURE TYPES
// ============================================

export interface UserPreferences {
  userAddress: string;
  skipAnimation: boolean;
  soundEnabled: boolean;
  activeGamesCollapsed: boolean;
  activityFeedCollapsed: boolean;
  defaultTier: number | null;
  defaultChoice: boolean | null;
  lastGameTier: number | null;
  lastGameChoice: boolean | null;
  lastGameWasWin: boolean | null;
}

export interface PendingTransaction {
  id: string;
  userAddress: string;
  txType: 'create' | 'join' | 'cancel';
  txHash: string | null;
  gameId: string | null;
  tier: number | null;
  choice: boolean | null;
  amountEth: string | null;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed' | 'expired';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePendingTransaction {
  userAddress: string;
  txType: 'create' | 'join' | 'cancel';
  txHash?: string;
  gameId?: string;
  tier?: number;
  choice?: boolean;
  amountEth?: string;
}

export interface GameNotifications {
  userAddress: string;
  gameId: string;
  matchedModalShown: boolean;
  resolvedModalShown: boolean;
  expiredModalShown: boolean;
  matchedSoundPlayed: boolean;
  resolvedSoundPlayed: boolean;
}

export interface ActivityFeedItem {
  id: string;
  eventType: 'game_created' | 'game_matched' | 'game_resolved' | 'big_win';
  gameId: string;
  playerAddress: string;
  opponentAddress: string | null;
  tier: number;
  amount: string;
  payout: string | null;
  isWinner: boolean | null;
  coinResult: boolean | null;
  createdAt: string;
}

export interface MatchTimeEstimate {
  tierId: number;
  avgMatchTimeSeconds: number | null;
  recentAvgSeconds: number | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  sampleSize: number;
}

// ============================================
// DATA MODE CONTEXT
// ============================================

export type DataMode = 'blockchain' | 'supabase';

export interface DataContextValue {
  mode: DataMode;
  isLoggedIn: boolean;
  isOnline: boolean;
  source: GameDataSource;
  enhancedSource: EnhancedDataSource | null;

  // Feature availability
  features: {
    realtime: boolean;
    cloudPreferences: boolean;
    crossDeviceSync: boolean;
    activityFeed: boolean;
    matchTimeEstimates: boolean;
    notifications: boolean;
  };
}
