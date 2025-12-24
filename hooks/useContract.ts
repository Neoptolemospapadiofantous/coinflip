import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { COINFLIP_ABI } from '@/lib/contracts/abi';
import { getCoinFlipAddress } from '@/lib/contracts/addresses';
import { useChainId } from 'wagmi';
import { parseEther } from 'viem';

// Hook to create a game
export function useCreateGame() {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  const {
    writeContract,
    data: hash,
    isPending: isWriting,
    error: writeError,
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
    isSuccess,
    txHash: hash,
    error: writeError,
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

// Hook to read game data
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

// Hook to get tier amount
export function useTierAmount(tier: number | null) {
  const chainId = useChainId();
  const contractAddress = getCoinFlipAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: COINFLIP_ABI,
    functionName: 'getTierAmount',
    args: tier !== null ? [tier] : undefined,
    query: {
      enabled: tier !== null,
    },
  });
}
