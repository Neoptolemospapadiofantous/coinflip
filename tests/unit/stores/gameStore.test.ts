/**
 * Tests for store/gameStore.ts
 * Game state management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, MAX_CONCURRENT_GAMES } from '@/store/gameStore';
import { mockGame } from '../../test-utils';

describe('store/gameStore', () => {
  // Reset store before each test
  beforeEach(() => {
    useGameStore.setState({
      selectedTier: null,
      coinChoice: null,
      activeGames: new Map(),
      cancellingGames: new Set(),
      joiningGames: new Set(),
      currentModalGame: null,
      currentModalType: null,
      modalQueue: [],
      showGameModal: false,
      activeGameId: null,
      activeGame: null,
      showMatchModal: false,
    });
  });

  describe('Game Creation', () => {
    it('should set selected tier', () => {
      const { setSelectedTier } = useGameStore.getState();
      setSelectedTier(1);
      expect(useGameStore.getState().selectedTier).toBe(1);
    });

    it('should set coin choice', () => {
      const { setCoinChoice } = useGameStore.getState();
      setCoinChoice(true); // tails
      expect(useGameStore.getState().coinChoice).toBe(true);
    });

    it('should reset game creation', () => {
      const { setSelectedTier, setCoinChoice, resetGameCreation } = useGameStore.getState();

      setSelectedTier(1);
      setCoinChoice(false);
      resetGameCreation();

      const state = useGameStore.getState();
      expect(state.selectedTier).toBe(null);
      expect(state.coinChoice).toBe(null);
    });
  });

  describe('Active Games Management', () => {
    it('should add active game', () => {
      const { addActiveGame, getActiveGame } = useGameStore.getState();
      addActiveGame(mockGame);

      const game = getActiveGame(mockGame.id);
      expect(game).toBeDefined();
      expect(game?.id).toBe(mockGame.id);
    });

    it('should update active game', () => {
      const { addActiveGame, updateActiveGame, getActiveGame } = useGameStore.getState();

      addActiveGame(mockGame);
      const updatedGame = { ...mockGame, status: 'matched' as const };
      updateActiveGame(updatedGame);

      const game = getActiveGame(mockGame.id);
      expect(game?.status).toBe('matched');
    });

    it('should remove active game', () => {
      const { addActiveGame, removeActiveGame, getActiveGame } = useGameStore.getState();

      addActiveGame(mockGame);
      removeActiveGame(mockGame.id);

      const game = getActiveGame(mockGame.id);
      expect(game).toBeUndefined();
    });

    it('should track active games count', () => {
      const { addActiveGame, getActiveGamesCount } = useGameStore.getState();

      expect(getActiveGamesCount()).toBe(0);

      addActiveGame(mockGame);
      expect(getActiveGamesCount()).toBe(1);

      addActiveGame({ ...mockGame, id: '2' });
      expect(getActiveGamesCount()).toBe(2);
    });

    it('should enforce max concurrent games limit', () => {
      const { addActiveGame, canCreateNewGame } = useGameStore.getState();

      // Add maximum games
      for (let i = 0; i < MAX_CONCURRENT_GAMES; i++) {
        addActiveGame({ ...mockGame, id: String(i) });
      }

      expect(canCreateNewGame()).toBe(false);
    });

    it('should allow new game when under limit', () => {
      const { addActiveGame, canCreateNewGame } = useGameStore.getState();

      addActiveGame(mockGame);
      expect(canCreateNewGame()).toBe(true);
    });
  });

  describe('Optimistic Cancel', () => {
    it('should track cancelling state', () => {
      const { startCancellingGame, isGameCancelling } = useGameStore.getState();

      expect(isGameCancelling('1')).toBe(false);

      startCancellingGame('1');
      expect(isGameCancelling('1')).toBe(true);
    });

    it('should finish cancelling on success', () => {
      const { startCancellingGame, finishCancellingGame, isGameCancelling } = useGameStore.getState();

      startCancellingGame('1');
      finishCancellingGame('1', true);

      expect(isGameCancelling('1')).toBe(false);
    });

    it('should finish cancelling on failure', () => {
      const { startCancellingGame, finishCancellingGame, isGameCancelling } = useGameStore.getState();

      startCancellingGame('1');
      finishCancellingGame('1', false);

      expect(isGameCancelling('1')).toBe(false);
    });

    it('should remove active game on successful cancel', () => {
      const { addActiveGame, startCancellingGame, finishCancellingGame, getActiveGame } = useGameStore.getState();

      addActiveGame(mockGame);
      startCancellingGame(mockGame.id);
      finishCancellingGame(mockGame.id, true);

      expect(getActiveGame(mockGame.id)).toBeUndefined();
    });
  });

  describe('Optimistic Join', () => {
    it('should track joining state', () => {
      const { startJoiningGame, isGameJoining } = useGameStore.getState();

      expect(isGameJoining('1')).toBe(false);

      startJoiningGame('1');
      expect(isGameJoining('1')).toBe(true);
    });

    it('should finish joining on success', () => {
      const { startJoiningGame, finishJoiningGame, isGameJoining } = useGameStore.getState();

      startJoiningGame('1');
      finishJoiningGame('1', true);

      expect(isGameJoining('1')).toBe(false);
    });
  });

  describe('Modal Queue', () => {
    it('should show modal immediately when none showing', () => {
      const { queueModal } = useGameStore.getState();

      queueModal(mockGame, 'matched');

      const state = useGameStore.getState();
      // When no modal is showing, queueModal shows immediately
      expect(state.currentModalGame?.id).toBe(mockGame.id);
      expect(state.currentModalType).toBe('matched');
      expect(state.showGameModal).toBe(true);
      // Queue should be empty since it was shown immediately
      expect(state.modalQueue).toHaveLength(0);
    });

    it('should queue additional modals when one is showing', () => {
      const { queueModal } = useGameStore.getState();

      // First modal shows immediately
      queueModal(mockGame, 'matched');

      // Second modal should queue
      const game2 = { ...mockGame, id: '2' };
      queueModal(game2, 'resolved');

      const state = useGameStore.getState();
      expect(state.currentModalGame?.id).toBe(mockGame.id);
      expect(state.modalQueue).toHaveLength(1);
      expect(state.modalQueue[0].game.id).toBe('2');
    });

    it('should show next modal from queue', () => {
      const { queueModal, showNextModal } = useGameStore.getState();

      // Queue two modals
      queueModal(mockGame, 'matched');
      queueModal({ ...mockGame, id: '2' }, 'resolved');

      // Show next should advance to game 2
      showNextModal();

      const state = useGameStore.getState();
      expect(state.currentModalGame?.id).toBe('2');
      expect(state.currentModalType).toBe('resolved');
    });

    it('should clear modal when queue is empty', () => {
      const { queueModal, showNextModal } = useGameStore.getState();

      queueModal(mockGame, 'matched');

      // Show next when queue is empty
      showNextModal();

      const state = useGameStore.getState();
      expect(state.currentModalGame).toBe(null);
      expect(state.showGameModal).toBe(false);
    });

    it('should not duplicate games in queue', () => {
      const { queueModal } = useGameStore.getState();

      queueModal(mockGame, 'matched');
      queueModal(mockGame, 'matched'); // Same game, same type - should be ignored

      const state = useGameStore.getState();
      // First one shows immediately, second is duplicate and ignored
      expect(state.currentModalGame?.id).toBe(mockGame.id);
      expect(state.modalQueue).toHaveLength(0);
    });

    it('should upgrade matched to resolved for same game', () => {
      const { queueModal } = useGameStore.getState();

      // Show matched modal
      queueModal(mockGame, 'matched');

      // Upgrade to resolved
      const resolvedGame = { ...mockGame, status: 'resolved' as const };
      queueModal(resolvedGame, 'resolved');

      const state = useGameStore.getState();
      expect(state.currentModalType).toBe('resolved');
    });
  });

  describe('Legacy Compatibility', () => {
    it('should support legacy setActiveGameId', () => {
      const { setActiveGameId } = useGameStore.getState();
      setActiveGameId('123');
      expect(useGameStore.getState().activeGameId).toBe('123');
    });

    it('should support legacy setActiveGame', () => {
      const { setActiveGame } = useGameStore.getState();
      setActiveGame(mockGame);
      expect(useGameStore.getState().activeGame).toEqual(mockGame);
    });

    it('should support legacy resetGame', () => {
      const { setActiveGameId, setActiveGame, resetGame } = useGameStore.getState();

      setActiveGameId('123');
      setActiveGame(mockGame);
      resetGame();

      const state = useGameStore.getState();
      expect(state.activeGameId).toBe(null);
      expect(state.activeGame).toBe(null);
    });
  });
});
