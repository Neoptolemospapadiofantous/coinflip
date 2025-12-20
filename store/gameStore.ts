import { create } from 'zustand';
import { Game, GameStatus } from '@/types/game';

interface GameState {
  // Current game flow
  selectedTier: number | null;
  coinChoice: boolean | null; // false = heads, true = tails
  activeGameId: string | null;
  activeGame: Game | null;

  // UI state
  showMatchModal: boolean;
  showResultModal: boolean;
  showCoinFlipAnimation: boolean;

  // Actions
  setSelectedTier: (tier: number | null) => void;
  setCoinChoice: (choice: boolean | null) => void;
  setActiveGameId: (id: string | null) => void;
  setActiveGame: (game: Game | null) => void;
  setShowMatchModal: (show: boolean) => void;
  setShowResultModal: (show: boolean) => void;
  setShowCoinFlipAnimation: (show: boolean) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  // Initial state
  selectedTier: null,
  coinChoice: null,
  activeGameId: null,
  activeGame: null,
  showMatchModal: false,
  showResultModal: false,
  showCoinFlipAnimation: false,

  // Actions
  setSelectedTier: (tier) => set({ selectedTier: tier }),
  setCoinChoice: (choice) => set({ coinChoice: choice }),
  setActiveGameId: (id) => set({ activeGameId: id }),
  setActiveGame: (game) => set({ activeGame: game }),
  setShowMatchModal: (show) => set({ showMatchModal: show }),
  setShowResultModal: (show) => set({ showResultModal: show }),
  setShowCoinFlipAnimation: (show) => set({ showCoinFlipAnimation: show }),

  resetGame: () =>
    set({
      selectedTier: null,
      coinChoice: null,
      activeGameId: null,
      activeGame: null,
      showMatchModal: false,
      showResultModal: false,
      showCoinFlipAnimation: false,
    }),
}));
