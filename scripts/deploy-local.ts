import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying to LOCAL Hardhat Network...\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy VRF Coordinator Mock
  console.log("📝 Deploying VRF Coordinator Mock...");
  const VRFCoordinatorV2Mock = await ethers.getContractFactory("VRFCoordinatorV2Mock");
  const vrfCoordinator = await VRFCoordinatorV2Mock.deploy(
    ethers.parseEther("0.0001"), // base fee
    1e9 // gas price
  );
  await vrfCoordinator.waitForDeployment();
  const vrfAddress = await vrfCoordinator.getAddress();
  console.log("✅ VRF Mock deployed to:", vrfAddress);

  // Create VRF subscription
  console.log("\n📝 Creating VRF subscription...");
  const createSubTx = await vrfCoordinator.createSubscription();
  const createSubReceipt = await createSubTx.wait();

  // Get subscription ID from event
  const subscriptionId = createSubReceipt?.logs[0].topics[1];
  console.log("✅ Subscription ID:", subscriptionId);

  // Fund subscription with LINK
  console.log("\n📝 Funding VRF subscription...");
  await vrfCoordinator.fundSubscription(subscriptionId, ethers.parseEther("10"));
  console.log("✅ Subscription funded with 10 LINK");

  // Deploy CoinFlip
  console.log("\n📝 Deploying CoinFlip contract...");
  const keyHash = "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f";

  const CoinFlip = await ethers.getContractFactory("CoinFlip");
  const coinFlip = await CoinFlip.deploy(
    subscriptionId,
    vrfAddress,
    keyHash,
    deployer.address // fee recipient
  );
  await coinFlip.waitForDeployment();
  const coinFlipAddress = await coinFlip.getAddress();
  console.log("✅ CoinFlip deployed to:", coinFlipAddress);

  // Add CoinFlip as VRF consumer
  console.log("\n📝 Adding CoinFlip as VRF consumer...");
  await vrfCoordinator.addConsumer(subscriptionId, coinFlipAddress);
  console.log("✅ CoinFlip added as consumer");

  // Initialize tiers
  console.log("\n📝 Initializing game tiers...");
  await coinFlip.setTier(0, ethers.parseEther("0.001"), true); // $5
  await coinFlip.setTier(1, ethers.parseEther("0.002"), true); // $10
  await coinFlip.setTier(2, ethers.parseEther("0.005"), true); // $25
  await coinFlip.setTier(3, ethers.parseEther("0.010"), true); // $50
  await coinFlip.setTier(4, ethers.parseEther("0.020"), true); // $100
  console.log("✅ All tiers initialized");

  console.log("\n" + "=".repeat(80));
  console.log("🎉 LOCAL DEPLOYMENT COMPLETE!");
  console.log("=".repeat(80));
  console.log("\n📋 Contract Addresses:");
  console.log("   CoinFlip:", coinFlipAddress);
  console.log("   VRF Mock:", vrfAddress);
  console.log("\n📝 Next Steps:");
  console.log("   1. Update .env.local:");
  console.log(`      NEXT_PUBLIC_COINFLIP_CONTRACT_ADDRESS_LOCALHOST=${coinFlipAddress}`);
  console.log("\n   2. Import test account to MetaMask:");
  console.log("      Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  console.log("      Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  console.log("\n   3. Add Localhost network to MetaMask:");
  console.log("      - Network Name: Localhost 8545");
  console.log("      - RPC URL: http://127.0.0.1:8545");
  console.log("      - Chain ID: 31337");
  console.log("      - Currency: ETH");
  console.log("\n   4. Start playing at http://localhost:3000/play");
  console.log("\n💡 You have 10,000 ETH to test with!");
  console.log("=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
