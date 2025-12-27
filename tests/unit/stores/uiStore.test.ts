/**
 * Tests for store/uiStore.ts
 * UI state management (theme, preferences)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';

describe('store/uiStore', () => {
  // Reset store before each test
  beforeEach(() => {
    useUIStore.setState({
      theme: {
        appearance: 'dark',
        accentColor: 'cyan',
        grayColor: 'slate',
        radius: 'medium',
        scaling: '100%',
        panelBackground: 'translucent',
      },
      isMobileMenuOpen: false,
      isSidebarCollapsed: false,
      soundEnabled: true,
      soundVolume: 0.5,
      reducedMotion: false,
      toastPosition: 'top-right',
      activeModal: null,
      modalData: null,
    });
  });

  describe('Theme Management', () => {
    it('should have default dark theme', () => {
      const state = useUIStore.getState();
      expect(state.theme.appearance).toBe('dark');
    });

    it('should set appearance', () => {
      const { setAppearance } = useUIStore.getState();
      setAppearance('light');
      expect(useUIStore.getState().theme.appearance).toBe('light');
    });

    it('should support system appearance', () => {
      const { setAppearance } = useUIStore.getState();
      setAppearance('system');
      expect(useUIStore.getState().theme.appearance).toBe('system');
    });

    it('should set accent color', () => {
      const { setAccentColor } = useUIStore.getState();
      setAccentColor('blue');
      expect(useUIStore.getState().theme.accentColor).toBe('blue');
    });

    it('should set theme with partial update', () => {
      const { setTheme } = useUIStore.getState();
      setTheme({ grayColor: 'gray' });
      expect(useUIStore.getState().theme.grayColor).toBe('gray');
      // Other values should remain unchanged
      expect(useUIStore.getState().theme.appearance).toBe('dark');
    });

    it('should set multiple theme properties at once', () => {
      const { setTheme } = useUIStore.getState();
      setTheme({ radius: 'full', scaling: '110%', panelBackground: 'solid' });

      const state = useUIStore.getState();
      expect(state.theme.radius).toBe('full');
      expect(state.theme.scaling).toBe('110%');
      expect(state.theme.panelBackground).toBe('solid');
    });

    it('should reset theme to defaults', () => {
      const { setAppearance, setAccentColor, resetTheme } = useUIStore.getState();

      setAppearance('light');
      setAccentColor('red');
      resetTheme();

      const state = useUIStore.getState();
      expect(state.theme.appearance).toBe('dark');
      expect(state.theme.accentColor).toBe('cyan');
    });
  });

  describe('Sound Preferences', () => {
    it('should have sound enabled by default', () => {
      const state = useUIStore.getState();
      expect(state.soundEnabled).toBe(true);
    });

    it('should toggle sound', () => {
      const { toggleSound } = useUIStore.getState();

      toggleSound();
      expect(useUIStore.getState().soundEnabled).toBe(false);

      toggleSound();
      expect(useUIStore.getState().soundEnabled).toBe(true);
    });

    it('should set sound directly', () => {
      const { setSoundEnabled } = useUIStore.getState();

      setSoundEnabled(false);
      expect(useUIStore.getState().soundEnabled).toBe(false);

      setSoundEnabled(true);
      expect(useUIStore.getState().soundEnabled).toBe(true);
    });

    it('should set sound volume', () => {
      const { setSoundVolume } = useUIStore.getState();

      setSoundVolume(0.8);
      expect(useUIStore.getState().soundVolume).toBe(0.8);
    });

    it('should clamp sound volume to valid range', () => {
      const { setSoundVolume } = useUIStore.getState();

      setSoundVolume(1.5);
      expect(useUIStore.getState().soundVolume).toBe(1);

      setSoundVolume(-0.5);
      expect(useUIStore.getState().soundVolume).toBe(0);
    });
  });

  describe('Mobile Menu', () => {
    it('should toggle mobile menu', () => {
      const { toggleMobileMenu } = useUIStore.getState();

      toggleMobileMenu();
      expect(useUIStore.getState().isMobileMenuOpen).toBe(true);

      toggleMobileMenu();
      expect(useUIStore.getState().isMobileMenuOpen).toBe(false);
    });

    it('should set mobile menu state directly', () => {
      const { setMobileMenuOpen } = useUIStore.getState();

      setMobileMenuOpen(true);
      expect(useUIStore.getState().isMobileMenuOpen).toBe(true);

      setMobileMenuOpen(false);
      expect(useUIStore.getState().isMobileMenuOpen).toBe(false);
    });
  });

  describe('Sidebar', () => {
    it('should toggle sidebar', () => {
      const { toggleSidebar } = useUIStore.getState();

      toggleSidebar();
      expect(useUIStore.getState().isSidebarCollapsed).toBe(true);

      toggleSidebar();
      expect(useUIStore.getState().isSidebarCollapsed).toBe(false);
    });

    it('should set sidebar state directly', () => {
      const { setSidebarCollapsed } = useUIStore.getState();

      setSidebarCollapsed(true);
      expect(useUIStore.getState().isSidebarCollapsed).toBe(true);
    });
  });

  describe('Reduced Motion', () => {
    it('should set reduced motion preference', () => {
      const { setReducedMotion } = useUIStore.getState();

      setReducedMotion(true);
      expect(useUIStore.getState().reducedMotion).toBe(true);

      setReducedMotion(false);
      expect(useUIStore.getState().reducedMotion).toBe(false);
    });
  });

  describe('Toast Position', () => {
    it('should set toast position', () => {
      const { setToastPosition } = useUIStore.getState();

      setToastPosition('bottom-center');
      expect(useUIStore.getState().toastPosition).toBe('bottom-center');
    });
  });

  describe('Modal Management', () => {
    it('should open modal with id', () => {
      const { openModal } = useUIStore.getState();

      openModal('settings');
      expect(useUIStore.getState().activeModal).toBe('settings');
    });

    it('should open modal with data', () => {
      const { openModal } = useUIStore.getState();

      openModal('game-details', { gameId: '123' });

      const state = useUIStore.getState();
      expect(state.activeModal).toBe('game-details');
      expect(state.modalData).toEqual({ gameId: '123' });
    });

    it('should close modal', () => {
      const { openModal, closeModal } = useUIStore.getState();

      openModal('settings', { tab: 'theme' });
      closeModal();

      const state = useUIStore.getState();
      expect(state.activeModal).toBe(null);
      expect(state.modalData).toBe(null);
    });
  });

  describe('Theme Selectors', () => {
    it('should provide useTheme selector', () => {
      // The useTheme hook should return theme object
      const state = useUIStore.getState();
      expect(state.theme).toBeDefined();
      expect(state.theme.appearance).toBeDefined();
      expect(state.theme.accentColor).toBeDefined();
    });
  });
});
