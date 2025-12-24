import { ethers } from "hardhat";

async function main() {
  console.log("Deploying CoinFlip contract...");

  // Get network information
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  // VRF Configuration based on network
  let VRF_COORDINATOR: string;
  let VRF_KEY_HASH: string;
  let networkName: string;

  if (chainId === 11155111) {
    // Ethereum Sepolia testnet
    VRF_COORDINATOR = "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B";
    VRF_KEY_HASH = "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae";
    networkName = "Ethereum Sepolia";
  } else if (chainId === 80002) {
    // Polygon Amoy testnet
    VRF_COORDINATOR = "0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2";
    VRF_KEY_HASH = "0x3f631d5ec60a0ce16203bcd4badc1676330eba9ebee3e150977eba41db53a5ae";
    networkName = "Polygon Amoy";
  } else if (chainId === 80001) {
    // Mumbai testnet (deprecated)
    console.warn("\n⚠️  WARNING: Mumbai testnet was shut down in April 2024!");
    console.warn("Please use Polygon Amoy testnet instead (chain ID: 80002)\n");
    VRF_COORDINATOR = "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed";
    VRF_KEY_HASH = "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f";
    networkName = "Mumbai (DEPRECATED)";
  } else if (chainId === 137) {
    // Polygon mainnet
    VRF_COORDINATOR = "0xec0Ed46f36576541C75739E915ADbCb3DE24bD77";
    VRF_KEY_HASH = "0x3f631d5ec60a0ce16203bcd4badc1676330eba9ebee3e150977eba41db53a5ae";
    networkName = "Polygon Mainnet";
  } else {
    console.error(`\n❌ Error: Unsupported network (Chain ID: ${chainId})`);
    console.log("\nSupported networks:");
    console.log("- Ethereum Sepolia testnet (11155111)");
    console.log("- Polygon Amoy testnet (80002)");
    console.log("- Polygon mainnet (137)");
    process.exit(1);
  }

  const VRF_SUBSCRIPTION_ID = process.env.VRF_SUBSCRIPTION_ID || "0";

  if (VRF_SUBSCRIPTION_ID === "0") {
    console.error("\n❌ Error: VRF_SUBSCRIPTION_ID not set in .env.local");
    console.log("\nPlease:");
    console.log("1. Visit https://vrf.chain.link/");
    console.log(`2. Connect wallet on ${networkName} network`);
    console.log("3. Create a subscription and fund with LINK");
    console.log("4. Add VRF_SUBSCRIPTION_ID to .env.local\n");
    process.exit(1);
  }

  console.log("\nDeployment Configuration:");
  console.log("========================");
  console.log("Network:", networkName);
  console.log("Chain ID:", chainId);
  console.log("VRF Subscription ID:", VRF_SUBSCRIPTION_ID);
  console.log("VRF Coordinator:", VRF_COORDINATOR);
  console.log("VRF Key Hash:", VRF_KEY_HASH);

  // Deploy the contract
  // Get deployer address as fee recipient
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const CoinFlip = await ethers.getContractFactory("CoinFlip");
  const coinFlip = await CoinFlip.deploy(
    VRF_SUBSCRIPTION_ID,
    VRF_COORDINATOR,
    VRF_KEY_HASH,
    deployer.address // Fee recipient
  );

  await coinFlip.waitForDeployment();

  const address = await coinFlip.getAddress();

  console.log("\n✅ CoinFlip deployed to:", address);
  console.log("\nNext Steps:");
  console.log("===========");
  console.log("1. Add this contract as a consumer in your VRF subscription:");
  console.log("   https://vrf.chain.link/");
  console.log("\n2. Update .env.local:");
  if (chainId === 11155111) {
    console.log(`   NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_SEPOLIA=${address}`);
  } else if (chainId === 80002) {
    console.log(`   NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_AMOY=${address}`);
  } else if (chainId === 137) {
    console.log(`   NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_POLYGON=${address}`);
  } else {
    console.log(`   NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_MUMBAI=${address}`);
  }
  console.log("\n3. Initialize tiers:");
  const networkFlag = chainId === 11155111 ? 'sepolia' : chainId === 80002 ? 'amoy' : chainId === 137 ? 'polygon' : 'mumbai';
  console.log(`   TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/initialize-tiers.ts --network ${networkFlag}`);
  console.log("\n4. Verify contract on Etherscan/Polygonscan:");
  console.log(`   TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat verify --network ${networkFlag} ${address} ${VRF_SUBSCRIPTION_ID} ${VRF_COORDINATOR} ${VRF_KEY_HASH} ${deployer.address}`);
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
