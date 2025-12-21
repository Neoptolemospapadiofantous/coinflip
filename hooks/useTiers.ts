import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Tier } from '@/types/tier';
import { MOCK_TIERS } from '@/lib/mockData';

// Set to true to use mock data (before Supabase is set up)
const USE_MOCK_DATA = true;

export function useTiers() {
  return useQuery({
    queryKey: ['tiers'],
    queryFn: async (): Promise<Tier[]> => {
      // Use mock data if Supabase isn't set up yet
      if (USE_MOCK_DATA) {
        console.log('Using mock tier data (Supabase not configured)');
        return MOCK_TIERS;
      }

      try {
        const { data, error } = await supabase
          .from('tiers')
          .select('*')
          .eq('enabled', true)
          .order('id');

        if (error) {
          console.warn('Error fetching tiers from Supabase, falling back to mock data:', error);
          return MOCK_TIERS;
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
          })) || MOCK_TIERS
        );
      } catch (err) {
        console.warn('Exception fetching tiers, falling back to mock data:', err);
        return MOCK_TIERS;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: USE_MOCK_DATA ? false : 30 * 1000, // Only refetch if using real data
    refetchOnWindowFocus: !USE_MOCK_DATA,
  });
}

// Get a single tier by ID
export function useTier(tierId: number) {
  return useQuery({
    queryKey: ['tier', tierId],
    queryFn: async (): Promise<Tier | null> => {
      // Use mock data if Supabase isn't set up yet
      if (USE_MOCK_DATA) {
        return MOCK_TIERS.find((t) => t.id === tierId) || null;
      }

      try {
        const { data, error } = await supabase
          .from('tiers')
          .select('*')
          .eq('id', tierId)
          .single();

        if (error) {
          console.warn('Error fetching tier, falling back to mock data:', error);
          return MOCK_TIERS.find((t) => t.id === tierId) || null;
        }

        if (!data) return MOCK_TIERS.find((t) => t.id === tierId) || null;

        return {
          id: data.id,
          amount: data.amount,
          amountUsd: data.amount_usd,
          winAmount: data.win_amount,
          winAmountUsd: data.win_amount_usd,
          playersInQueue: data.players_in_queue || 0,
          enabled: data.enabled,
        };
      } catch (err) {
        console.warn('Exception fetching tier, falling back to mock data:', err);
        return MOCK_TIERS.find((t) => t.id === tierId) || null;
      }
    },
    enabled: tierId !== null && tierId !== undefined,
    staleTime: 5 * 60 * 1000,
  });
}
