// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title VRFCoordinatorV2Mock
 * @notice Mock VRF Coordinator for local testing
 */
contract VRFCoordinatorV2Mock {
    uint256 private requestCounter;

    mapping(uint256 => address) public requestIdToConsumer;

    event RandomWordsRequested(
        bytes32 indexed keyHash,
        uint256 requestId,
        uint256 subId,
        uint16 requestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        address indexed sender
    );

    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata req
    ) external returns (uint256) {
        requestCounter++;
        uint256 requestId = requestCounter;

        requestIdToConsumer[requestId] = msg.sender;

        emit RandomWordsRequested(
            req.keyHash,
            requestId,
            req.subId,
            req.requestConfirmations,
            req.callbackGasLimit,
            req.numWords,
            msg.sender
        );

        return requestId;
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) external {
        address consumer = requestIdToConsumer[requestId];
        require(consumer != address(0), "Request not found");

        // Call the consumer's callback
        (bool success, ) = consumer.call(
            abi.encodeWithSignature(
                "rawFulfillRandomWords(uint256,uint256[])",
                requestId,
                randomWords
            )
        );

        require(success, "Callback failed");
    }
}
