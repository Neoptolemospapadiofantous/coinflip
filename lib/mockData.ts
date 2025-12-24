import { Tier } from '@/types/tier';
import { parseEther } from 'viem';

// TESTNET TIERS - Much smaller amounts for easy testing
// Perfect for Sepolia/Amoy where you have limited testnet ETH
export const TESTNET_TIERS: Tier[] = [
  {
    id: 0,
    amount: parseEther('0.00001').toString(), // 0.00001 ETH (10 Gwei equivalent)
    amountUsd: 0.05,
    winAmount: parseEther('0.000019').toString(), // 0.000019 ETH after 5% fee
    winAmountUsd: 0.095,
    playersInQueue: 0,
    enabled: true,
  },
  {
    id: 1,
    amount: parseEther('0.00005').toString(), // 0.00005 ETH (50 Gwei equivalent)
    amountUsd: 0.1,
    winAmount: parseEther('0.000095').toString(), // 0.000095 ETH after 5% fee
    winAmountUsd: 0.19,
    playersInQueue: 0,
    enabled: true,
  },
  {
    id: 2,
    amount: parseEther('0.0001').toString(), // 0.0001 ETH (100 Gwei equivalent)
    amountUsd: 0.25,
    winAmount: parseEther('0.00019').toString(), // 0.00019 ETH after 5% fee
    winAmountUsd: 0.475,
    playersInQueue: 0,
    enabled: true,
  },
  {
    id: 3,
    amount: parseEther('0.0005').toString(), // 0.0005 ETH (500 Gwei equivalent)
    amountUsd: 0.5,
    winAmount: parseEther('0.00095').toString(), // 0.00095 ETH after 5% fee
    winAmountUsd: 0.95,
    playersInQueue: 0,
    enabled: true,
  },
  {
    id: 4,
    amount: parseEther('0.001').toString(), // 0.001 ETH (1000 Gwei equivalent)
    amountUsd: 1,
    winAmount: parseEther('0.0019').toString(), // 0.0019 ETH after 5% fee
    winAmountUsd: 1.9,
    playersInQueue: 0,
    enabled: true,
  },
];

// PRODUCTION TIERS - Normal amounts for mainnet
// Higher values matching real USD equivalents
export const PRODUCTION_TIERS: Tier[] = [
  {
    id: 0,
    amount: parseEther('0.001').toString(), // 0.001 ETH (~$5 USD)
    amountUsd: 5,
    winAmount: parseEther('0.0019').toString(), // 0.0019 ETH after 5% fee
    winAmountUsd: 9.5,
    playersInQueue: 0,
    enabled: true,
  },
  {
    id: 1,
    amount: parseEther('0.002').toString(), // 0.002 ETH (~$10 USD)
    amountUsd: 10,
    winAmount: parseEther('0.0038').toString(), // 0.0038 ETH after 5% fee
    winAmountUsd: 19,
    playersInQueue: 0,
    enabled: true,
  },
  {
    id: 2,
    amount: parseEther('0.005').toString(), // 0.005 ETH (~$25 USD)
    amountUsd: 25,
    winAmount: parseEther('0.0095').toString(), // 0.0095 ETH after 5% fee
    winAmountUsd: 47.5,
    playersInQueue: 0,
    enabled: true,
  },
  {
    id: 3,
    amount: parseEther('0.010').toString(), // 0.010 ETH (~$50 USD)
    amountUsd: 50,
    winAmount: parseEther('0.019').toString(), // 0.019 ETH after 5% fee
    winAmountUsd: 95,
    playersInQueue: 0,
    enabled: true,
  },
  {
    id: 4,
    amount: parseEther('0.020').toString(), // 0.020 ETH (~$100 USD)
    amountUsd: 100,
    winAmount: parseEther('0.038').toString(), // 0.038 ETH after 5% fee
    winAmountUsd: 190,
    playersInQueue: 0,
    enabled: true,
  },
];

// Auto-select tiers based on environment or default to testnet for safety
export const MOCK_TIERS = TESTNET_TIERS;
