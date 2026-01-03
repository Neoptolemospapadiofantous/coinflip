'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

// Theme types matching Radix UI Theme
export type ThemeAccentColor =
  | 'cyan' | 'blue' | 'indigo' | 'purple' | 'violet'
  | 'pink' | 'red' | 'orange' | 'yellow' | 'green'
  | 'teal' | 'mint' | 'lime' | 'grass' | 'amber'
  | 'gold' | 'bronze' | 'gray';

export type ThemeGrayColor = 'gray' | 'mauve' | 'slate' | 'sage' | 'olive' | 'sand';

export type ThemeAppearance = 'light' | 'dark' | 'system';

export type ThemeRadius = 'none' | 'small' | 'medium' | 'large' | 'full';

export type ThemeScaling = '90%' | '95%' | '100%' | '105%' | '110%';

// UI preferences
interface ThemePreferences {
  appearance: ThemeAppearance;
  accentColor: ThemeAccentColor;
  grayColor: ThemeGrayColor;
  radius: ThemeRadius;
  scaling: ThemeScaling;
  panelBackground: 'solid' | 'translucent';
}

// Global UI state
interface UIState {
  // Theme
  theme: ThemePreferences;

  // Mobile/responsive
  isMobileMenuOpen: boolean;
  isSidebarCollapsed: boolean;

  // Sound preferences
  soundEnabled: boolean;
  soundVolume: number; // 0-1

  // Music preferences
  musicEnabled: boolean;
  musicVolume: number; // 0-1

  // Animation preferences
  reducedMotion: boolean;

  // Notification preferences
  toastPosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

  // Active modal (for global modal management)
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
}

interface UIActions {
  // Theme actions
  setTheme: (theme: Partial<ThemePreferences>) => void;
  setAppearance: (appearance: ThemeAppearance) => void;
  setAccentColor: (color: ThemeAccentColor) => void;
  resetTheme: () => void;

  // Mobile/responsive actions
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Sound actions
  setSoundEnabled: (enabled: boolean) => void;
  toggleSound: () => void;
  setSoundVolume: (volume: number) => void;

  // Music actions
  setMusicEnabled: (enabled: boolean) => void;
  toggleMusic: () => void;
  setMusicVolume: (volume: number) => void;

  // Animation actions
  setReducedMotion: (reduced: boolean) => void;

  // Toast actions
  setToastPosition: (position: UIState['toastPosition']) => void;

  // Modal actions
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
}

// Default theme - cyberpunk/gaming aesthetic
const defaultTheme: ThemePreferences = {
  appearance: 'dark',
  accentColor: 'cyan',
  grayColor: 'slate',
  radius: 'medium',
  scaling: '100%',
  panelBackground: 'translucent',
};

const initialState: UIState = {
  theme: defaultTheme,
  isMobileMenuOpen: false,
  isSidebarCollapsed: false,
  soundEnabled: true,
  soundVolume: 0.5,
  musicEnabled: false,
  musicVolume: 0.3,
  reducedMotion: false,
  toastPosition: 'top-right',
  activeModal: null,
  modalData: null,
};

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set, _get) => ({
      ...initialState,

      // Theme actions
      setTheme: (newTheme) =>
        set((state) => ({
          theme: { ...state.theme, ...newTheme },
        })),

      setAppearance: (appearance) =>
        set((state) => ({
          theme: { ...state.theme, appearance },
        })),

      setAccentColor: (accentColor) =>
        set((state) => ({
          theme: { ...state.theme, accentColor },
        })),

      resetTheme: () =>
        set({ theme: defaultTheme }),

      // Mobile/responsive actions
      setMobileMenuOpen: (isMobileMenuOpen) =>
        set({ isMobileMenuOpen }),

      toggleMobileMenu: () =>
        set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),

      setSidebarCollapsed: (isSidebarCollapsed) =>
        set({ isSidebarCollapsed }),

      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      // Sound actions
      setSoundEnabled: (soundEnabled) =>
        set({ soundEnabled }),

      toggleSound: () =>
        set((state) => ({ soundEnabled: !state.soundEnabled })),

      setSoundVolume: (soundVolume) =>
        set({ soundVolume: Math.max(0, Math.min(1, soundVolume)) }),

      // Music actions
      setMusicEnabled: (musicEnabled) =>
        set({ musicEnabled }),

      toggleMusic: () =>
        set((state) => ({ musicEnabled: !state.musicEnabled })),

      setMusicVolume: (musicVolume) =>
        set({ musicVolume: Math.max(0, Math.min(1, musicVolume)) }),

      // Animation actions
      setReducedMotion: (reducedMotion) =>
        set({ reducedMotion }),

      // Toast actions
      setToastPosition: (toastPosition) =>
        set({ toastPosition }),

      // Modal actions
      openModal: (activeModal, modalData) =>
        set({ activeModal, modalData: modalData ?? null }),

      closeModal: () =>
        set({ activeModal: null, modalData: null }),
    }),
    {
      name: 'coinflip-ui-preferences',
      partialize: (state) => ({
        // Only persist user preferences, not transient UI state
        theme: state.theme,
        soundEnabled: state.soundEnabled,
        soundVolume: state.soundVolume,
        musicEnabled: state.musicEnabled,
        musicVolume: state.musicVolume,
        reducedMotion: state.reducedMotion,
        toastPosition: state.toastPosition,
        isSidebarCollapsed: state.isSidebarCollapsed,
      }),
    }
  )
);

// Selector hooks for performance (prevent unnecessary re-renders)
// Use primitive selectors or useShallow for objects to avoid infinite loops
export const useTheme = () => useUIStore(useShallow((state) => state.theme));
export const useAppearance = () => useUIStore((state) => state.theme.appearance);
export const useAccentColor = () => useUIStore((state) => state.theme.accentColor);
export const useSoundEnabled = () => useUIStore((state) => state.soundEnabled);
export const useSoundVolume = () => useUIStore((state) => state.soundVolume);
export const useMusicEnabled = () => useUIStore((state) => state.musicEnabled);
export const useMusicVolume = () => useUIStore((state) => state.musicVolume);
export const useReducedMotion = () => useUIStore((state) => state.reducedMotion);
export const useActiveModalId = () => useUIStore((state) => state.activeModal);
export const useActiveModalData = () => useUIStore((state) => state.modalData);
