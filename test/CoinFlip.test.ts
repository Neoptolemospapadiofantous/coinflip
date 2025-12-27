import { expect } from "chai";
import { ethers } from "hardhat";
import { CoinFlip, VRFCoordinatorV2Mock } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("CoinFlip - Automated Scale Testing", function () {
  let coinFlip: CoinFlip;
  let vrfCoordinator: VRFCoordinatorV2Mock;
  let accounts: HardhatEthersSigner[];
  let owner: HardhatEthersSigner;

  // Mock VRF configuration for local testing
  const VRF_SUBSCRIPTION_ID = 1n;
  const VRF_KEY_HASH = "0x0000000000000000000000000000000000000000000000000000000000000001";

  before(async function () {
    this.timeout(60000); // Increase timeout for deployment

    console.log("\n🚀 Setting up 20-account test environment...\n");

    // Get all 20 Hardhat accounts
    accounts = await ethers.getSigners();
    owner = accounts[0];

    console.log(`📋 Loaded ${accounts.length} test accounts`);
    console.log(`👑 Owner: ${owner.address}\n`);

    // Deploy VRF Mock
    console.log("📝 Deploying VRF Coordinator Mock...");
    const VRFCoordinatorV2Mock = await ethers.getContractFactory("VRFCoordinatorV2Mock");
    vrfCoordinator = await VRFCoordinatorV2Mock.deploy();
    await vrfCoordinator.waitForDeployment();
    const vrfAddress = await vrfCoordinator.getAddress();
    console.log(`✅ VRF Mock deployed to: ${vrfAddress}\n`);

    // Deploy CoinFlip contract
    console.log("📝 Deploying CoinFlip contract...");
    const CoinFlip = await ethers.getContractFactory("CoinFlip");
    coinFlip = await CoinFlip.deploy(
      VRF_SUBSCRIPTION_ID,
      vrfAddress,
      VRF_KEY_HASH,
      owner.address
    );
    await coinFlip.waitForDeployment();

    const address = await coinFlip.getAddress();
    console.log(`✅ CoinFlip deployed to: ${address}\n`);

    // Initialize tiers
    console.log("🎯 Initializing game tiers...");
    const tiers = [
      { id: 0, amount: ethers.parseEther("0.001") },
      { id: 1, amount: ethers.parseEther("0.002") },
      { id: 2, amount: ethers.parseEther("0.005") },
      { id: 3, amount: ethers.parseEther("0.010") },
      { id: 4, amount: ethers.parseEther("0.020") },
    ];

    for (const tier of tiers) {
      await coinFlip.setTier(tier.id, tier.amount, true);
    }
    console.log("✅ All tiers initialized\n");
  });

  it("Should handle 10 simultaneous games with 20 players", async function () {
    this.timeout(120000); // 2 minutes timeout

    console.log("🎮 Starting 10 simultaneous games...\n");

    const betAmount = ethers.parseEther("0.001");
    const games: { gameId: bigint; creator: HardhatEthersSigner; joiner: HardhatEthersSigner }[] = [];

    // Create 10 games with accounts 0-9
    console.log("👥 Phase 1: Creating games...");
    for (let i = 0; i < 10; i++) {
      const creator = accounts[i];
      const choice = i % 2 === 0; // Alternate between heads/tails

      const tx = await coinFlip.connect(creator).createGame(0, choice, { value: betAmount });
      await tx.wait();

      const gameId = BigInt(i);
      games.push({ gameId, creator, joiner: accounts[i + 10] });

      console.log(`  ✓ Game ${i} created by Account ${i} (${creator.address.slice(0, 6)}...)`);
    }

    // Join all games with accounts 10-19
    console.log("\n👥 Phase 2: Joining games...");
    for (let i = 0; i < 10; i++) {
      const { gameId, joiner } = games[i];
      // Note: Joiner's choice is automatically opposite of creator's

      const tx = await coinFlip.connect(joiner).joinGame(gameId, { value: betAmount });
      const receipt = await tx.wait();

      console.log(`  ✓ Game ${i} joined by Account ${i + 10} (${joiner.address.slice(0, 6)}...)`);

      // Get VRF request ID from events
      const joinedEvent = receipt?.logs.find(
        (log: any) => {
          try {
            const parsed = coinFlip.interface.parseLog(log);
            return parsed?.name === 'GameJoined';
          } catch {
            return false;
          }
        }
      );

      if (joinedEvent) {
        console.log(`    → VRF request initiated for Game ${i}`);
      }
    }

    // Simulate VRF responses for all games
    console.log("\n🎲 Phase 3: Simulating VRF randomness...");
    for (let i = 0; i < 10; i++) {
      const { gameId, creator, joiner } = games[i];

      // Get game info before resolution
      const gameBefore = await coinFlip.getGame(gameId);

      // Simulate random result (alternating wins for demo)
      const randomWord = i % 2 === 0 ? 0n : 1n; // 0 = heads, 1 = tails
      const coinResult = randomWord === 1n;

      // Get VRF request ID from game
      const requestId = gameBefore.vrfRequestId;

      // Fulfill randomness through VRF mock (simulating Chainlink callback)
      await vrfCoordinator.fulfillRandomWords(requestId, [randomWord]);

      // Get game info after resolution
      const gameAfter = await coinFlip.getGame(gameId);
      const winner = gameAfter.winner;
      const isCreatorWinner = winner.toLowerCase() === creator.address.toLowerCase();

      console.log(`  ✓ Game ${i} resolved: ${coinResult ? 'TAILS' : 'HEADS'}`);
      console.log(`    → Winner: Account ${isCreatorWinner ? i : i + 10} (${winner.slice(0, 6)}...)`);
    }

    // Verify all games are resolved
    console.log("\n✅ Phase 4: Verification...");
    let totalPaidOut = 0n;
    for (let i = 0; i < 10; i++) {
      const game = await coinFlip.getGame(BigInt(i));
      expect(game.state).to.equal(3); // GameState.RESOLVED

      const payout = await coinFlip.calculatePayout(0);
      totalPaidOut += payout;

      console.log(`  ✓ Game ${i}: RESOLVED`);
    }

    const expectedPayout = ethers.parseEther("0.0019"); // 0.002 - 5% fee
    console.log(`\n💰 Total paid out: ${ethers.formatEther(totalPaidOut)} ETH`);
    console.log(`📊 Per game payout: ${ethers.formatEther(expectedPayout)} ETH`);
    console.log(`💸 Platform fees collected: ${ethers.formatEther(await coinFlip.collectedFees())} ETH`);

    console.log("\n🎉 All 10 games completed successfully!");
  });

  it("Should display final statistics", async function () {
    console.log("\n📊 FINAL STATISTICS");
    console.log("==================\n");

    const tier0 = await coinFlip.getTier(0);
    console.log(`Total Games Played: ${tier0.totalGames}`);
    console.log(`Total Volume: ${ethers.formatEther(tier0.totalVolume)} ETH`);
    console.log(`Platform Fees: ${ethers.formatEther(await coinFlip.collectedFees())} ETH`);

    console.log("\n✅ Scale test completed successfully!\n");
  });
});
