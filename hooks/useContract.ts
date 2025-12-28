import { useWaitForTransactionReceipt, useReadContract, usePublicClient, useChainId, useWalletClient } from 'wagmi';
import { COINFLIP_ABI, GameState } from '@/lib/contracts/abi';
import { getCoinFlipAddress } from '@/lib/contracts/addresses';
import { encodeFunctionData } from 'viem';
import { useState, useRef, useEffect, useCallback } from 'react';
import { isUserError } from '@/lib/errors';

// Static gas limits - safe values that work on Sepolia
const GAS_CAPS = {
  createGame: BigInt(300_000),
  joinGame: BigInt(500_000),
  cancelGame: BigInt(200_000),
  claimVrfTimeout: BigInt(200_000),
};

// =============================================================
// INPUT VALIDATION
// =============================================================

// Valid tier range (0-9 based on contract)
const MIN_TIER = 0;
const MAX_TIER = 9;

// Minimum bet amount in wei (prevent dust transactions)
const MIN_BET_WEI = BigInt(1000); // 1000 wei minimum

/**
 * Validate tier is within valid range
 */
function validateTier(tier: number): { valid: boolean; error?: string } {
  if (typeof tier !== 'number' || !Number.isInteger(tier)) {
    return { valid: false, error: 'Tier must be an integer' };
  }
  if (tier < MIN_TIER || tier > MAX_TIER) {
    return { valid: false, error: `Tier must be between ${MIN_TIER} and ${MAX_TIER}` };
  }
  return { valid: true };
}

/**
 * Validate amount string can be converted to BigInt and is reasonable
 */
function validateAmount(amount: string): { valid: boolean; error?: string; value?: bigint } {
  if (typeof amount !== 'string' || amount.trim() === '') {
    return { valid: false, error: 'Amount must be a non-empty string' };
  }

  try {
    const value = BigInt(amount);
    if (value < 0) {
      return { valid: false, error: 'Amount cannot be negative' };
    }
    if (value < MIN_BET_WEI) {
      return { valid: false, error: 'Amount is too small' };
    }
    return { valid: true, value };
  } catch {
    return { valid: false, error: 'Amount must be a valid number string' };
  }
}

/**
 * Validate gameId can be converted to BigInt
 */
function validateGameId(gameId: string | number | bigint): { valid: boolean; error?: string; value?: bigint } {
  try {
    // Handle string with optional # prefix
    const idStr = typeof gameId === 'string' ? gameId.replace(/^#/, '').trim() : String(gameId);

    if (idStr === '') {
      return { valid: false, error: 'Game ID cannot be empty' };
    }

    const value = BigInt(idStr);
    if (value < 0) {
      return { valid: false, error: 'Game ID cannot be negative' };
    }

    return { valid: true, value };
  } catch {
    return { valid: false, error: 'Game ID must be a valid number' };
  }
}

// Re-export GameState for backwards compatibility
export { GameState };

// Type for the game struct returned by getGame
export interface OnChainGame {
  playerA: string;
  playerB: string;
  tier: number;
  choiceA: boolean;
  state: number;
  createdBlock: bigint;
  lockedBlock: bigint;
  vrfRequestId: bigint;
  coinResult: boolean;
  winner: string;
}

// Hook to create a game - uses wallet client directly for full gas control
export function useCreateGame() {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);
  const { data: walletClient } = useWalletClient();

  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [isWriting, setIsWriting] = useState(false);
  const [writeError, setWriteError] = useState<Error | null>(null);
  const [wasRejected, setWasRejected] = useState(false);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const reset = () => {
    setHash(undefined);
    setWriteError(null);
    setIsWriting(false);
    setWasRejected(false);
  };

  const createGame = async (tier: number, choice: boolean, amount: string) => {
    if (!walletClient) {
      setWriteError(new Error('Wallet not connected'));
      return;
    }

    // Validate inputs before sending transaction
    const tierValidation = validateTier(tier);
    if (!tierValidation.valid) {
      setWriteError(new Error(tierValidation.error));
      return;
    }

    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      setWriteError(new Error(amountValidation.error));
      return;
    }

    setIsWriting(true);
    setWriteError(null);

    try {
      const txData = encodeFunctionData({
        abi: COINFLIP_ABI,
        functionName: 'createGame',
        args: [tier, choice],
      });

      console.log(`🚀 Sending createGame tx with gas=${GAS_CAPS.createGame}`);

      const txHash = await walletClient.sendTransaction({
        to: contractAddress,
        data: txData,
        value: amountValidation.value!,
        gas: GAS_CAPS.createGame,
      });

      console.log(`✅ Transaction sent: ${txHash.slice(0, 10)}...`);
      setHash(txHash);
    } catch (err) {
      // Don't show error for user-initiated rejections
      if (isUserError(err)) {
        console.log('ℹ️ Transaction cancelled by user');
        setWasRejected(true);
      } else {
        console.error('❌ Transaction failed:', err);
        setWriteError(err as Error);
      }
    } finally {
      setIsWriting(false);
    }
  };

  return {
    createGame,
    isLoading: isWriting || isConfirming,
    isSuccess,
    txHash: hash,
    error: writeError,
    wasRejected,
    reset,
  };
}

// Hook to join a game - uses wallet client directly for full gas control
// Note: Joiner automatically bets against creator's choice (heads vs tails game)
export function useJoinGame() {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);
  const { data: walletClient } = useWalletClient();

  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [isWriting, setIsWriting] = useState(false);
  const [writeError, setWriteError] = useState<Error | null>(null);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const reset = () => {
    setHash(undefined);
    setWriteError(null);
    setIsWriting(false);
  };

  const joinGame = async (gameId: string, amount: string) => {
    if (!walletClient) {
      setWriteError(new Error('Wallet not connected'));
      return;
    }

    // Validate inputs before sending transaction
    const gameIdValidation = validateGameId(gameId);
    if (!gameIdValidation.valid) {
      setWriteError(new Error(gameIdValidation.error));
      return;
    }

    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      setWriteError(new Error(amountValidation.error));
      return;
    }

    setIsWriting(true);
    setWriteError(null);

    try {
      const txData = encodeFunctionData({
        abi: COINFLIP_ABI,
        functionName: 'joinGame',
        args: [gameIdValidation.value!],
      });

      console.log(`🚀 Sending joinGame tx with gas=${GAS_CAPS.joinGame}`);

      const txHash = await walletClient.sendTransaction({
        to: contractAddress,
        data: txData,
        value: amountValidation.value!,
        gas: GAS_CAPS.joinGame,
      });

      console.log(`✅ Transaction sent: ${txHash.slice(0, 10)}...`);
      setHash(txHash);
    } catch (err) {
      // Don't show error for user-initiated rejections
      if (isUserError(err)) {
        console.log('ℹ️ Transaction cancelled by user');
      } else {
        console.error('❌ Transaction failed:', err);
        setWriteError(err as Error);
      }
    } finally {
      setIsWriting(false);
    }
  };

  return {
    joinGame,
    isLoading: isWriting || isConfirming,
    isConfirming,
    isSuccess,
    txHash: hash,
    error: writeError,
    reset,
  };
}

// Cooldown between cancel operations (5 seconds)
const CANCEL_COOLDOWN_MS = 5000;

// Hook to cancel a game - uses wallet client directly for full gas control
export function useCancelGame() {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);
  const { data: walletClient } = useWalletClient();

  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [isWriting, setIsWriting] = useState(false);
  const [writeError, setWriteError] = useState<Error | null>(null);
  const [isCooldown, setIsCooldown] = useState(false);
  const [wasRejected, setWasRejected] = useState(false);
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
        cooldownTimeoutRef.current = null;
      }
    };
  }, []);

  const reset = useCallback(() => {
    setHash(undefined);
    setWriteError(null);
    setIsWriting(false);
    setWasRejected(false);
    // Don't reset cooldown on manual reset - it should expire naturally
  }, []);

  const cancelGame = useCallback(async (gameId: string | number | bigint) => {
    if (!walletClient) {
      setWriteError(new Error('Wallet not connected'));
      return;
    }

    // Validate gameId before proceeding
    const gameIdValidation = validateGameId(gameId);
    if (!gameIdValidation.valid) {
      setWriteError(new Error(gameIdValidation.error));
      return;
    }

    if (isCooldown) {
      console.log('⏳ Cancel cooldown active, please wait...');
      return;
    }

    reset();
    setIsWriting(true);
    setIsCooldown(true);

    // Clear any existing cooldown timer
    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
    }

    // Start cooldown timer
    cooldownTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setIsCooldown(false);
      }
      cooldownTimeoutRef.current = null;
    }, CANCEL_COOLDOWN_MS);

    try {
      const txData = encodeFunctionData({
        abi: COINFLIP_ABI,
        functionName: 'cancelGame',
        args: [gameIdValidation.value!],
      });

      console.log(`🚀 Sending cancelGame tx for game ${gameIdValidation.value} with gas=${GAS_CAPS.cancelGame}`);

      const txHash = await walletClient.sendTransaction({
        to: contractAddress,
        data: txData,
        gas: GAS_CAPS.cancelGame,
      });

      console.log(`✅ Transaction sent: ${txHash.slice(0, 10)}...`);
      setHash(txHash);
    } catch (err) {
      // Don't show error for user-initiated rejections
      if (isUserError(err)) {
        console.log('ℹ️ Transaction cancelled by user');
        setWasRejected(true);
      } else {
        console.error('❌ Transaction failed:', err);
        setWriteError(err as Error);
      }
    } finally {
      setIsWriting(false);
    }
  }, [walletClient, isCooldown, reset, contractAddress]);

  return {
    cancelGame,
    isLoading: isWriting || isConfirming || isCooldown,
    isSuccess,
    txHash: hash,
    error: writeError,
    wasRejected,
    reset,
    isCooldown,
  };
}

// Hook to claim VRF timeout refund - uses wallet client directly for full gas control
export function useClaimVrfTimeout() {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);
  const { data: walletClient } = useWalletClient();

  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [isWriting, setIsWriting] = useState(false);
  const [writeError, setWriteError] = useState<Error | null>(null);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const reset = () => {
    setHash(undefined);
    setWriteError(null);
    setIsWriting(false);
  };

  const claimVrfTimeout = async (gameId: string | number | bigint) => {
    if (!walletClient) {
      setWriteError(new Error('Wallet not connected'));
      return;
    }

    // Validate gameId before proceeding
    const gameIdValidation = validateGameId(gameId);
    if (!gameIdValidation.valid) {
      setWriteError(new Error(gameIdValidation.error));
      return;
    }

    reset();
    setIsWriting(true);

    try {
      const txData = encodeFunctionData({
        abi: COINFLIP_ABI,
        functionName: 'claimVrfTimeout',
        args: [gameIdValidation.value!],
      });

      console.log(`🚀 Sending claimVrfTimeout tx for game ${gameIdValidation.value} with gas=${GAS_CAPS.claimVrfTimeout}`);

      const txHash = await walletClient.sendTransaction({
        to: contractAddress,
        data: txData,
        gas: GAS_CAPS.claimVrfTimeout,
      });

      console.log(`✅ Transaction sent: ${txHash.slice(0, 10)}...`);
      setHash(txHash);
    } catch (err) {
      // Don't show error for user-initiated rejections
      if (isUserError(err)) {
        console.log('ℹ️ Transaction cancelled by user');
      } else {
        console.error('❌ Transaction failed:', err);
        setWriteError(err as Error);
      }
    } finally {
      setIsWriting(false);
    }
  };

  return {
    claimVrfTimeout,
    isLoading: isWriting || isConfirming,
    isSuccess,
    txHash: hash,
    error: writeError,
    reset,
  };
}

// Hook to read game data from contract
export function useGameData(gameId: string | null) {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: COINFLIP_ABI,
    functionName: 'getGame',
    args: gameId ? [BigInt(gameId)] : undefined,
    query: {
      enabled: !!gameId,
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });
}

// Hook to check if VRF timeout can be claimed
export function useCanClaimVrfTimeout(gameId: string | null) {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: COINFLIP_ABI,
    functionName: 'canClaimVrfTimeout',
    args: gameId ? [BigInt(gameId)] : undefined,
    query: {
      enabled: !!gameId,
      refetchInterval: 10000, // Check every 10 seconds
    },
  });
}

// Hook to get VRF timeout blocks remaining
export function useVrfTimeoutBlocksRemaining(gameId: string | null) {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: COINFLIP_ABI,
    functionName: 'getVrfTimeoutBlocksRemaining',
    args: gameId ? [BigInt(gameId)] : undefined,
    query: {
      enabled: !!gameId,
      refetchInterval: 10000,
    },
  });
}

// Hook to get a function that checks game status on-chain (for use in callbacks)
export function useCheckGameStatus() {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  return async (gameId: string): Promise<GameState | null> => {
    if (!publicClient) return null;

    try {
      const result = await publicClient.readContract({
        address: contractAddress,
        abi: COINFLIP_ABI,
        functionName: 'getGame',
        args: [BigInt(gameId)],
      }) as OnChainGame;

      console.log(`🔍 On-chain game ${gameId}:`, {
        playerA: result.playerA,
        playerB: result.playerB,
        tier: result.tier,
        state: result.state,
        createdBlock: result.createdBlock.toString(),
      });

      return result.state as GameState;
    } catch (err) {
      console.error(`❌ Error reading game ${gameId}:`, err);
      return null;
    }
  };
}

// Hook to get tier info
export function useTierInfo(tier: number | null) {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: COINFLIP_ABI,
    functionName: 'getTier',
    args: tier !== null ? [tier] : undefined,
    query: {
      enabled: tier !== null,
    },
  });
}

// Hook to check if game can be cancelled
export function useCanCancelGame(gameId: string | null) {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: COINFLIP_ABI,
    functionName: 'canCancelGame',
    args: gameId ? [BigInt(gameId)] : undefined,
    query: {
      enabled: !!gameId,
      refetchInterval: 10000,
    },
  });
}
