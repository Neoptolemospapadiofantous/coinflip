/**
 * Smart Contract Tests for CoinFlip.sol
 *
 * These tests run with Hardhat. Execute with:
 *   npx hardhat test tests/contracts/CoinFlip.test.ts
 *
 * Note: This file uses Hardhat's testing framework, not Vitest
 */

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { CoinFlip, VRFCoordinatorV2Mock } from '../../typechain-types';

describe('CoinFlip Contract', function () {
  let coinFlip: CoinFlip;
  let vrfCoordinator: VRFCoordinatorV2Mock;
  let owner: SignerWithAddress;
  let player1: SignerWithAddress;
  let player2: SignerWithAddress;

  const TIER_WAGER = ethers.parseEther('0.01');
  const FEE_PERCENTAGE = 500; // 5%

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();

    // Deploy VRF Mock
    const VRFMock = await ethers.getContractFactory('VRFCoordinatorV2Mock');
    vrfCoordinator = await VRFMock.deploy(0, 0);

    // Create VRF subscription
    await vrfCoordinator.createSubscription();
    const subscriptionId = 1;

    // Deploy CoinFlip
    const CoinFlip = await ethers.getContractFactory('CoinFlip');
    coinFlip = await CoinFlip.deploy(
      subscriptionId,
      await vrfCoordinator.getAddress(),
      ethers.encodeBytes32String('keyHash'),
      owner.address
    );

    // Fund subscription and add consumer
    await vrfCoordinator.fundSubscription(subscriptionId, ethers.parseEther('10'));
    await vrfCoordinator.addConsumer(subscriptionId, await coinFlip.getAddress());

    // Add a tier
    await coinFlip.addTier(TIER_WAGER, FEE_PERCENTAGE);
  });

  describe('Deployment', function () {
    it('should set the right owner', async function () {
      expect(await coinFlip.owner()).to.equal(owner.address);
    });

    it('should start with game counter at 0', async function () {
      expect(await coinFlip.gameCounter()).to.equal(0);
    });

    it('should have the tier configured', async function () {
      const tier = await coinFlip.tiers(0);
      expect(tier.wager).to.equal(TIER_WAGER);
      expect(tier.feePercentage).to.equal(FEE_PERCENTAGE);
      expect(tier.isActive).to.equal(true);
    });
  });

  describe('Game Creation', function () {
    it('should create a game with correct wager', async function () {
      const tx = await coinFlip.connect(player1).createGame(0, false, {
        value: TIER_WAGER,
      });

      await expect(tx).to.emit(coinFlip, 'GameCreated');

      const game = await coinFlip.getGame(1);
      expect(game.playerA).to.equal(player1.address);
      expect(game.wager).to.equal(TIER_WAGER);
      expect(game.state).to.equal(0); // Pending
    });

    it('should reject game with wrong wager', async function () {
      await expect(
        coinFlip.connect(player1).createGame(0, false, {
          value: ethers.parseEther('0.02'), // Wrong amount
        })
      ).to.be.revertedWith('Incorrect wager amount');
    });

    it('should increment game counter', async function () {
      await coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER });
      expect(await coinFlip.gameCounter()).to.equal(1);

      await coinFlip.connect(player1).createGame(0, true, { value: TIER_WAGER });
      expect(await coinFlip.gameCounter()).to.equal(2);
    });

    it('should reject inactive tier', async function () {
      await coinFlip.setTierActive(0, false);

      await expect(
        coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER })
      ).to.be.revertedWith('Tier not active');
    });
  });

  describe('Game Joining', function () {
    beforeEach(async function () {
      await coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER });
    });

    it('should allow another player to join', async function () {
      const tx = await coinFlip.connect(player2).joinGame(1, true, {
        value: TIER_WAGER,
      });

      await expect(tx).to.emit(coinFlip, 'GameJoined');

      const game = await coinFlip.getGame(1);
      expect(game.playerB).to.equal(player2.address);
      expect(game.state).to.equal(1); // Matched
    });

    it('should reject creator joining own game', async function () {
      await expect(
        coinFlip.connect(player1).joinGame(1, true, { value: TIER_WAGER })
      ).to.be.revertedWith('Cannot join own game');
    });

    it('should reject joining with wrong wager', async function () {
      await expect(
        coinFlip.connect(player2).joinGame(1, true, {
          value: ethers.parseEther('0.02'),
        })
      ).to.be.revertedWith('Incorrect wager amount');
    });

    it('should reject joining non-pending game', async function () {
      await coinFlip.connect(player2).joinGame(1, true, { value: TIER_WAGER });

      await expect(
        coinFlip.connect(owner).joinGame(1, false, { value: TIER_WAGER })
      ).to.be.revertedWith('Game not pending');
    });
  });

  describe('Game Cancellation', function () {
    beforeEach(async function () {
      await coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER });
    });

    it('should allow creator to cancel pending game', async function () {
      const balanceBefore = await ethers.provider.getBalance(player1.address);

      const tx = await coinFlip.connect(player1).cancelGame(1);
      await expect(tx).to.emit(coinFlip, 'GameCancelled');

      const balanceAfter = await ethers.provider.getBalance(player1.address);
      // Should get refund (minus gas)
      expect(balanceAfter).to.be.gt(balanceBefore - ethers.parseEther('0.001'));

      const game = await coinFlip.getGame(1);
      expect(game.state).to.equal(3); // Cancelled
    });

    it('should reject non-creator cancellation', async function () {
      await expect(coinFlip.connect(player2).cancelGame(1)).to.be.revertedWith(
        'Not game creator'
      );
    });

    it('should reject cancelling matched game', async function () {
      await coinFlip.connect(player2).joinGame(1, true, { value: TIER_WAGER });

      await expect(coinFlip.connect(player1).cancelGame(1)).to.be.revertedWith(
        'Game not pending'
      );
    });
  });

  describe('VRF Fulfillment', function () {
    beforeEach(async function () {
      await coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER });
      await coinFlip.connect(player2).joinGame(1, true, { value: TIER_WAGER });
    });

    it('should resolve game when VRF responds', async function () {
      const game = await coinFlip.getGame(1);
      const requestId = game.vrfRequestId;

      // Simulate VRF response (random number determines winner)
      // 0 = heads = player1 wins (player1 chose false = heads)
      await vrfCoordinator.fulfillRandomWords(requestId, await coinFlip.getAddress());

      const resolvedGame = await coinFlip.getGame(1);
      expect(resolvedGame.state).to.equal(2); // Resolved
      expect(resolvedGame.winner).to.not.equal(ethers.ZeroAddress);
    });

    it('should pay winner correctly', async function () {
      const game = await coinFlip.getGame(1);
      const requestId = game.vrfRequestId;

      const player1BalanceBefore = await ethers.provider.getBalance(player1.address);
      const player2BalanceBefore = await ethers.provider.getBalance(player2.address);

      await vrfCoordinator.fulfillRandomWords(requestId, await coinFlip.getAddress());

      const player1BalanceAfter = await ethers.provider.getBalance(player1.address);
      const player2BalanceAfter = await ethers.provider.getBalance(player2.address);

      // One player should have gained, one should stay same
      const player1Gained = player1BalanceAfter > player1BalanceBefore;
      const player2Gained = player2BalanceAfter > player2BalanceBefore;

      expect(player1Gained || player2Gained).to.be.true;
    });
  });

  describe('Fee Collection', function () {
    it('should collect fees in contract', async function () {
      await coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER });
      await coinFlip.connect(player2).joinGame(1, true, { value: TIER_WAGER });

      const game = await coinFlip.getGame(1);
      await vrfCoordinator.fulfillRandomWords(game.vrfRequestId, await coinFlip.getAddress());

      // Contract should have collected fee
      const fee = await coinFlip.collectedFees();
      expect(fee).to.be.gt(0);
    });

    it('should allow owner to withdraw fees', async function () {
      await coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER });
      await coinFlip.connect(player2).joinGame(1, true, { value: TIER_WAGER });

      const game = await coinFlip.getGame(1);
      await vrfCoordinator.fulfillRandomWords(game.vrfRequestId, await coinFlip.getAddress());

      const feesBefore = await coinFlip.collectedFees();
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

      await coinFlip.connect(owner).withdrawFees();

      const feesAfter = await coinFlip.collectedFees();
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      expect(feesAfter).to.equal(0);
      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
    });

    it('should reject non-owner fee withdrawal', async function () {
      await expect(coinFlip.connect(player1).withdrawFees()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('Pausable', function () {
    it('should allow owner to pause', async function () {
      await coinFlip.connect(owner).pause();
      expect(await coinFlip.paused()).to.be.true;
    });

    it('should reject game creation when paused', async function () {
      await coinFlip.connect(owner).pause();

      await expect(
        coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER })
      ).to.be.revertedWith('Pausable: paused');
    });

    it('should allow unpause', async function () {
      await coinFlip.connect(owner).pause();
      await coinFlip.connect(owner).unpause();

      await expect(
        coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER })
      ).to.not.be.reverted;
    });
  });
});
