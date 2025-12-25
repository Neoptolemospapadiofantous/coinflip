// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title CoinFlip
 * @notice Provably fair peer-to-peer coin flip gambling using Chainlink VRF V2.5
 * @dev Non-custodial game where two players bet on a coin flip outcome
 */
contract CoinFlip is ReentrancyGuard, Pausable, Ownable {

    // =============================================================
    //                        CONSTANTS
    // =============================================================

    /// @notice Contract version for upgrade tracking
    uint8 public constant VERSION = 1;

    /// @notice Maximum number of tiers
    uint8 public constant MAX_TIERS = 10;

    /// @notice Platform fee in basis points (500 = 5%)
    uint16 public constant FEE_BASIS_POINTS = 500;

    /// @notice Blocks before game can be cancelled (timeout)
    uint256 public constant TIMEOUT_BLOCKS = 100;

    /// @notice Blocks before LOCKED game can be refunded if VRF fails (~3 hours on Sepolia)
    uint256 public constant VRF_TIMEOUT_BLOCKS = 1000;

    /// @notice VRF callback gas limit
    uint32 public constant VRF_CALLBACK_GAS_LIMIT = 100000;

    /// @notice VRF request confirmations
    uint16 public constant VRF_REQUEST_CONFIRMATIONS = 3;

    /// @notice Number of random words requested from VRF
    uint32 public constant VRF_NUM_WORDS = 1;

    // =============================================================
    //                      IMMUTABLES
    // =============================================================

    /// @notice Chainlink VRF coordinator interface
    IVRFCoordinatorV2Plus public immutable i_vrfCoordinator;

    /// @notice Chainlink VRF subscription ID (V2.5 uses uint256)
    uint256 public immutable i_vrfSubscriptionId;

    /// @notice Chainlink VRF key hash
    bytes32 public immutable i_vrfKeyHash;

    // =============================================================
    //                      STATE VARIABLES
    // =============================================================

    /// @notice Counter for next game ID
    uint256 public nextGameId;

    /// @notice Mapping of game ID to Game struct
    mapping(uint256 => Game) public games;

    /// @notice Mapping of VRF request ID to game ID
    mapping(uint256 => uint256) public vrfRequests;

    /// @notice Mapping of tier ID to Tier struct
    mapping(uint8 => Tier) public tiers;

    /// @notice Number of active tiers
    uint8 public activeTierCount;

    /// @notice Address to receive platform fees
    address public feeRecipient;

    /// @notice Total fees collected and available for withdrawal
    uint256 public collectedFees;

    // =============================================================
    //                      ENUMS
    // =============================================================

    enum GameState {
        NONE,       // Game doesn't exist
        OPEN,       // Waiting for opponent
        LOCKED,     // Both players joined, awaiting VRF
        RESOLVED,   // Game finished, winner paid
        CANCELLED   // Game cancelled, refunded
    }

    // =============================================================
    //                      STRUCTS
    // =============================================================

    struct Tier {
        uint256 amount;      // Bet amount in wei
        bool enabled;        // Is tier active?
        uint256 totalGames;  // Total games created in this tier
        uint256 totalVolume; // Total volume wagered
    }

    struct Game {
        address playerA;        // Creator
        address playerB;        // Joiner
        uint8 tier;             // Tier ID
        bool choiceA;           // Creator's choice (false=heads, true=tails)
        GameState state;        // Current game state
        uint256 createdBlock;   // Block when created
        uint256 vrfRequestId;   // Chainlink VRF request ID
        bool coinResult;        // Result (false=heads, true=tails)
        address winner;         // Winner address
    }

    // =============================================================
    //                        EVENTS
    // =============================================================

    event GameCreated(
        uint256 indexed gameId,
        address indexed creator,
        uint8 tier,
        uint256 amount,
        bool choice
    );

    event GameJoined(
        uint256 indexed gameId,
        address indexed joiner,
        uint256 totalPot
    );

    event GameResolved(
        uint256 indexed gameId,
        address indexed winner,
        address indexed loser,
        bool coinResult,
        uint256 payout
    );

    event GameCancelled(
        uint256 indexed gameId,
        address indexed creator,
        uint256 refundAmount
    );

    event VrfTimeoutClaimed(
        uint256 indexed gameId,
        address indexed playerA,
        address indexed playerB,
        uint256 refundAmount
    );

    event EmergencyRefund(
        uint256 indexed gameId,
        address indexed playerA,
        address indexed playerB,
        uint256 totalRefund
    );

    event TierUpdated(
        uint8 indexed tierId,
        uint256 amount,
        bool enabled
    );

    event FeesWithdrawn(
        address indexed recipient,
        uint256 amount
    );

    event FeeRecipientUpdated(
        address indexed oldRecipient,
        address indexed newRecipient
    );

    // =============================================================
    //                        ERRORS
    // =============================================================

    error InvalidTier();
    error TierDisabled();
    error IncorrectBetAmount();
    error GameDoesNotExist();
    error InvalidGameState();
    error CannotJoinOwnGame();
    error NotGameCreator();
    error TimeoutNotReached();
    error VrfTimeoutNotReached();
    error NotGameParticipant();
    error TransferFailed();
    error NoFeesToWithdraw();
    error InvalidFeeRecipient();

    // =============================================================
    //                      CONSTRUCTOR
    // =============================================================

    /**
     * @notice Initialize the CoinFlip contract
     * @param subscriptionId Chainlink VRF subscription ID (V2.5 uses uint256)
     * @param vrfCoordinator Chainlink VRF Coordinator address
     * @param keyHash Chainlink VRF key hash
     * @param _feeRecipient Address to receive platform fees
     */
    constructor(
        uint256 subscriptionId,
        address vrfCoordinator,
        bytes32 keyHash,
        address _feeRecipient
    ) Ownable(msg.sender) {
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        if (vrfCoordinator == address(0)) revert InvalidFeeRecipient(); // Reuse error for simplicity

        i_vrfCoordinator = IVRFCoordinatorV2Plus(vrfCoordinator);
        i_vrfSubscriptionId = subscriptionId;
        i_vrfKeyHash = keyHash;
        feeRecipient = _feeRecipient;
    }

    // =============================================================
    //                    EXTERNAL FUNCTIONS
    // =============================================================

    /**
     * @notice Create a new coin flip game
     * @param tier Tier ID (0-9)
     * @param choice Player's prediction (false=heads, true=tails)
     * @return gameId The created game ID
     */
    function createGame(uint8 tier, bool choice)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256 gameId)
    {
        Tier storage t = tiers[tier];

        // Validations
        if (tier >= MAX_TIERS) revert InvalidTier();
        if (!t.enabled) revert TierDisabled();
        if (msg.value != t.amount) revert IncorrectBetAmount();

        // Create game
        gameId = nextGameId++;
        games[gameId] = Game({
            playerA: msg.sender,
            playerB: address(0),
            tier: tier,
            choiceA: choice,
            state: GameState.OPEN,
            createdBlock: block.number,
            vrfRequestId: 0,
            coinResult: false,
            winner: address(0)
        });

        // Update statistics
        t.totalGames++;

        emit GameCreated(gameId, msg.sender, tier, t.amount, choice);
    }

    /**
     * @notice Join an existing open game
     * @param gameId The game ID to join
     * @param choice Player's prediction (false=heads, true=tails)
     */
    function joinGame(uint256 gameId, bool choice)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        Game storage game = games[gameId];
        Tier storage t = tiers[game.tier];

        // Validations
        if (game.state == GameState.NONE) revert GameDoesNotExist();
        if (game.state != GameState.OPEN) revert InvalidGameState();
        if (msg.sender == game.playerA) revert CannotJoinOwnGame();
        if (msg.value != t.amount) revert IncorrectBetAmount();

        // Update game state
        game.playerB = msg.sender;
        game.state = GameState.LOCKED;

        // Update statistics
        t.totalVolume += t.amount * 2;

        // Request randomness from Chainlink VRF V2.5
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: i_vrfKeyHash,
            subId: i_vrfSubscriptionId,
            requestConfirmations: VRF_REQUEST_CONFIRMATIONS,
            callbackGasLimit: VRF_CALLBACK_GAS_LIMIT,
            numWords: VRF_NUM_WORDS,
            extraArgs: VRFV2PlusClient._argsToBytes(
                VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
            )
        });

        uint256 requestId = i_vrfCoordinator.requestRandomWords(req);

        game.vrfRequestId = requestId;
        vrfRequests[requestId] = gameId;

        emit GameJoined(gameId, msg.sender, t.amount * 2);
    }

    /**
     * @notice Cancel a game that has timed out
     * @param gameId The game ID to cancel
     */
    function cancelGame(uint256 gameId)
        external
        nonReentrant
    {
        Game storage game = games[gameId];

        // Validations
        if (game.state == GameState.NONE) revert GameDoesNotExist();
        if (game.state != GameState.OPEN) revert InvalidGameState();
        if (msg.sender != game.playerA) revert NotGameCreator();
        if (block.number < game.createdBlock + TIMEOUT_BLOCKS) {
            revert TimeoutNotReached();
        }

        // Update state
        game.state = GameState.CANCELLED;

        // Refund creator
        uint256 refundAmount = tiers[game.tier].amount;
        (bool success, ) = game.playerA.call{value: refundAmount}("");
        if (!success) revert TransferFailed();

        emit GameCancelled(gameId, game.playerA, refundAmount);
    }

    /**
     * @notice Claim refund for a LOCKED game where VRF failed to respond
     * @dev Either player can call this after VRF_TIMEOUT_BLOCKS have passed
     * @param gameId The game ID to claim refund for
     */
    function claimVrfTimeout(uint256 gameId)
        external
        nonReentrant
    {
        Game storage game = games[gameId];

        // Validations
        if (game.state == GameState.NONE) revert GameDoesNotExist();
        if (game.state != GameState.LOCKED) revert InvalidGameState();
        if (msg.sender != game.playerA && msg.sender != game.playerB) {
            revert NotGameParticipant();
        }
        if (block.number < game.createdBlock + VRF_TIMEOUT_BLOCKS) {
            revert VrfTimeoutNotReached();
        }

        // Update state
        game.state = GameState.CANCELLED;

        // Refund both players
        uint256 refundAmount = tiers[game.tier].amount;

        (bool successA, ) = game.playerA.call{value: refundAmount}("");
        if (!successA) revert TransferFailed();

        (bool successB, ) = game.playerB.call{value: refundAmount}("");
        if (!successB) revert TransferFailed();

        emit VrfTimeoutClaimed(gameId, game.playerA, game.playerB, refundAmount);
    }

    // =============================================================
    //                    ADMIN FUNCTIONS
    // =============================================================

    /**
     * @notice Set or update a tier
     * @param tierId Tier ID (0-9)
     * @param amount Bet amount in wei
     * @param enabled Is tier active?
     */
    function setTier(uint8 tierId, uint256 amount, bool enabled)
        external
        onlyOwner
    {
        if (tierId >= MAX_TIERS) revert InvalidTier();

        Tier storage tier = tiers[tierId];
        tier.amount = amount;
        tier.enabled = enabled;

        // Update active tier count
        if (enabled && tier.totalGames == 0) {
            activeTierCount++;
        } else if (!enabled && tier.totalGames > 0) {
            activeTierCount--;
        }

        emit TierUpdated(tierId, amount, enabled);
    }

    /**
     * @notice Update fee recipient address
     * @param newRecipient New fee recipient address
     */
    function setFeeRecipient(address newRecipient)
        external
        onlyOwner
    {
        if (newRecipient == address(0)) revert InvalidFeeRecipient();

        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;

        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    /**
     * @notice Withdraw collected platform fees
     */
    function withdrawFees()
        external
        onlyOwner
        nonReentrant
    {
        uint256 amount = collectedFees;
        if (amount == 0) revert NoFeesToWithdraw();

        collectedFees = 0;

        (bool success, ) = feeRecipient.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FeesWithdrawn(feeRecipient, amount);
    }

    /**
     * @notice Emergency refund for stuck games (admin only)
     * @dev Can only be called when contract is paused, for games in OPEN or LOCKED state
     * @param gameId The game ID to refund
     */
    function emergencyRefund(uint256 gameId)
        external
        onlyOwner
        whenPaused
        nonReentrant
    {
        Game storage game = games[gameId];

        // Can only refund OPEN or LOCKED games
        if (game.state == GameState.NONE) revert GameDoesNotExist();
        if (game.state == GameState.RESOLVED || game.state == GameState.CANCELLED) {
            revert InvalidGameState();
        }

        uint256 refundAmount = tiers[game.tier].amount;
        uint256 totalRefund = 0;

        // Update state first (prevent reentrancy)
        game.state = GameState.CANCELLED;

        // Refund player A
        if (game.playerA != address(0)) {
            (bool successA, ) = game.playerA.call{value: refundAmount}("");
            if (successA) totalRefund += refundAmount;
        }

        // Refund player B (only if game was LOCKED)
        if (game.playerB != address(0)) {
            (bool successB, ) = game.playerB.call{value: refundAmount}("");
            if (successB) totalRefund += refundAmount;
        }

        emit EmergencyRefund(gameId, game.playerA, game.playerB, totalRefund);
    }

    /**
     * @notice Pause the contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /**
     * @notice Get complete game information
     * @param gameId The game ID
     * @return Game struct
     */
    function getGame(uint256 gameId)
        external
        view
        returns (Game memory)
    {
        return games[gameId];
    }

    /**
     * @notice Get tier information
     * @param tierId The tier ID
     * @return Tier struct
     */
    function getTier(uint8 tierId)
        external
        view
        returns (Tier memory)
    {
        return tiers[tierId];
    }

    /**
     * @notice Calculate payout amount for a tier (after fees)
     * @param tierId The tier ID
     * @return Payout amount in wei
     */
    function calculatePayout(uint8 tierId)
        external
        view
        returns (uint256)
    {
        uint256 pot = tiers[tierId].amount * 2;
        uint256 fee = (pot * FEE_BASIS_POINTS) / 10000;
        return pot - fee;
    }

    /**
     * @notice Check if a game can be cancelled
     * @param gameId The game ID
     * @return True if game can be cancelled
     */
    function canCancelGame(uint256 gameId)
        external
        view
        returns (bool)
    {
        Game storage game = games[gameId];
        return game.state == GameState.OPEN &&
               block.number >= game.createdBlock + TIMEOUT_BLOCKS;
    }

    /**
     * @notice Check if a LOCKED game can claim VRF timeout refund
     * @param gameId The game ID
     * @return True if VRF timeout can be claimed
     */
    function canClaimVrfTimeout(uint256 gameId)
        external
        view
        returns (bool)
    {
        Game storage game = games[gameId];
        return game.state == GameState.LOCKED &&
               block.number >= game.createdBlock + VRF_TIMEOUT_BLOCKS;
    }

    /**
     * @notice Get blocks remaining until VRF timeout can be claimed
     * @param gameId The game ID
     * @return Blocks remaining (0 if can claim now or game not LOCKED)
     */
    function getVrfTimeoutBlocksRemaining(uint256 gameId)
        external
        view
        returns (uint256)
    {
        Game storage game = games[gameId];
        if (game.state != GameState.LOCKED) return 0;

        uint256 timeoutBlock = game.createdBlock + VRF_TIMEOUT_BLOCKS;
        if (block.number >= timeoutBlock) return 0;

        return timeoutBlock - block.number;
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================

    /**
     * @notice Raw fulfillment function called by VRF Coordinator
     * @dev Only the VRF Coordinator can call this
     * @param requestId The VRF request ID
     * @param randomWords Array of random values
     */
    function rawFulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) external {
        if (msg.sender != address(i_vrfCoordinator)) {
            revert InvalidGameState(); // Reuse error for simplicity
        }
        fulfillRandomWords(requestId, randomWords);
    }

    /**
     * @notice Internal callback function to process VRF response
     * @param requestId The VRF request ID
     * @param randomWords Array of random values
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal {
        uint256 gameId = vrfRequests[requestId];
        Game storage game = games[gameId];

        // Validate state
        if (game.state != GameState.LOCKED) revert InvalidGameState();

        // Determine coin flip result (50/50 odds)
        bool coinResult = (randomWords[0] % 2) == 1;
        game.coinResult = coinResult;

        // Determine winner
        address winner = (coinResult == game.choiceA)
            ? game.playerA
            : game.playerB;

        address loser = (winner == game.playerA)
            ? game.playerB
            : game.playerA;

        game.winner = winner;
        game.state = GameState.RESOLVED;

        // Calculate payout
        Tier storage t = tiers[game.tier];
        uint256 pot = t.amount * 2;
        uint256 fee = (pot * FEE_BASIS_POINTS) / 10000;
        uint256 payout = pot - fee;

        // Track fees
        collectedFees += fee;

        // Transfer to winner
        (bool success, ) = winner.call{value: payout}("");
        if (!success) revert TransferFailed();

        emit GameResolved(gameId, winner, loser, coinResult, payout);
    }
}
