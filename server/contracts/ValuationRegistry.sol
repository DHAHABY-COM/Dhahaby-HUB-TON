// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ValuationRegistry {
    struct ValuationRecord {
        address user;
        bytes32 valuationHash;
        uint256 amountMinor;
        uint256 confidenceBps;
        uint64 createdAt;
        string currency;
        string reportUri;
    }

    address public owner;
    uint256 public nextId;
    mapping(uint256 => ValuationRecord) public valuations;

    event ValuationRecorded(
        uint256 indexed id,
        address indexed user,
        bytes32 indexed valuationHash,
        uint256 amountMinor,
        uint256 confidenceBps,
        string currency,
        string reportUri,
        uint64 createdAt
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        owner = initialOwner;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    function recordValuation(
        address user,
        bytes32 valuationHash,
        uint256 amountMinor,
        string calldata currency,
        uint256 confidenceBps,
        string calldata reportUri
    ) external onlyOwner returns (uint256 id) {
        require(user != address(0), "Invalid user");
        require(valuationHash != bytes32(0), "Invalid hash");
        require(bytes(currency).length > 0, "Invalid currency");
        require(confidenceBps <= 10000, "Invalid confidence");

        id = nextId;
        nextId = id + 1;

        valuations[id] = ValuationRecord({
            user: user,
            valuationHash: valuationHash,
            amountMinor: amountMinor,
            confidenceBps: confidenceBps,
            createdAt: uint64(block.timestamp),
            currency: currency,
            reportUri: reportUri
        });

        emit ValuationRecorded(
            id,
            user,
            valuationHash,
            amountMinor,
            confidenceBps,
            currency,
            reportUri,
            uint64(block.timestamp)
        );
    }
}
