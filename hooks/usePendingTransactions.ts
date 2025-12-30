'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { devLog } from '@/lib/utils';

export type PendingTxType = 'create' | 'cancel' | 'join';
export type PendingTxStatus = 'pending' | 'submitted' | 'confirmed' | 'failed' | 'expired';

export interface PendingTransaction {
  id: number;
  user_address: string;
  tx_type: PendingTxType;
  tx_hash: string | null;
  game_id: number | null;
  tier: number | null;
  choice: boolean | null;
  amount_eth: string | null;
  status: PendingTxStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Input for creating a new pending transaction
export interface CreatePendingTxInput {
  tx_type: PendingTxType;
  game_id?: string | number;
  tier?: number;
  choice?: boolean;
  amount_eth?: string;
}

/**
 * Hook for managing pending transactions in the database
 * Tracks blockchain transactions that are awaiting confirmation
 */
export function usePendingTransactions() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const pendingOpsRef = useRef<Set<string>>(new Set());

  // Query key for pending transactions
  const queryKey = ['pending-transactions', address?.toLowerCase()];

  // Fetch active pending transactions
  const { data: pendingTransactions, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<PendingTransaction[]> => {
      if (!address) return [];

      const { data, error } = await supabase
        .from('pending_transactions')
        .select('*')
        .eq('user_address', address.toLowerCase())
        .in('status', ['pending', 'submitted'])
        .order('created_at', { ascending: false });

      if (error) {
        devLog.warn('[PendingTx] Error fetching:', error.message);
        return [];
      }

      return data || [];
    },
    enabled: !!address,
    staleTime: 5000, // 5 seconds
    gcTime: 60 * 1000, // 1 minute
    // No polling - use realtime subscription instead
  });

  // Realtime subscription for instant updates
  useEffect(() => {
    if (!address) return;

    const channel = supabase
      .channel(`pending_tx_${address.toLowerCase()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_transactions',
          filter: `user_address=eq.${address.toLowerCase()}`,
        },
        (payload) => {
          devLog.log('[PendingTx] Realtime update:', payload.eventType);

          if (payload.eventType === 'INSERT') {
            const newTx = payload.new as PendingTransaction;
            if (['pending', 'submitted'].includes(newTx.status)) {
              queryClient.setQueryData<PendingTransaction[]>(queryKey, (old) => {
                // Avoid duplicates
                if (old?.some(tx => tx.id === newTx.id)) return old;
                return [...(old || []), newTx];
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedTx = payload.new as PendingTransaction;
            queryClient.setQueryData<PendingTransaction[]>(queryKey, (old) => {
              // If status is no longer pending/submitted, remove from list
              if (!['pending', 'submitted'].includes(updatedTx.status)) {
                return (old || []).filter(tx => tx.id !== updatedTx.id);
              }
              // Otherwise update the tx
              return (old || []).map(tx =>
                tx.id === updatedTx.id ? updatedTx : tx
              );
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedTx = payload.old as PendingTransaction;
            queryClient.setQueryData<PendingTransaction[]>(queryKey, (old) => {
              return (old || []).filter(tx => tx.id !== deletedTx.id);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [address, queryClient, queryKey]);

  // Create a new pending transaction
  const createMutation = useMutation({
    mutationFn: async (input: CreatePendingTxInput): Promise<PendingTransaction> => {
      if (!address) throw new Error('No address');

      // Convert game_id to number if it's a string
      const gameId = input.game_id
        ? (typeof input.game_id === 'string' ? Number(input.game_id) : input.game_id)
        : null;

      const { data, error } = await supabase
        .from('pending_transactions')
        .insert({
          user_address: address.toLowerCase(),
          tx_type: input.tx_type,
          game_id: gameId,
          tier: input.tier ?? null,
          choice: input.choice ?? null,
          amount_eth: input.amount_eth || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newTx) => {
      queryClient.setQueryData<PendingTransaction[]>(queryKey, (old) => {
        return [...(old || []), newTx];
      });
      devLog.log('[PendingTx] Created:', newTx.tx_type, newTx.id);
    },
    onError: (error) => {
      devLog.warn('[PendingTx] Error creating:', error);
    },
  });

  // Update a pending transaction (e.g., add tx_hash, change status)
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Pick<PendingTransaction, 'tx_hash' | 'status' | 'error_message'>> }) => {
      const { error } = await supabase
        .from('pending_transactions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return { id, updates };
    },
    onSuccess: ({ id, updates }) => {
      queryClient.setQueryData<PendingTransaction[]>(queryKey, (old) => {
        // If status changed to confirmed/failed/expired, remove from list
        // (query only fetches pending/submitted)
        if (updates.status && !['pending', 'submitted'].includes(updates.status)) {
          return (old || []).filter(tx => tx.id !== id);
        }
        return (old || []).map(tx =>
          tx.id === id ? { ...tx, ...updates } : tx
        );
      });
      devLog.log('[PendingTx] Updated:', id, updates);
    },
    onError: (error) => {
      devLog.warn('[PendingTx] Error updating:', error);
    },
  });

  // Delete/remove a pending transaction
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('pending_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<PendingTransaction[]>(queryKey, (old) => {
        return (old || []).filter(tx => tx.id !== id);
      });
      devLog.log('[PendingTx] Deleted:', id);
    },
  });

  // Add a pending transaction
  const addPendingTransaction = useCallback(async (input: CreatePendingTxInput) => {
    const opKey = `add-${input.tx_type}-${input.game_id || 'create'}`;
    if (pendingOpsRef.current.has(opKey)) return null;
    pendingOpsRef.current.add(opKey);

    try {
      const result = await createMutation.mutateAsync(input);
      return result;
    } finally {
      pendingOpsRef.current.delete(opKey);
    }
  }, [createMutation]);

  // Update tx hash when transaction is submitted
  const setTxHash = useCallback(async (id: number, txHash: string) => {
    await updateMutation.mutateAsync({
      id,
      updates: { tx_hash: txHash, status: 'submitted' },
    });
  }, [updateMutation]);

  // Mark transaction as confirmed
  const markConfirmed = useCallback(async (id: number) => {
    await updateMutation.mutateAsync({
      id,
      updates: { status: 'confirmed' },
    });
  }, [updateMutation]);

  // Mark transaction as failed
  const markFailed = useCallback(async (id: number, errorMessage?: string) => {
    await updateMutation.mutateAsync({
      id,
      updates: { status: 'failed', error_message: errorMessage || null },
    });
  }, [updateMutation]);

  // Remove a pending transaction
  const removePendingTransaction = useCallback(async (id: number) => {
    await deleteMutation.mutateAsync(id);
  }, [deleteMutation]);

  // Helper to find pending create transaction
  const getPendingCreate = useCallback((): PendingTransaction | undefined => {
    return pendingTransactions?.find(tx => tx.tx_type === 'create');
  }, [pendingTransactions]);

  // Helper to find pending cancel for a game (accepts string or number ID)
  const getPendingCancel = useCallback((gameId: string | number): PendingTransaction | undefined => {
    const numId = typeof gameId === 'string' ? Number(gameId) : gameId;
    return pendingTransactions?.find(tx => tx.tx_type === 'cancel' && tx.game_id === numId);
  }, [pendingTransactions]);

  // Helper to find pending join for a game (accepts string or number ID)
  const getPendingJoin = useCallback((gameId: string | number): PendingTransaction | undefined => {
    const numId = typeof gameId === 'string' ? Number(gameId) : gameId;
    return pendingTransactions?.find(tx => tx.tx_type === 'join' && tx.game_id === numId);
  }, [pendingTransactions]);

  // Check if there's a pending transaction of a specific type
  const hasPendingTransaction = useCallback((type: PendingTxType, gameId?: string | number): boolean => {
    if (!pendingTransactions) return false;
    const numId = gameId !== undefined ? (typeof gameId === 'string' ? Number(gameId) : gameId) : undefined;
    return pendingTransactions.some(tx => {
      if (tx.tx_type !== type) return false;
      if (numId !== undefined && tx.game_id !== numId) return false;
      return true;
    });
  }, [pendingTransactions]);

  // Check if a game is being cancelled (accepts string or number ID)
  const isGameCancelling = useCallback((gameId: string | number): boolean => {
    return hasPendingTransaction('cancel', gameId);
  }, [hasPendingTransaction]);

  // Check if a game is being joined (accepts string or number ID)
  const isGameJoining = useCallback((gameId: string | number): boolean => {
    return hasPendingTransaction('join', gameId);
  }, [hasPendingTransaction]);

  // Cleanup expired transactions on mount
  useEffect(() => {
    if (!address) return;

    const cleanupExpired = async () => {
      const { error } = await supabase.rpc('cleanup_expired_pending_transactions');
      if (error) {
        devLog.warn('[PendingTx] Cleanup error:', error.message);
      }
    };

    // Run cleanup once on mount
    cleanupExpired();
  }, [address]);

  return {
    // Data
    pendingTransactions: pendingTransactions || [],
    isLoading,
    refetch,

    // Create/update/delete
    addPendingTransaction,
    setTxHash,
    markConfirmed,
    markFailed,
    removePendingTransaction,

    // Getters
    getPendingCreate,
    getPendingCancel,
    getPendingJoin,
    hasPendingTransaction,
    isGameCancelling,
    isGameJoining,

    // Mutation state
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}

/**
 * Helper hook to sync pending transactions with game state
 * Auto-resolves pending transactions when games are created/updated
 */
export function usePendingTransactionSync() {
  const { pendingTransactions, markConfirmed, refetch } = usePendingTransactions();

  // This hook can be extended to watch for game state changes
  // and automatically resolve pending transactions

  return {
    pendingTransactions,
    markConfirmed,
    refetch,
  };
}
