// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

/**
 * @title CoinFlip
 * @notice Provably fair peer-to-peer coin flip gambling using Chainlink VRF V2.5
 * @dev Non-custodial game where two players bet on a coin flip outcome
 *      Uses Chainlink Automation for automatic cancellation of expired games
 */
contract CoinFlip is ReentrancyGuard, Pausable, Ownable, AutomationCompatibleInterface {

    // =============================================================
    //                        CONSTANTS
    // =============================================================

    /// @notice Contract version for upgrade tracking
    uint8 public constant VERSION = 4;

    /// @notice Maximum number of tiers
    uint8 public constant MAX_TIERS = 10;

    /// @notice Maximum fee in basis points (10% cap)
    uint16 public constant MAX_FEE_BASIS_POINTS = 1000;

    /// @notice Minimum timeout blocks (prevent instant cancellation)
    uint256 public constant MIN_TIMEOUT_BLOCKS = 10;

    /// @notice Maximum timeout blocks (prevent games stuck forever)
    uint256 public constant MAX_TIMEOUT_BLOCKS = 1000;

    // =============================================================
    //                  CONFIGURABLE PARAMETERS
    // =============================================================

    /// @notice Maximum concurrent games per player (configurable)
    uint8 public maxGamesPerPlayer = 5;

    /// @notice Platform fee in basis points (default 300 = 3%)
    uint16 public feeBasisPoints = 300;

    /// @notice Blocks before game can be cancelled (default ~5 min on Sepolia)
    uint256 public timeoutBlocks = 25;

    /// @notice Blocks before LOCKED game can be refunded if VRF fails (default ~40 min on Sepolia)
    uint256 public vrfTimeoutBlocks = 200;

    /// @notice VRF callback gas limit
    uint32 public constant VRF_CALLBACK_GAS_LIMIT = 100000;

    /// @notice VRF request confirmations
    uint16 public constant VRF_REQUEST_CONFIRMATIONS = 3;

    /// @notice Maximum games to cancel in a single performUpkeep call
    uint8 public constant MAX_BATCH_CANCEL = 10;

    /// @notice Number of random words requested from VRF
    uint32 public constant VRF_NUM_WORDS = 1;

    /// @notice Maximum number of open games (prevents unbounded array growth)
    uint256 public constant MAX_OPEN_GAMES = 1000;

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

    /// @notice Array of open game IDs for efficient iteration by Chainlink Automation
    uint256[] public openGameIds;

    /// @notice Mapping of game ID to its index in openGameIds array (+ 1 to distinguish from 0)
    mapping(uint256 => uint256) public openGameIndex;

    /// @notice Mapping to track stuck funds from failed refunds (gameId => amount)
    mapping(uint256 => uint256) public stuckFunds;

    /// @notice Mapping to track active games per player (address => count)
    mapping(address => uint8) public activeGameCount;

    /// @notice Mapping to track player statistics
    mapping(address => PlayerStats) public playerStats;

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
        uint256 createdBlock;   // Block when game was created
        uint256 lockedBlock;    // Block when game was locked (VRF requested)
        uint256 vrfRequestId;   // Chainlink VRF request ID
        bool coinResult;        // Result (false=heads, true=tails)
        address winner;         // Winner address
    }

    struct PlayerStats {
        uint256 gamesPlayed;    // Total games participated in
        uint256 gamesWon;       // Total games won
        uint256 gamesLost;      // Total games lost
        uint256 totalWagered;   // Total amount wagered
        uint256 totalWon;       // Total amount won (payouts received)
        uint256 totalLost;      // Total amount lost (bets lost)
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

    event GameAutoCancelled(
        uint256 indexed gameId,
        address indexed creator,
        uint256 refundAmount,
        address indexed cancelledBy
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

    event StuckFundsRecovered(
        uint256 indexed gameId,
        address indexed recipient,
        uint256 amount
    );

    event RefundFailed(
        uint256 indexed gameId,
        address indexed player,
        uint256 amount
    );

    event FeeBasisPointsUpdated(
        uint16 oldFee,
        uint16 newFee
    );

    event TimeoutBlocksUpdated(
        uint256 oldTimeout,
        uint256 newTimeout
    );

    event VrfTimeoutBlocksUpdated(
        uint256 oldTimeout,
        uint256 newTimeout
    );

    event MaxGamesPerPlayerUpdated(
        uint8 oldMax,
        uint8 newMax
    );

    event PlayerStatsUpdated(
        address indexed player,
        uint256 gamesPlayed,
        uint256 gamesWon,
        uint256 totalWagered,
        uint256 totalWon
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
    error TooManyOpenGames();
    error InvalidTierAmount();
    error NoStuckFunds();
    error TooManyActiveGames();
    error InvalidFeeAmount();
    error InvalidTimeoutValue();
    error InvalidMaxGames();

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
        if (t.amount == 0) revert InvalidTierAmount();
        if (msg.value != t.amount) revert IncorrectBetAmount();
        if (openGameIds.length >= MAX_OPEN_GAMES) revert TooManyOpenGames();
        if (activeGameCount[msg.sender] >= maxGamesPerPlayer) revert TooManyActiveGames();

        // Increment active game count for creator
        activeGameCount[msg.sender]++;

        // Create game
        gameId = nextGameId++;
        games[gameId] = Game({
            playerA: msg.sender,
            playerB: address(0),
            tier: tier,
            choiceA: choice,
            state: GameState.OPEN,
            createdBlock: block.number,
            lockedBlock: 0,
            vrfRequestId: 0,
            coinResult: false,
            winner: address(0)
        });

        // Update statistics
        t.totalGames++;

        // Track open game for Chainlink Automation
        openGameIndex[gameId] = openGameIds.length + 1; // +1 to distinguish from 0
        openGameIds.push(gameId);

        emit GameCreated(gameId, msg.sender, tier, t.amount, choice);
    }

    /**
     * @notice Join an existing open game
     * @dev Joiner automatically bets against creator's choice (heads vs tails game)
     * @param gameId The game ID to join
     */
    function joinGame(uint256 gameId)
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
        if (activeGameCount[msg.sender] >= maxGamesPerPlayer) revert TooManyActiveGames();

        // Increment active game count for joiner
        activeGameCount[msg.sender]++;

        // Update game state
        game.playerB = msg.sender;
        game.state = GameState.LOCKED;
        game.lockedBlock = block.number;

        // Remove from open games array (game is now locked)
        _removeFromOpenGames(gameId);

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

        // Note: requestId is only known after the VRF call, so these writes must come after.
        // This is safe because: (1) nonReentrant modifier prevents reentrancy,
        // (2) game.state is LOCKED before this call, (3) VRF coordinator is trusted.
        uint256 requestId = i_vrfCoordinator.requestRandomWords(req);

        game.vrfRequestId = requestId;
        vrfRequests[requestId] = gameId;

        emit GameJoined(gameId, msg.sender, t.amount * 2);
    }

    /**
     * @notice Cancel an open game and receive full refund
     * @dev Creator can cancel immediately, anyone can cancel after TIMEOUT_BLOCKS
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

        // Creator can cancel immediately, others must wait for timeout
        bool isCreator = msg.sender == game.playerA;
        bool isTimedOut = block.number >= game.createdBlock + timeoutBlocks;

        if (!isCreator && !isTimedOut) {
            revert TimeoutNotReached();
        }

        // Remove from open games array
        _removeFromOpenGames(gameId);

        // Update state first (CEI pattern)
        game.state = GameState.CANCELLED;

        // Decrement active game count for creator
        if (activeGameCount[game.playerA] > 0) {
            activeGameCount[game.playerA]--;
        }

        // Refund creator
        uint256 refundAmount = tiers[game.tier].amount;
        (bool success, ) = game.playerA.call{value: refundAmount}("");
        if (!success) revert TransferFailed();

        // Emit appropriate event
        if (isCreator) {
            emit GameCancelled(gameId, game.playerA, refundAmount);
        } else {
            emit GameAutoCancelled(gameId, game.playerA, refundAmount, msg.sender);
        }
    }

    /**
     * @notice Claim refund for a LOCKED game where VRF failed to respond
     * @dev Either player can call this after vrfTimeoutBlocks have passed since game was locked
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
        // Use lockedBlock (when VRF was requested) not createdBlock
        if (block.number < game.lockedBlock + vrfTimeoutBlocks) {
            revert VrfTimeoutNotReached();
        }

        // Update state
        game.state = GameState.CANCELLED;

        // Decrement active game counts for both players
        if (activeGameCount[game.playerA] > 0) {
            activeGameCount[game.playerA]--;
        }
        if (activeGameCount[game.playerB] > 0) {
            activeGameCount[game.playerB]--;
        }

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
        bool wasEnabled = tier.enabled;

        tier.amount = amount;
        tier.enabled = enabled;

        // Update active tier count based on state change
        if (enabled && !wasEnabled) {
            activeTierCount++;
        } else if (!enabled && wasEnabled) {
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
     * @notice Update platform fee
     * @param newFee New fee in basis points (max 1000 = 10%)
     */
    function setFeeBasisPoints(uint16 newFee)
        external
        onlyOwner
    {
        if (newFee > MAX_FEE_BASIS_POINTS) revert InvalidFeeAmount();

        uint16 oldFee = feeBasisPoints;
        feeBasisPoints = newFee;

        emit FeeBasisPointsUpdated(oldFee, newFee);
    }

    /**
     * @notice Update game timeout blocks
     * @param newTimeout New timeout in blocks
     */
    function setTimeoutBlocks(uint256 newTimeout)
        external
        onlyOwner
    {
        if (newTimeout < MIN_TIMEOUT_BLOCKS || newTimeout > MAX_TIMEOUT_BLOCKS) {
            revert InvalidTimeoutValue();
        }

        uint256 oldTimeout = timeoutBlocks;
        timeoutBlocks = newTimeout;

        emit TimeoutBlocksUpdated(oldTimeout, newTimeout);
    }

    /**
     * @notice Update VRF timeout blocks
     * @param newTimeout New VRF timeout in blocks
     */
    function setVrfTimeoutBlocks(uint256 newTimeout)
        external
        onlyOwner
    {
        // VRF timeout should be at least 4x the regular timeout
        if (newTimeout < timeoutBlocks * 4 || newTimeout > MAX_TIMEOUT_BLOCKS * 10) {
            revert InvalidTimeoutValue();
        }

        uint256 oldTimeout = vrfTimeoutBlocks;
        vrfTimeoutBlocks = newTimeout;

        emit VrfTimeoutBlocksUpdated(oldTimeout, newTimeout);
    }

    /**
     * @notice Update max games per player
     * @param newMax New maximum games per player (1-20)
     */
    function setMaxGamesPerPlayer(uint8 newMax)
        external
        onlyOwner
    {
        if (newMax == 0 || newMax > 20) revert InvalidMaxGames();

        uint8 oldMax = maxGamesPerPlayer;
        maxGamesPerPlayer = newMax;

        emit MaxGamesPerPlayerUpdated(oldMax, newMax);
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

        // Decrement active game counts
        if (game.playerA != address(0) && activeGameCount[game.playerA] > 0) {
            activeGameCount[game.playerA]--;
        }
        if (game.playerB != address(0) && activeGameCount[game.playerB] > 0) {
            activeGameCount[game.playerB]--;
        }

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
     * @notice Recover stuck funds from a failed refund
     * @dev Can only recover funds that are tracked in stuckFunds mapping
     * @param gameId The game ID to recover funds for
     */
    function recoverStuckFunds(uint256 gameId)
        external
        onlyOwner
        nonReentrant
    {
        uint256 amount = stuckFunds[gameId];
        if (amount == 0) revert NoStuckFunds();

        Game storage game = games[gameId];
        address recipient = game.playerA;

        // Clear stuck funds first (CEI pattern)
        stuckFunds[gameId] = 0;

        // Attempt to send to original recipient
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) {
            // If still fails, send to fee recipient as fallback
            (bool fallbackSuccess, ) = feeRecipient.call{value: amount}("");
            if (!fallbackSuccess) revert TransferFailed();
            recipient = feeRecipient;
        }

        emit StuckFundsRecovered(gameId, recipient, amount);
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
    //                    CHAINLINK AUTOMATION
    // =============================================================

    /**
     * @notice Check if there are expired games that need cancellation
     * @dev Called by Chainlink Automation nodes to check if performUpkeep should be called
     * @return upkeepNeeded True if there are expired games
     * @return performData Encoded array of expired game IDs
     */
    function checkUpkeep(bytes calldata /* checkData */)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256[] memory expiredGameIds = new uint256[](MAX_BATCH_CANCEL);
        uint256 count = 0;

        // Iterate through open games to find expired ones
        for (uint256 i = 0; i < openGameIds.length && count < MAX_BATCH_CANCEL; i++) {
            uint256 gameId = openGameIds[i];
            Game storage game = games[gameId];

            // Check if game is still OPEN and has timed out
            if (game.state == GameState.OPEN &&
                block.number >= game.createdBlock + timeoutBlocks) {
                expiredGameIds[count] = gameId;
                count++;
            }
        }

        if (count > 0) {
            // Resize array to actual count
            uint256[] memory result = new uint256[](count);
            for (uint256 i = 0; i < count; i++) {
                result[i] = expiredGameIds[i];
            }
            return (true, abi.encode(result));
        }

        return (false, "");
    }

    /**
     * @notice Cancel expired games automatically
     * @dev Called by Chainlink Automation when checkUpkeep returns true
     * @param performData Encoded array of game IDs to cancel
     */
    function performUpkeep(bytes calldata performData) external override {
        uint256[] memory gameIdsToCancel = abi.decode(performData, (uint256[]));

        for (uint256 i = 0; i < gameIdsToCancel.length; i++) {
            uint256 gameId = gameIdsToCancel[i];
            Game storage game = games[gameId];

            // Re-validate before cancelling (state may have changed)
            if (game.state == GameState.OPEN &&
                block.number >= game.createdBlock + timeoutBlocks) {

                // Remove from open games array
                _removeFromOpenGames(gameId);

                // Update state
                game.state = GameState.CANCELLED;

                // Decrement active game count for creator
                if (activeGameCount[game.playerA] > 0) {
                    activeGameCount[game.playerA]--;
                }

                // Refund creator
                uint256 refundAmount = tiers[game.tier].amount;
                (bool success, ) = game.playerA.call{value: refundAmount}("");

                if (success) {
                    emit GameAutoCancelled(gameId, game.playerA, refundAmount, msg.sender);
                } else {
                    // Track stuck funds for later recovery
                    stuckFunds[gameId] = refundAmount;
                    emit RefundFailed(gameId, game.playerA, refundAmount);
                }
            }
        }
    }

    /**
     * @notice Get the number of open games
     * @return Number of games in OPEN state
     */
    function getOpenGamesCount() external view returns (uint256) {
        return openGameIds.length;
    }

    /**
     * @notice Get all open game IDs
     * @return Array of open game IDs
     */
    function getOpenGameIds() external view returns (uint256[] memory) {
        return openGameIds;
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
        uint256 fee = (pot * feeBasisPoints) / 10000;
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
        return game.state == GameState.OPEN;
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
               block.number >= game.lockedBlock + vrfTimeoutBlocks;
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

        uint256 timeoutBlock = game.lockedBlock + vrfTimeoutBlocks;
        if (block.number >= timeoutBlock) return 0;

        return timeoutBlock - block.number;
    }

    /**
     * @notice Get active game count for a player
     * @param player The player address
     * @return Number of active games
     */
    function getActiveGameCount(address player)
        external
        view
        returns (uint8)
    {
        return activeGameCount[player];
    }

    /**
     * @notice Check if a player can create a new game
     * @param player The player address
     * @return True if player can create a new game
     */
    function canCreateGame(address player)
        external
        view
        returns (bool)
    {
        return activeGameCount[player] < maxGamesPerPlayer;
    }

    /**
     * @notice Get complete player statistics
     * @param player The player address
     * @return PlayerStats struct with all statistics
     */
    function getPlayerStats(address player)
        external
        view
        returns (PlayerStats memory)
    {
        return playerStats[player];
    }

    /**
     * @notice Get player win rate in basis points (0-10000)
     * @param player The player address
     * @return Win rate in basis points (e.g., 5000 = 50%)
     */
    function getPlayerWinRate(address player)
        external
        view
        returns (uint256)
    {
        PlayerStats storage stats = playerStats[player];
        if (stats.gamesPlayed == 0) return 0;
        return (stats.gamesWon * 10000) / stats.gamesPlayed;
    }

    /**
     * @notice Get player profit/loss (positive = profit, negative represented as 0)
     * @param player The player address
     * @return profit Total profit (0 if negative)
     * @return loss Total loss (0 if profitable)
     */
    function getPlayerProfitLoss(address player)
        external
        view
        returns (uint256 profit, uint256 loss)
    {
        PlayerStats storage stats = playerStats[player];
        if (stats.totalWon >= stats.totalWagered) {
            profit = stats.totalWon - stats.totalWagered;
            loss = 0;
        } else {
            profit = 0;
            loss = stats.totalWagered - stats.totalWon;
        }
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

        // Gracefully handle race condition where game was cancelled via claimVrfTimeout
        // before VRF callback arrived. Simply return without processing.
        if (game.state != GameState.LOCKED) {
            // Clear the request mapping to prevent future issues
            delete vrfRequests[requestId];
            return;
        }

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

        // Decrement active game counts for both players
        if (activeGameCount[game.playerA] > 0) {
            activeGameCount[game.playerA]--;
        }
        if (activeGameCount[game.playerB] > 0) {
            activeGameCount[game.playerB]--;
        }

        // Calculate payout
        Tier storage t = tiers[game.tier];
        uint256 pot = t.amount * 2;
        uint256 fee = (pot * feeBasisPoints) / 10000;
        uint256 payout = pot - fee;

        // Track fees
        collectedFees += fee;

        // Update player statistics
        uint256 betAmount = t.amount;

        // Winner stats
        PlayerStats storage winnerStats = playerStats[winner];
        winnerStats.gamesPlayed++;
        winnerStats.gamesWon++;
        winnerStats.totalWagered += betAmount;
        winnerStats.totalWon += payout;

        // Loser stats
        PlayerStats storage loserStats = playerStats[loser];
        loserStats.gamesPlayed++;
        loserStats.gamesLost++;
        loserStats.totalWagered += betAmount;
        loserStats.totalLost += betAmount;

        // Emit stats events for indexing
        emit PlayerStatsUpdated(
            winner,
            winnerStats.gamesPlayed,
            winnerStats.gamesWon,
            winnerStats.totalWagered,
            winnerStats.totalWon
        );
        emit PlayerStatsUpdated(
            loser,
            loserStats.gamesPlayed,
            loserStats.gamesWon,
            loserStats.totalWagered,
            loserStats.totalWon
        );

        // Transfer to winner
        (bool success, ) = winner.call{value: payout}("");
        if (!success) revert TransferFailed();

        emit GameResolved(gameId, winner, loser, coinResult, payout);
    }

    /**
     * @notice Remove a game from the openGameIds array
     * @dev Uses swap-and-pop for O(1) removal
     * @param gameId The game ID to remove
     */
    function _removeFromOpenGames(uint256 gameId) internal {
        uint256 indexPlusOne = openGameIndex[gameId];
        if (indexPlusOne == 0) return; // Not in array

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = openGameIds.length - 1;

        // If not the last element, swap with the last
        if (index != lastIndex) {
            uint256 lastGameId = openGameIds[lastIndex];
            openGameIds[index] = lastGameId;
            openGameIndex[lastGameId] = indexPlusOne; // Update moved element's index
        }

        // Remove the last element
        openGameIds.pop();
        delete openGameIndex[gameId];
    }
}
