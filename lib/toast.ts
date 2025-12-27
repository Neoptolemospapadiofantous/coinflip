import toast from 'react-hot-toast';

export const showToast = {
  success: (message: string) => {
    toast.success(message);
  },

  error: (message: string) => {
    toast.error(message);
  },

  loading: (message: string) => {
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
