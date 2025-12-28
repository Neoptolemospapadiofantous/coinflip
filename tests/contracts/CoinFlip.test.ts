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

  // GameState enum values from contract
  const GameState = {
    NONE: 0,
    OPEN: 1,
    LOCKED: 2,
    RESOLVED: 3,
    CANCELLED: 4,
  };

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();

    // Deploy VRF Mock (no constructor args)
    const VRFMock = await ethers.getContractFactory('VRFCoordinatorV2Mock');
    vrfCoordinator = await VRFMock.deploy();

    // Deploy CoinFlip
    const CoinFlip = await ethers.getContractFactory('CoinFlip');
    coinFlip = await CoinFlip.deploy(
      1, // subscriptionId
      await vrfCoordinator.getAddress(),
      ethers.encodeBytes32String('keyHash'),
      owner.address // feeRecipient
    );

    // Add a tier using setTier(tierId, amount, enabled)
    await coinFlip.setTier(0, TIER_WAGER, true);
  });

  describe('Deployment', function () {
    it('should set the right owner', async function () {
      expect(await coinFlip.owner()).to.equal(owner.address);
    });

    it('should start with nextGameId at 0', async function () {
      expect(await coinFlip.nextGameId()).to.equal(0);
    });

    it('should have the tier configured', async function () {
      const tier = await coinFlip.tiers(0);
      expect(tier.amount).to.equal(TIER_WAGER);
      expect(tier.enabled).to.equal(true);
    });
  });

  describe('Game Creation', function () {
    it('should create a game with correct tier', async function () {
      const tx = await coinFlip.connect(player1).createGame(0, false, {
        value: TIER_WAGER,
      });

      await expect(tx).to.emit(coinFlip, 'GameCreated');

      const game = await coinFlip.getGame(0); // 0-indexed
      expect(game.playerA).to.equal(player1.address);
      expect(game.tier).to.equal(0);
      expect(game.state).to.equal(GameState.OPEN);
    });

    it('should reject game with wrong wager', async function () {
      await expect(
        coinFlip.connect(player1).createGame(0, false, {
          value: ethers.parseEther('0.02'), // Wrong amount
        })
      ).to.be.revertedWithCustomError(coinFlip, 'IncorrectBetAmount');
    });

    it('should increment nextGameId', async function () {
      await coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER });
      expect(await coinFlip.nextGameId()).to.equal(1);

      await coinFlip.connect(player1).createGame(0, true, { value: TIER_WAGER });
      expect(await coinFlip.nextGameId()).to.equal(2);
    });

    it('should reject disabled tier', async function () {
      // Disable tier by setting enabled=false
      await coinFlip.setTier(0, TIER_WAGER, false);

      await expect(
        coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER })
      ).to.be.revertedWithCustomError(coinFlip, 'TierDisabled');
    });
  });

  describe('Game Joining', function () {
    beforeEach(async function () {
      await coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER });
    });

    it('should allow another player to join', async function () {
      const tx = await coinFlip.connect(player2).joinGame(0, {
        value: TIER_WAGER,
      });

      await expect(tx).to.emit(coinFlip, 'GameJoined');

      const game = await coinFlip.getGame(0);
      expect(game.playerB).to.equal(player2.address);
      expect(game.state).to.equal(GameState.LOCKED);
    });

    it('should reject creator joining own game', async function () {
      await expect(
        coinFlip.connect(player1).joinGame(0, { value: TIER_WAGER })
      ).to.be.revertedWithCustomError(coinFlip, 'CannotJoinOwnGame');
    });

    it('should reject joining with wrong wager', async function () {
      await expect(
        coinFlip.connect(player2).joinGame(0, {
          value: ethers.parseEther('0.02'),
        })
      ).to.be.revertedWithCustomError(coinFlip, 'IncorrectBetAmount');
    });

    it('should reject joining non-open game', async function () {
      await coinFlip.connect(player2).joinGame(0, { value: TIER_WAGER });

      await expect(
        coinFlip.connect(owner).joinGame(0, { value: TIER_WAGER })
      ).to.be.revertedWithCustomError(coinFlip, 'InvalidGameState');
    });
  });

  describe('Game Cancellation', function () {
    beforeEach(async function () {
      await coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER });
    });

    it('should allow creator to cancel open game', async function () {
      const balanceBefore = await ethers.provider.getBalance(player1.address);

      const tx = await coinFlip.connect(player1).cancelGame(0);
      await expect(tx).to.emit(coinFlip, 'GameCancelled');

      const balanceAfter = await ethers.provider.getBalance(player1.address);
      // Should get refund (minus gas)
      expect(balanceAfter).to.be.gt(balanceBefore - ethers.parseEther('0.001'));

      const game = await coinFlip.getGame(0);
      expect(game.state).to.equal(GameState.CANCELLED);
    });

    it('should reject non-creator cancellation before timeout', async function () {
      // Non-creator can only cancel after timeout
      await expect(
        coinFlip.connect(player2).cancelGame(0)
      ).to.be.revertedWithCustomError(coinFlip, 'TimeoutNotReached');
    });

    it('should reject cancelling locked game', async function () {
      await coinFlip.connect(player2).joinGame(0, { value: TIER_WAGER });

      await expect(
        coinFlip.connect(player1).cancelGame(0)
      ).to.be.revertedWithCustomError(coinFlip, 'InvalidGameState');
    });
  });

  describe('VRF Fulfillment', function () {
    beforeEach(async function () {
      await coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER });
      await coinFlip.connect(player2).joinGame(0, { value: TIER_WAGER });
    });

    it('should resolve game when VRF responds', async function () {
      const game = await coinFlip.getGame(0);
      const requestId = game.vrfRequestId;

      // Simulate VRF response
      await vrfCoordinator.fulfillRandomWords(requestId, [123456n]);

      const resolvedGame = await coinFlip.getGame(0);
      expect(resolvedGame.state).to.equal(GameState.RESOLVED);
      expect(resolvedGame.winner).to.not.equal(ethers.ZeroAddress);
    });

    it('should pay winner correctly', async function () {
      const game = await coinFlip.getGame(0);
      const requestId = game.vrfRequestId;

      const player1BalanceBefore = await ethers.provider.getBalance(player1.address);
      const player2BalanceBefore = await ethers.provider.getBalance(player2.address);

      await vrfCoordinator.fulfillRandomWords(requestId, [123456n]);

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
      await coinFlip.connect(player2).joinGame(0, { value: TIER_WAGER });

      const game = await coinFlip.getGame(0);
      await vrfCoordinator.fulfillRandomWords(game.vrfRequestId, [123456n]);

      // Contract should have collected fee
      const fee = await coinFlip.collectedFees();
      expect(fee).to.be.gt(0);
    });

    it('should allow owner to withdraw fees', async function () {
      await coinFlip.connect(player1).createGame(0, false, { value: TIER_WAGER });
      await coinFlip.connect(player2).joinGame(0, { value: TIER_WAGER });

      const game = await coinFlip.getGame(0);
      await vrfCoordinator.fulfillRandomWords(game.vrfRequestId, [123456n]);

      const feesBefore = await coinFlip.collectedFees();
      expect(feesBefore).to.be.gt(0);

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      await coinFlip.connect(owner).withdrawFees();

      const feesAfter = await coinFlip.collectedFees();
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      expect(feesAfter).to.equal(0);
      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
    });

    it('should reject non-owner fee withdrawal', async function () {
      await expect(
        coinFlip.connect(player1).withdrawFees()
      ).to.be.revertedWithCustomError(coinFlip, 'OwnableUnauthorizedAccount');
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
      ).to.be.revertedWithCustomError(coinFlip, 'EnforcedPause');
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
