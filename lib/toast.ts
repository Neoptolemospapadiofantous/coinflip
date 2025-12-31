import toast from 'react-hot-toast';
import { TOAST_DEDUPE_WINDOW_MS, TOAST_CLEANUP_INTERVAL_MS } from './constants';

// Deduplication: Track recent toasts to prevent spam
const recentToasts = new Map<string, number>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentToasts.entries()) {
    if (now - timestamp > TOAST_DEDUPE_WINDOW_MS) {
      recentToasts.delete(key);
    }
  }
}, TOAST_CLEANUP_INTERVAL_MS);

// Check if toast was recently shown (returns true if duplicate)
function isDuplicate(type: string, message: string): boolean {
  const key = `${type}:${message}`;
  const lastShown = recentToasts.get(key);
  const now = Date.now();

  if (lastShown && now - lastShown < TOAST_DEDUPE_WINDOW_MS) {
    return true; // Duplicate
  }

  recentToasts.set(key, now);
  return false;
}

export const showToast = {
  success: (message: string) => {
    if (isDuplicate('success', message)) return;
    toast.success(message);
  },

  error: (message: string) => {
    if (isDuplicate('error', message)) return;
    toast.error(message);
  },

  info: (message: string) => {
    if (isDuplicate('info', message)) return;
    toast(message, { icon: 'ℹ️' });
  },

  warning: (message: string) => {
    if (isDuplicate('warning', message)) return;
    toast(message, { icon: '⚠️' });
  },

  loading: (message: string) => {
    // Loading toasts are typically managed manually, don't dedupe
    return toast.loading(message);
  },

  dismiss: (toastId: string) => {
    toast.dismiss(toastId);
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) => {
    return toast.promise(promise, messages);
  },

  // Game-specific toasts
  gameCreated: (gameId: string) => {
    toast.success(`Game #${gameId} created! Waiting for opponent...`, {
      icon: '🎮',
    });
  },

  gameMatched: () => {
    toast.success('Opponent found! Waiting for VRF result...', {
      icon: '🎯',
    });
  },

  gameWon: (amount: string) => {
    toast.success(`You won ${amount}!`, {
      icon: '🎉',
      duration: 6000,
    });
  },

  gameLost: () => {
    toast.error('Better luck next time!', {
      icon: '😔',
      duration: 4000,
    });
  },

  transactionSigning: () => {
    return toast.loading('Please sign the transaction in your wallet...', {
      icon: '✍️',
    });
  },

  transactionPending: (txHash: string) => {
    return toast.loading(`Transaction pending: ${txHash.slice(0, 10)}...`, {
      icon: '⏳',
    });
  },

  transactionSuccess: (txHash: string) => {
    toast.success(`Transaction confirmed: ${txHash.slice(0, 10)}...`, {
      icon: '✅',
    });
  },

  transactionError: (error: string) => {
    toast.error(error, {
      icon: '❌',
      duration: 6000,
    });
  },

  walletConnected: (address: string) => {
    toast.success(`Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`, {
      icon: '👛',
    });
  },

  walletDisconnected: () => {
    toast('Wallet disconnected', {
      icon: '👋',
    });
  },

  insufficientBalance: () => {
    toast.error('Insufficient balance for this bet', {
      icon: '💰',
    });
  },

  networkSwitchRequired: (network: string) => {
    toast.error(`Please switch to ${network}`, {
      icon: '🔄',
    });
  },
};
