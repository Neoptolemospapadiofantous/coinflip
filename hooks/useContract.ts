import { useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { COINFLIP_ABI, GameState } from '@/lib/contracts/abi';
import { getCoinFlipAddress } from '@/lib/contracts/addresses';
import { useChainId } from 'wagmi';

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

// Hook to create a game
export function useCreateGame() {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  const {
    writeContract,
    data: hash,
    isPending: isWriting,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const createGame = (tier: number, choice: boolean, amount: string) => {
    writeContract({
      address: contractAddress,
      abi: COINFLIP_ABI,
      functionName: 'createGame',
      args: [tier, choice],
      value: BigInt(amount), // amount is already in wei
    });
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

// Hook to join a game
export function useJoinGame() {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  const {
    writeContract,
    data: hash,
    isPending: isWriting,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const joinGame = (gameId: string, choice: boolean, amount: string) => {
    writeContract({
      address: contractAddress,
      abi: COINFLIP_ABI,
      functionName: 'joinGame',
      args: [BigInt(gameId), choice],
      value: BigInt(amount), // amount is already in wei
    });
  };

  return {
    joinGame,
    isLoading: isWriting || isConfirming,
    isConfirming, // Expose confirming state separately
    isSuccess,
    txHash: hash,
    error: writeError,
    reset,
  };
}

// Hook to cancel a game
export function useCancelGame() {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  const {
    writeContract,
    data: hash,
    isPending: isWriting,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const cancelGame = (gameId: string | number | bigint) => {
    // Reset any previous errors
    reset();

    // Convert to string and parse the game ID, handling both numeric strings and potential prefixes
    const gameIdStr = String(gameId).replace(/^#/, ''); // Remove # prefix if present

    console.log('Cancelling game:', gameIdStr);

    // Let wagmi handle gas estimation dynamically
    // If estimation fails (tx would revert), the error will be caught and displayed
    writeContract({
      address: contractAddress,
      abi: COINFLIP_ABI,
      functionName: 'cancelGame',
      args: [BigInt(gameIdStr)],
    });
  };

  return {
    cancelGame,
    isLoading: isWriting || isConfirming,
    isSuccess,
    txHash: hash,
    error: writeError,
    reset,
  };
}

// Hook to claim VRF timeout refund
export function useClaimVrfTimeout() {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  const {
    writeContract,
    data: hash,
    isPending: isWriting,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const claimVrfTimeout = (gameId: string | number | bigint) => {
    reset();
    const gameIdStr = String(gameId).replace(/^#/, '');

    console.log('Claiming VRF timeout for game:', gameIdStr);

    writeContract({
      address: contractAddress,
      abi: COINFLIP_ABI,
      functionName: 'claimVrfTimeout',
      args: [BigInt(gameIdStr)],
    });
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
