import { create } from 'zustand';

interface QueueState {
  isInQueue: boolean;
  queuedTier: number | null;
  queuedGameId: string | null;
  joinedAt: Date | null;
  matchedWith: string | null;

  // Actions
  joinQueue: (tier: number, gameId: string) => void;
  leaveQueue: () => void;
  setMatch: (opponent: string) => void;
  resetQueue: () => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  // Initial state
  isInQueue: false,
  queuedTier: null,
  queuedGameId: null,
  joinedAt: null,
  matchedWith: null,

  // Actions
  joinQueue: (tier, gameId) =>
    set({
      isInQueue: true,
      queuedTier: tier,
      queuedGameId: gameId,
      joinedAt: new Date(),
    }),

  leaveQueue: () =>
    set({
      isInQueue: false,
      queuedTier: null,
      queuedGameId: null,
      joinedAt: null,
      matchedWith: null,
    }),

  setMatch: (opponent) =>
    set({
      matchedWith: opponent,
      isInQueue: false,
    }),

  resetQueue: () =>
    set({
      isInQueue: false,
      queuedTier: null,
      queuedGameId: null,
      joinedAt: null,
      matchedWith: null,
    }),
}));
