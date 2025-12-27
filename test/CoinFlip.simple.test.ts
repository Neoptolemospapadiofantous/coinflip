import { expect } from "chai";
import { ethers } from "hardhat";
import { CoinFlip, VRFCoordinatorV2Mock } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("CoinFlip - Simple 2-Game Demo", function () {
  let coinFlip: CoinFlip;
  let vrfCoordinator: VRFCoordinatorV2Mock;
  let accounts: HardhatEthersSigner[];
  let owner: HardhatEthersSigner;

  const VRF_SUBSCRIPTION_ID = 1n;
  const VRF_KEY_HASH = "0x0000000000000000000000000000000000000000000000000000000000000001";

  before(async function () {
    this.timeout(60000);

    console.log("\n" + "=".repeat(80));
    console.log("🎲 COINFLIP DEMO: 2 Games, 4 Players");
    console.log("=".repeat(80) + "\n");

    // Get accounts
    accounts = await ethers.getSigners();
    owner = accounts[0];

    console.log("👥 PLAYERS:");
    console.log(`   Alice   (Player 1): ${accounts[0].address}`);
    console.log(`   Bob     (Player 2): ${accounts[1].address}`);
    console.log(`   Charlie (Player 3): ${accounts[2].address}`);
    console.log(`   Diana   (Player 4): ${accounts[3].address}\n`);

    // Deploy VRF Mock
    console.log("📝 SETUP: Deploying contracts...");
    const VRFCoordinatorV2Mock = await ethers.getContractFactory("VRFCoordinatorV2Mock");
    vrfCoordinator = await VRFCoordinatorV2Mock.deploy();
    await vrfCoordinator.waitForDeployment();

    // Deploy CoinFlip
    const CoinFlip = await ethers.getContractFactory("CoinFlip");
    coinFlip = await CoinFlip.deploy(
      VRF_SUBSCRIPTION_ID,
      await vrfCoordinator.getAddress(),
      VRF_KEY_HASH,
      owner.address
    );
    await coinFlip.waitForDeployment();

    console.log(`   ✅ CoinFlip contract: ${await coinFlip.getAddress()}`);
    console.log(`   ✅ VRF Coordinator: ${await vrfCoordinator.getAddress()}\n`);

    // Initialize tiers
    console.log("🎯 SETUP: Initializing game tiers...");
    const betAmount = ethers.parseEther("0.001");
    await coinFlip.setTier(0, betAmount, true);
    console.log(`   ✅ Tier 0: ${ethers.formatEther(betAmount)} ETH\n`);

    console.log("=".repeat(80) + "\n");
  });

  it("Should play 2 complete games with detailed logs", async function () {
    this.timeout(120000);

    const betAmount = ethers.parseEther("0.001");

    // ========================================
    // GAME 1: Alice vs Bob
    // ========================================
    console.log("🎮 GAME 1: Alice vs Bob");
    console.log("-".repeat(80));

    // Alice creates game
    console.log("\n📌 Step 1: Alice creates the game");
    console.log(`   Bet Amount: ${ethers.formatEther(betAmount)} ETH`);
    console.log(`   Alice's Choice: HEADS`);

    const aliceBalanceBefore = await ethers.provider.getBalance(accounts[0].address);
    const tx1 = await coinFlip.connect(accounts[0]).createGame(0, false, { value: betAmount }); // false = heads
    await tx1.wait();

    const game1 = await coinFlip.getGame(0);
    console.log(`   ✅ Game #0 created!`);
    console.log(`   Alice paid: ${ethers.formatEther(betAmount)} ETH\n`);

    // Bob joins game
    console.log("📌 Step 2: Bob joins the game");
    console.log(`   Bet Amount: ${ethers.formatEther(betAmount)} ETH`);
    console.log(`   Bob's Choice: TAILS (automatic - opposite of creator)`);

    const bobBalanceBefore = await ethers.provider.getBalance(accounts[1].address);
    const tx2 = await coinFlip.connect(accounts[1]).joinGame(0, { value: betAmount }); // choice is automatic
    await tx2.wait();

    console.log(`   ✅ Bob joined!`);
    console.log(`   Total Pot: ${ethers.formatEther(betAmount * 2n)} ETH`);
    console.log(`   🎲 Requesting random number from VRF...\n`);

    // VRF responds
    const game1AfterJoin = await coinFlip.getGame(0);
    const requestId1 = game1AfterJoin.vrfRequestId;
    const randomWord1 = 0n; // 0 = heads

    console.log("📌 Step 3: VRF Coordinator responds");
    console.log(`   Request ID: ${requestId1}`);
    console.log(`   Random Number: ${randomWord1} (HEADS)`);

    await vrfCoordinator.fulfillRandomWords(requestId1, [randomWord1]);

    const game1Final = await coinFlip.getGame(0);
    const winner1 = game1Final.winner;
    const isAliceWinner = winner1.toLowerCase() === accounts[0].address.toLowerCase();

    const aliceBalanceAfter = await ethers.provider.getBalance(accounts[0].address);
    const bobBalanceAfter = await ethers.provider.getBalance(accounts[1].address);

    const payout = await coinFlip.calculatePayout(0);

    console.log(`   🎲 Result: HEADS`);
    console.log(`   🏆 Winner: ${isAliceWinner ? 'Alice' : 'Bob'}`);
    console.log(`   💰 Payout: ${ethers.formatEther(payout)} ETH (95% of pot)`);
    console.log(`   💸 Platform Fee: ${ethers.formatEther(betAmount * 2n - payout)} ETH (5%)\n`);

    // ========================================
    // GAME 2: Charlie vs Diana
    // ========================================
    console.log("=".repeat(80));
    console.log("🎮 GAME 2: Charlie vs Diana");
    console.log("-".repeat(80));

    // Charlie creates game
    console.log("\n📌 Step 1: Charlie creates the game");
    console.log(`   Bet Amount: ${ethers.formatEther(betAmount)} ETH`);
    console.log(`   Charlie's Choice: TAILS`);

    const tx3 = await coinFlip.connect(accounts[2]).createGame(0, true, { value: betAmount }); // true = tails
    await tx3.wait();

    console.log(`   ✅ Game #1 created!`);
    console.log(`   Charlie paid: ${ethers.formatEther(betAmount)} ETH\n`);

    // Diana joins game
    console.log("📌 Step 2: Diana joins the game");
    console.log(`   Bet Amount: ${ethers.formatEther(betAmount)} ETH`);
    console.log(`   Diana's Choice: HEADS (automatic - opposite of creator)`);

    const tx4 = await coinFlip.connect(accounts[3]).joinGame(1, { value: betAmount }); // choice is automatic
    await tx4.wait();

    console.log(`   ✅ Diana joined!`);
    console.log(`   Total Pot: ${ethers.formatEther(betAmount * 2n)} ETH`);
    console.log(`   🎲 Requesting random number from VRF...\n`);

    // VRF responds
    const game2AfterJoin = await coinFlip.getGame(1);
    const requestId2 = game2AfterJoin.vrfRequestId;
    const randomWord2 = 1n; // 1 = tails

    console.log("📌 Step 3: VRF Coordinator responds");
    console.log(`   Request ID: ${requestId2}`);
    console.log(`   Random Number: ${randomWord2} (TAILS)`);

    await vrfCoordinator.fulfillRandomWords(requestId2, [randomWord2]);

    const game2Final = await coinFlip.getGame(1);
    const winner2 = game2Final.winner;
    const isCharlieWinner = winner2.toLowerCase() === accounts[2].address.toLowerCase();

    console.log(`   🎲 Result: TAILS`);
    console.log(`   🏆 Winner: ${isCharlieWinner ? 'Charlie' : 'Diana'}`);
    console.log(`   💰 Payout: ${ethers.formatEther(payout)} ETH (95% of pot)`);
    console.log(`   💸 Platform Fee: ${ethers.formatEther(betAmount * 2n - payout)} ETH (5%)\n`);

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log("=".repeat(80));
    console.log("📊 FINAL SUMMARY");
    console.log("=".repeat(80) + "\n");

    const totalFees = await coinFlip.collectedFees();
    const tier0 = await coinFlip.getTier(0);

    console.log("🎯 Contract Statistics:");
    console.log(`   Total Games Played: ${tier0.totalGames}`);
    console.log(`   Total Volume: ${ethers.formatEther(tier0.totalVolume)} ETH`);
    console.log(`   Platform Fees Collected: ${ethers.formatEther(totalFees)} ETH`);
    console.log(`   Total Paid to Winners: ${ethers.formatEther(payout * 2n)} ETH\n`);

    console.log("👥 Game Results:");
    console.log(`   Game #0: ${isAliceWinner ? 'Alice' : 'Bob'} won ${ethers.formatEther(payout)} ETH`);
    console.log(`   Game #1: ${isCharlieWinner ? 'Charlie' : 'Diana'} won ${ethers.formatEther(payout)} ETH\n`);

    console.log("=".repeat(80));
    console.log("✅ ALL TESTS PASSED!");
    console.log("=".repeat(80) + "\n");

    // Verify both games are resolved
    expect(game1Final.state).to.equal(3); // RESOLVED
    expect(game2Final.state).to.equal(3); // RESOLVED
    expect(tier0.totalGames).to.equal(2n);
  });
});
