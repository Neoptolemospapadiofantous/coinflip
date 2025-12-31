import { create } from 'zustand';
import { Game } from '@/types/game';
import { devLog } from '@/lib/utils';

// Maximum number of concurrent games a player can have
export const MAX_CONCURRENT_GAMES = 5;

interface ActiveGameEntry {
  game: Game;
  addedAt: number;
}

interface ModalQueueEntry {
  game: Game;
  type: 'matched' | 'resolved' | 'expired';
}

// Pending transaction tracking (for cross-page state)
export type PendingTxType = 'create' | 'cancel' | 'join';

export interface PendingTransaction {
  type: PendingTxType;
  gameId?: string; // For cancel/join - the game being acted on
  txHash?: `0x${string}`; // Set once transaction is submitted
  tier?: number; // For create - the tier being created
  choice?: boolean; // For create - the coin choice
  startedAt: number;
}

// Quick re-bet settings from last game
export interface LastGameSettings {
  tier: number;
  choice: boolean; // false = heads, true = tails
  wasWin: boolean;
  amount: string; // For display purposes
}

interface GameState {
  // Current game creation flow
  selectedTier: number | null;
  coinChoice: boolean | null; // false = heads, true = tails

  // Quick re-bet from last game
  lastGameSettings: LastGameSettings | null;

  // Multiple active games tracking
  activeGames: Map<string, ActiveGameEntry>;

  // Games being cancelled (for optimistic UI)
  cancellingGames: Set<string>;

  // Games being joined (for optimistic UI)
  joiningGames: Set<string>;

  // Pending transactions awaiting wallet approval (persists across pages)
  pendingTransactions: Map<string, PendingTransaction>;

  // Current focused game (for modal display)
  currentModalGame: Game | null;
  currentModalType: 'matched' | 'resolved' | 'expired' | null;

  // Modal queue for results (FIFO)
  modalQueue: ModalQueueEntry[];

  // UI state
  showGameModal: boolean;

  // Actions - Game creation
  setSelectedTier: (tier: number | null) => void;
  setCoinChoice: (choice: boolean | null) => void;
  resetGameCreation: () => void;

  // Actions - Quick re-bet
  saveLastGameSettings: (tier: number, choice: boolean, wasWin: boolean, amount: string) => void;
  setupQuickRebet: () => void; // Sets tier/choice from last game
  clearLastGameSettings: () => void;

  // Actions - Active games management
  addActiveGame: (game: Game) => void;
  updateActiveGame: (game: Game) => void;
  removeActiveGame: (gameId: string) => void;
  clearAllActiveGames: () => void;
  getActiveGame: (gameId: string) => Game | undefined;
  getActiveGamesCount: () => number;
  canCreateNewGame: () => boolean;

  // Actions - Optimistic cancel
  startCancellingGame: (gameId: string) => void;
  finishCancellingGame: (gameId: string, success: boolean) => void;
  isGameCancelling: (gameId: string) => boolean;

  // Actions - Optimistic join
  startJoiningGame: (gameId: string) => void;
  finishJoiningGame: (gameId: string, success: boolean) => void;
  isGameJoining: (gameId: string) => boolean;

  // Actions - Pending transaction tracking
  addPendingTransaction: (key: string, tx: PendingTransaction) => void;
  updatePendingTransaction: (key: string, updates: Partial<PendingTransaction>) => void;
  removePendingTransaction: (key: string) => void;
  getPendingTransaction: (key: string) => PendingTransaction | undefined;
  hasPendingTransaction: (type: PendingTxType, gameId?: string) => boolean;
  getPendingCreate: () => PendingTransaction | undefined;
  getPendingCancel: (gameId: string) => PendingTransaction | undefined;

  // Actions - Modal queue management
  queueModal: (game: Game, type: 'matched' | 'resolved' | 'expired') => void;
  showNextModal: () => void;
  closeCurrentModal: () => void;

  // Legacy compatibility
  activeGameId: string | null;
  activeGame: Game | null;
  showMatchModal: boolean;
  setActiveGameId: (id: string | null) => void;
  setActiveGame: (game: Game | null) => void;
  setShowMatchModal: (show: boolean) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  selectedTier: null,
  coinChoice: null,
  lastGameSettings: null,
  activeGames: new Map(),
  cancellingGames: new Set(),
  joiningGames: new Set(),
  pendingTransactions: new Map(),
  currentModalGame: null,
  currentModalType: null,
  modalQueue: [],
  showGameModal: false,

  // Legacy state (for compatibility)
  activeGameId: null,
  activeGame: null,
  showMatchModal: false,

  // Game creation actions
  setSelectedTier: (tier) => set({ selectedTier: tier }),
  setCoinChoice: (choice) => set({ coinChoice: choice }),

  resetGameCreation: () =>
    set({
      selectedTier: null,
      coinChoice: null,
    }),

  // Quick re-bet actions
  saveLastGameSettings: (tier, choice, wasWin, amount) =>
    set({
      lastGameSettings: { tier, choice, wasWin, amount },
    }),

  setupQuickRebet: () => {
    const { lastGameSettings } = get();
    if (lastGameSettings) {
      set({
        selectedTier: lastGameSettings.tier,
        coinChoice: lastGameSettings.choice,
      });
    }
  },

  clearLastGameSettings: () => set({ lastGameSettings: null }),

  // Active games management
  addActiveGame: (game) =>
    set((state) => {
      const newMap = new Map(state.activeGames);
      newMap.set(game.id, { game, addedAt: Date.now() });
      return { activeGames: newMap };
    }),

  updateActiveGame: (game) =>
    set((state) => {
      const newMap = new Map(state.activeGames);
      const existing = newMap.get(game.id);
      if (existing) {
        newMap.set(game.id, { ...existing, game });
      } else {
        newMap.set(game.id, { game, addedAt: Date.now() });
      }
      return { activeGames: newMap };
    }),

  removeActiveGame: (gameId) =>
    set((state) => {
      const newMap = new Map(state.activeGames);
      newMap.delete(gameId);
      return { activeGames: newMap };
    }),

  clearAllActiveGames: () =>
    set({
      activeGames: new Map(),
      cancellingGames: new Set(),
      joiningGames: new Set(),
      pendingTransactions: new Map(), // Clear pending transactions on wallet change
      modalQueue: [],
      currentModalGame: null,
      currentModalType: null,
      showGameModal: false,
      // Legacy
      activeGame: null,
      activeGameId: null,
      showMatchModal: false,
    }),

  getActiveGame: (gameId) => {
    const entry = get().activeGames.get(gameId);
    return entry?.game;
  },

  getActiveGamesCount: () => get().activeGames.size,

  canCreateNewGame: () => get().activeGames.size < MAX_CONCURRENT_GAMES,

  // Optimistic cancel actions
  startCancellingGame: (gameId) =>
    set((state) => {
      const newSet = new Set(state.cancellingGames);
      newSet.add(gameId);
      return { cancellingGames: newSet };
    }),

  finishCancellingGame: (gameId, success) =>
    set((state) => {
      const newSet = new Set(state.cancellingGames);
      newSet.delete(gameId);

      // If success, remove from active games
      if (success) {
        const newMap = new Map(state.activeGames);
        newMap.delete(gameId);
        return { cancellingGames: newSet, activeGames: newMap };
      }

      return { cancellingGames: newSet };
    }),

  isGameCancelling: (gameId) => get().cancellingGames.has(gameId),

  // Optimistic join actions
  startJoiningGame: (gameId) =>
    set((state) => {
      const newSet = new Set(state.joiningGames);
      newSet.add(gameId);
      return { joiningGames: newSet };
    }),

  finishJoiningGame: (gameId, _success) =>
    set((state) => {
      const newSet = new Set(state.joiningGames);
      newSet.delete(gameId);
      return { joiningGames: newSet };
    }),

  isGameJoining: (gameId) => get().joiningGames.has(gameId),

  // Pending transaction tracking
  addPendingTransaction: (key, tx) =>
    set((state) => {
      const newMap = new Map(state.pendingTransactions);
      newMap.set(key, tx);
      devLog.log(`📝 [GameStore] Added pending tx: ${key}`, tx);
      return { pendingTransactions: newMap };
    }),

  updatePendingTransaction: (key, updates) =>
    set((state) => {
      const newMap = new Map(state.pendingTransactions);
      const existing = newMap.get(key);
      if (existing) {
        newMap.set(key, { ...existing, ...updates });
        devLog.log(`📝 [GameStore] Updated pending tx: ${key}`, updates);
      }
      return { pendingTransactions: newMap };
    }),

  removePendingTransaction: (key) =>
    set((state) => {
      const newMap = new Map(state.pendingTransactions);
      newMap.delete(key);
      devLog.log(`📝 [GameStore] Removed pending tx: ${key}`);
      return { pendingTransactions: newMap };
    }),

  getPendingTransaction: (key) => get().pendingTransactions.get(key),

  hasPendingTransaction: (type, gameId) => {
    const txs = get().pendingTransactions;
    for (const tx of txs.values()) {
      if (tx.type === type) {
        if (gameId && tx.gameId !== gameId) continue;
        return true;
      }
    }
    return false;
  },

  getPendingCreate: () => {
    const txs = get().pendingTransactions;
    for (const tx of txs.values()) {
      if (tx.type === 'create') return tx;
    }
    return undefined;
  },

  getPendingCancel: (gameId) => {
    const txs = get().pendingTransactions;
    for (const [key, tx] of txs.entries()) {
      if (tx.type === 'cancel' && tx.gameId === gameId) return tx;
    }
    return undefined;
  },

  // Modal queue management
  queueModal: (game, type) =>
    set((state) => {
      devLog.log(`🎯 [GameStore] queueModal called: game=${game.id} type=${type} status=${game.status}`);

      // Don't queue if exact same entry already in queue
      const alreadyQueued = state.modalQueue.some(
        (entry) => entry.game.id === game.id && entry.type === type
      );
      if (alreadyQueued) {
        devLog.log(`🎯 [GameStore] Modal already queued, skipping`);
        return state;
      }

      // Don't queue if this exact game+type is already the current modal
      if (
        state.currentModalGame?.id === game.id &&
        state.currentModalType === type &&
        state.showGameModal
      ) {
        return state;
      }

      // If currently showing this game as 'matched' and new type is 'resolved',
      // update the current modal instead of queueing
      if (
        state.currentModalGame?.id === game.id &&
        state.showGameModal &&
        type === 'resolved'
      ) {
        return {
          currentModalGame: game,
          currentModalType: type,
          // Legacy compatibility
          activeGame: game,
          showMatchModal: false,
        };
      }

      // Remove any existing 'matched' entry for this game if we're queueing 'resolved'
      let newQueue = [...state.modalQueue];
      if (type === 'resolved') {
        newQueue = newQueue.filter(
          (entry) => !(entry.game.id === game.id && entry.type === 'matched')
        );
      }

      newQueue.push({ game, type });

      // If no modal currently showing, show this one immediately
      if (!state.showGameModal && !state.currentModalGame) {
        const nextEntry = newQueue.shift();
        if (nextEntry) {
          devLog.log(`🎯 [GameStore] Showing modal immediately: game=${nextEntry.game.id} type=${nextEntry.type}`);
          return {
            modalQueue: newQueue,
            currentModalGame: nextEntry.game,
            currentModalType: nextEntry.type,
            showGameModal: true,
            // Legacy compatibility
            activeGame: nextEntry.game,
            activeGameId: nextEntry.game.id,
            showMatchModal: nextEntry.type === 'matched',
          };
        }
      }

      devLog.log(`🎯 [GameStore] Modal queued (waiting): game=${game.id} type=${type} queueLength=${newQueue.length}`);
      return { modalQueue: newQueue };
    }),

  showNextModal: () =>
    set((state) => {
      if (state.modalQueue.length === 0) {
        return {
          currentModalGame: null,
          currentModalType: null,
          showGameModal: false,
          activeGame: null,
          activeGameId: null,
          showMatchModal: false,
        };
      }

      const newQueue = [...state.modalQueue];
      const nextEntry = newQueue.shift();

      if (nextEntry) {
        return {
          modalQueue: newQueue,
          currentModalGame: nextEntry.game,
          currentModalType: nextEntry.type,
          showGameModal: true,
          activeGame: nextEntry.game,
          activeGameId: nextEntry.game.id,
          showMatchModal: nextEntry.type === 'matched',
        };
      }

      return state;
    }),

  closeCurrentModal: () => {
    const state = get();

    // Remove the game from active games if it's resolved or cancelled
    if (state.currentModalGame) {
      const game = state.currentModalGame;
      if (game.status === 'resolved' || game.status === 'cancelled') {
        get().removeActiveGame(game.id);
      }
    }

    // Show next modal if any
    get().showNextModal();
  },

  // Legacy compatibility actions
  setActiveGameId: (id) => set({ activeGameId: id }),
  setActiveGame: (game) => set({ activeGame: game }),
  setShowMatchModal: (show) => set({ showMatchModal: show }),

  resetGame: () =>
    set({
      selectedTier: null,
      coinChoice: null,
      activeGameId: null,
      activeGame: null,
      showMatchModal: false,
      currentModalGame: null,
      currentModalType: null,
      showGameModal: false,
    }),
}));

// Helper hook to get active games as array (sorted by creation time)
export function useActiveGamesList() {
  const activeGames = useGameStore((state) => state.activeGames);
  return Array.from(activeGames.values())
    .sort((a, b) => b.addedAt - a.addedAt)
    .map((entry) => entry.game);
}

// ============================================
// OPTIMIZED SELECTORS - Use these instead of destructuring the whole store
// ============================================

// State selectors - only re-render when specific state changes
export const useSelectedTier = () => useGameStore((state) => state.selectedTier);
export const useCoinChoice = () => useGameStore((state) => state.coinChoice);
export const useCurrentModalGame = () => useGameStore((state) => state.currentModalGame);
export const useCurrentModalType = () => useGameStore((state) => state.currentModalType);
export const useShowGameModal = () => useGameStore((state) => state.showGameModal);

// Computed selectors - derived state
export const usePendingGamesCount = () => {
  const activeGames = useGameStore((state) => state.activeGames);
  let count = 0;
  activeGames.forEach((entry) => {
    if (entry.game.status === 'pending') count++;
  });
  return count;
};

export const useActiveGamesCount = () => {
  const activeGames = useGameStore((state) => state.activeGames);
  return activeGames.size;
};

