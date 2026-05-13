import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const CONTRACT = '0x7cF8ae6Ce63aC845862beF4Ff2aEb3E774dC84CC' as const;
const NEW_GAS_LIMIT = 400_000; // 400k — well above the ~250k fulfillRandomWords uses

const ABI = parseAbi([
  'function vrfCallbackGasLimit() view returns (uint32)',
  'function setVrfCallbackGasLimit(uint32 newLimit) external',
]);

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const rpc = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';

const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpc) });

async function main() {
  const current = await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: 'vrfCallbackGasLimit' });
  console.log(`Current callbackGasLimit: ${current}`);

  if (current >= NEW_GAS_LIMIT) {
    console.log('Already at or above target — no change needed.');
    return;
  }

  console.log(`Raising to ${NEW_GAS_LIMIT}...`);
  const hash = await walletClient.writeContract({ address: CONTRACT, abi: ABI, functionName: 'setVrfCallbackGasLimit', args: [NEW_GAS_LIMIT] });
  console.log(`Tx sent: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber} — new gas limit: ${NEW_GAS_LIMIT}`);
}

main().catch(console.error);
