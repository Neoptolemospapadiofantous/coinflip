import { useQuery } from '@tanstack/react-query';
import { useChainId } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { Tier } from '@/types/tier';
import { TESTNET_TIERS, PRODUCTION_TIERS } from '@/lib/mockData';
import { isTestnet } from '@/lib/networkUtils';

// Set to true to use mock data (before Supabase is set up)
// Set to false once you've populated the tiers table in Supabase
// The hook will gracefully fall back to mock data if Supabase query fails
const USE_MOCK_DATA = false;

export function useTiers() {
  const chainId = useChainId();

  // Auto-select appropriate tiers based on network
  const getMockTiers = (): Tier[] => {
    return isTestnet(chainId) ? TESTNET_TIERS : PRODUCTION_TIERS;
  };

  return useQuery({
    queryKey: ['tiers', chainId], // Include chainId in query key
    queryFn: async (): Promise<Tier[]> => {
      const mockTiers = getMockTiers();

      // ALWAYS use mock tiers for testnets to ensure correct amounts
      if (isTestnet(chainId)) {
        console.log('🧪 TESTNET DETECTED - Using testnet tier amounts (100x smaller)');
        console.log('📊 Testnet Tiers:', mockTiers.map(t => ({
          id: t.id,
          amountUsd: t.amountUsd,
          amountWei: t.amount,
          amountEth: (Number(BigInt(t.amount)) / 1e18).toFixed(8)
        })));
        return mockTiers;
      }

      // Use mock data if Supabase isn't set up yet
      if (USE_MOCK_DATA) {
        console.log('Using PRODUCTION tier data (Supabase not configured)');
        return mockTiers;
      }

      // Only fetch from Supabase on mainnet
      try {
        const { data, error } = await supabase
          .from('tiers')
          .select('*')
          .eq('enabled', true)
          .order('id');

        if (error) {
          console.warn('Error fetching tiers from Supabase, falling back to mock data:', error);
          return mockTiers;
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
          })) || mockTiers
        );
      } catch (err) {
        console.warn('Exception fetching tiers, falling back to mock data:', err);
        return mockTiers;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: isTestnet(chainId) ? false : (USE_MOCK_DATA ? false : 30 * 1000), // Don't refetch on testnet or mock mode
    refetchOnWindowFocus: !isTestnet(chainId) && !USE_MOCK_DATA,
  });
}

// Get a single tier by ID
export function useTier(tierId: number) {
  const chainId = useChainId();

  // Auto-select appropriate tiers based on network
  const getMockTiers = (): Tier[] => {
    return isTestnet(chainId) ? TESTNET_TIERS : PRODUCTION_TIERS;
  };

  return useQuery({
    queryKey: ['tier', tierId, chainId],
    queryFn: async (): Promise<Tier | null> => {
      const mockTiers = getMockTiers();

      // ALWAYS use mock tiers for testnets to ensure correct amounts
      if (isTestnet(chainId)) {
        return mockTiers.find((t) => t.id === tierId) || null;
      }

      // Use mock data if Supabase isn't set up yet
      if (USE_MOCK_DATA) {
        return mockTiers.find((t) => t.id === tierId) || null;
      }

      // Only fetch from Supabase on mainnet
      try {
        const { data, error } = await supabase
          .from('tiers')
          .select('*')
          .eq('id', tierId)
          .single();

        if (error) {
          console.warn('Error fetching tier, falling back to mock data:', error);
          return mockTiers.find((t) => t.id === tierId) || null;
        }

        if (!data) return mockTiers.find((t) => t.id === tierId) || null;

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
        return mockTiers.find((t) => t.id === tierId) || null;
      }
    },
    enabled: tierId !== null && tierId !== undefined,
    staleTime: 5 * 60 * 1000,
  });
}
