# Smart Contracts

This directory contains the Solidity smart contracts for the CoinFlip application.

## Status

Currently empty - you need to create the CoinFlip.sol contract.

## What to Create

### CoinFlip.sol

The main contract that handles:
- Game creation with tier selection
- Player matching (joining games)
- Chainlink VRF integration for provably fair randomness
- Automatic winner payouts
- Cancel/timeout functionality
- Emergency pause

**Full specification**: See `doc/01_smart_contract_architecture.md`

**Quick template**:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

contract CoinFlip is ReentrancyGuard, Pausable, Ownable, VRFConsumerBaseV2 {
    // State variables
    uint256 public nextGameId;

    // VRF
    VRFCoordinatorV2Interface public immutable vrfCoordinator;
    uint64 public immutable vrfSubscriptionId;
    bytes32 public immutable vrfKeyHash;

    // Tiers
    mapping(uint8 => uint256) public tierAmounts;

    // Games
    struct Game {
        address creator;
        address joiner;
        uint8 tier;
        uint256 amount;
        bool creatorChoice;  // false = heads, true = tails
        bool joinerChoice;
        uint256 vrfRequestId;
        address winner;
        GameStatus status;
    }

    enum GameStatus {
        Waiting,
        Active,
        Resolved,
        Cancelled
    }

    mapping(uint256 => Game) public games;
    mapping(uint256 => uint256) public vrfRequestToGame;

    // Events
    event GameCreated(uint256 indexed gameId, address indexed creator, uint8 tier, uint256 amount, bool choice);
    event GameJoined(uint256 indexed gameId, address indexed joiner, bool choice);
    event GameResolved(uint256 indexed gameId, bool result, address indexed winner, uint256 amount);
    event GameCancelled(uint256 indexed gameId, address indexed creator);

    constructor(
        uint64 _subscriptionId,
        address _vrfCoordinator,
        bytes32 _keyHash
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        vrfSubscriptionId = _subscriptionId;
        vrfKeyHash = _keyHash;
    }

    // TODO: Implement functions:
    // - createGame(uint8 tier, bool choice) payable
    // - joinGame(uint256 gameId, bool choice) payable
    // - cancelGame(uint256 gameId)
    // - fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override
    // - setTier(uint8 tierId, uint256 amount) onlyOwner
    // - pause() / unpause()
}
```

## Required Dependencies

You'll need to install OpenZeppelin and Chainlink contracts:

```bash
pnpm add -D @openzeppelin/contracts @chainlink/contracts
```

## Testing

After writing the contract, test it:

```bash
# Compile
npx hardhat compile

# Deploy to local network
npx hardhat run scripts/deploy.ts

# Deploy to Mumbai testnet
npx hardhat run scripts/deploy.ts --network mumbai
```

## Resources

- Full contract specification: `doc/01_smart_contract_architecture.md`
- Chainlink VRF docs: https://docs.chain.link/vrf/v2/introduction
- OpenZeppelin docs: https://docs.openzeppelin.com/contracts/
- Hardhat guide: https://hardhat.org/getting-started/
