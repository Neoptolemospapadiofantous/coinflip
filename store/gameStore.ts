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

// NOTE: PendingTxType, PendingTransaction, LastGameSettings removed
// These are now handled by:
// - usePendingTransactions hook (DB-backed pending transactions)
// - useUserPreferences hook (DB-backed user preferences including quick re-bet)

interface GameState {
  // Current game creation flow
  selectedTier: number | null;
  coinChoice: boolean | null; // false = heads, true = tails

  // Multiple active games tracking (for modal system)
  activeGames: Map<string, ActiveGameEntry>;

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

  // Actions - Active games management
  addActiveGame: (game: Game) => void;
  updateActiveGame: (game: Game) => void;
  removeActiveGame: (gameId: string) => void;
  clearAllActiveGames: () => void;
  getActiveGame: (gameId: string) => Game | undefined;
  // NOTE: getActiveGamesCount and canCreateNewGame removed - use useGameLimits hook instead
  // NOTE: Optimistic cancel/join removed - use usePendingTransactions hook instead

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
  activeGames: new Map(),
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

// ============================================
// OPTIMIZED SELECTORS - Use these instead of destructuring the whole store
// ============================================

// State selectors - only re-render when specific state changes
export const useSelectedTier = () => useGameStore((state) => state.selectedTier);
export const useCoinChoice = () => useGameStore((state) => state.coinChoice);
export const useCurrentModalGame = () => useGameStore((state) => state.currentModalGame);
export const useCurrentModalType = () => useGameStore((state) => state.currentModalType);
export const useShowGameModal = () => useGameStore((state) => state.showGameModal);

// NOTE: Removed exports:
// - useActiveGamesList, usePendingGamesCount, useActiveGamesCount
//   → Use useGameLimits from usePendingTransactions.ts for DB-backed counts
//   → Use useUserActiveGames from useGames.ts for DB-backed game lists
// - PendingTxType, PendingTransaction, LastGameSettings types
//   → Now in usePendingTransactions.ts and useUserPreferences.ts
// - Optimistic cancel/join functions (startCancellingGame, finishCancellingGame, etc.)
//   → Use usePendingTransactions hook for DB-backed tracking
