import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Tier } from '@/types/tier';

export function useTiers() {
  return useQuery({
    queryKey: ['tiers'],
    queryFn: async (): Promise<Tier[]> => {
      const { data, error } = await supabase
        .from('tiers')
        .select('*')
        .eq('enabled', true)
        .order('id');

      if (error) {
        console.error('Error fetching tiers:', error);
        throw error;
      }

      // Transform database rows to Tier type
      return (
        data?.map((row) => ({
          id: row.id,
          amount: row.amount,
          amountUsd: row.amount_usd,
          winAmount: row.win_amount,
          winAmountUsd: row.win_amount_usd,
          playersInQueue: row.players_in_queue || 0,
          enabled: row.enabled,
        })) || []
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
  });
}

// Get a single tier by ID
export function useTier(tierId: number) {
  return useQuery({
    queryKey: ['tier', tierId],
    queryFn: async (): Promise<Tier | null> => {
      const { data, error } = await supabase
        .from('tiers')
        .select('*')
        .eq('id', tierId)
        .single();

      if (error) {
        console.error('Error fetching tier:', error);
        return null;
      }

      if (!data) return null;

      return {
        id: data.id,
        amount: data.amount,
        amountUsd: data.amount_usd,
        winAmount: data.win_amount,
        winAmountUsd: data.win_amount_usd,
        playersInQueue: data.players_in_queue || 0,
        enabled: data.enabled,
      };
    },
    enabled: tierId !== null && tierId !== undefined,
    staleTime: 5 * 60 * 1000,
  });
}
