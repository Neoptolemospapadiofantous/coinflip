import { useWaitForTransactionReceipt, useReadContract, usePublicClient, useChainId, useWalletClient } from 'wagmi';
import { COINFLIP_ABI, GameState } from '@/lib/contracts/abi';
import { getCoinFlipAddress } from '@/lib/contracts/addresses';
import { encodeFunctionData } from 'viem';
import { useState, useRef, useEffect, useCallback } from 'react';

// Static gas limits - safe values that work on Sepolia
const GAS_CAPS = {
  createGame: BigInt(300_000),
  joinGame: BigInt(500_000),
  cancelGame: BigInt(200_000),
  claimVrfTimeout: BigInt(200_000),
};

// Re-export GameState for backwards compatibility
export { GameState };

// Legacy alias
export const GameStatus = GameState;

// Type for the game struct returned by getGame
export interface OnChainGame {
  playerA: string;
  playerB: string;
  tier: number;
  choiceA: boolean;
  state: number;
  createdBlock: bigint;
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

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const reset = () => {
    setHash(undefined);
    setWriteError(null);
    setIsWriting(false);
  };

  const createGame = async (tier: number, choice: boolean, amount: string) => {
    if (!walletClient) {
      setWriteError(new Error('Wallet not connected'));
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
        value: BigInt(amount),
        gas: GAS_CAPS.createGame,
      });

      console.log(`✅ Transaction sent: ${txHash}`);
      setHash(txHash);
    } catch (err) {
      console.error('❌ Transaction failed:', err);
      setWriteError(err as Error);
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
    reset,
  };
}

// Hook to join a game - uses wallet client directly for full gas control
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

  const joinGame = async (gameId: string, choice: boolean, amount: string) => {
    if (!walletClient) {
      setWriteError(new Error('Wallet not connected'));
      return;
    }

    setIsWriting(true);
    setWriteError(null);

    try {
      const txData = encodeFunctionData({
        abi: COINFLIP_ABI,
        functionName: 'joinGame',
        args: [BigInt(gameId), choice],
      });

      console.log(`🚀 Sending joinGame tx with gas=${GAS_CAPS.joinGame}`);

      const txHash = await walletClient.sendTransaction({
        to: contractAddress,
        data: txData,
        value: BigInt(amount),
        gas: GAS_CAPS.joinGame,
      });

      console.log(`✅ Transaction sent: ${txHash}`);
      setHash(txHash);
    } catch (err) {
      console.error('❌ Transaction failed:', err);
      setWriteError(err as Error);
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
    // Don't reset cooldown on manual reset - it should expire naturally
  }, []);

  const cancelGame = useCallback(async (gameId: string | number | bigint) => {
    if (!walletClient) {
      setWriteError(new Error('Wallet not connected'));
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
      const gameIdStr = String(gameId).replace(/^#/, '');
      const gameIdBigInt = BigInt(gameIdStr);

      const txData = encodeFunctionData({
        abi: COINFLIP_ABI,
        functionName: 'cancelGame',
        args: [gameIdBigInt],
      });

      console.log(`🚀 Sending cancelGame tx for game ${gameIdStr} with gas=${GAS_CAPS.cancelGame}`);

      const txHash = await walletClient.sendTransaction({
        to: contractAddress,
        data: txData,
        gas: GAS_CAPS.cancelGame,
      });

      console.log(`✅ Transaction sent: ${txHash}`);
      setHash(txHash);
    } catch (err) {
      console.error('❌ Transaction failed:', err);
      setWriteError(err as Error);
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

    reset();
    setIsWriting(true);

    try {
      const gameIdStr = String(gameId).replace(/^#/, '');
      const gameIdBigInt = BigInt(gameIdStr);

      const txData = encodeFunctionData({
        abi: COINFLIP_ABI,
        functionName: 'claimVrfTimeout',
        args: [gameIdBigInt],
      });

      console.log(`🚀 Sending claimVrfTimeout tx for game ${gameIdStr} with gas=${GAS_CAPS.claimVrfTimeout}`);

      const txHash = await walletClient.sendTransaction({
        to: contractAddress,
        data: txData,
        gas: GAS_CAPS.claimVrfTimeout,
      });

      console.log(`✅ Transaction sent: ${txHash}`);
      setHash(txHash);
    } catch (err) {
      console.error('❌ Transaction failed:', err);
      setWriteError(err as Error);
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
