import { create } from 'zustand';

interface UIState {
  isMobileMenuOpen: boolean;
  activeModal: string | null;
  isLoading: boolean;
  loadingMessage: string | null;

  // Actions
  setMobileMenuOpen: (open: boolean) => void;
  setActiveModal: (modal: string | null) => void;
  setLoading: (loading: boolean, message?: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  isMobileMenuOpen: false,
  activeModal: null,
  isLoading: false,
  loadingMessage: null,

  // Actions
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  setLoading: (loading, message) =>
    set({
      isLoading: loading,
      loadingMessage: message || null,
    }),
}));
