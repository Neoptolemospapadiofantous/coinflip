import { createPublicClient, http, formatGwei } from 'viem';
import { sepolia } from 'viem/chains';

async function main() {
  const c = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL) });
  const [gas, fee] = await Promise.all([c.getGasPrice(), c.estimateFeesPerGas()]);
  console.log('gasPrice:      ', formatGwei(gas), 'gwei');
  console.log('maxFeePerGas:  ', formatGwei(fee.maxFeePerGas ?? 0n), 'gwei');
  console.log('maxPriorityFee:', formatGwei(fee.maxPriorityFeePerGas ?? 0n), 'gwei');
  console.log('\nKey hash limit: 100 gwei');
  console.log('VRF will fulfil:', Number(formatGwei(gas)) <= 100 ? '✅ YES (gas is under limit)' : '❌ NO  (gas is OVER 100 gwei limit — VRF blocked)');
}
main().catch(console.error);
