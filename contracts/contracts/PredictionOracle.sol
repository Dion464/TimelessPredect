// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface IPredictionMarket {
    function resolveMarket(uint256 marketId, uint8 outcome) external;
    function getMarket(uint256 marketId) external view returns (
        uint256 id,
        string memory questionTitle,
        string memory description,
        address creator,
        uint256 creationTime,
        uint256 resolutionTime,
        uint256 finalResolutionTime,
        bool isResolved,
        uint8 outcome,
        uint256 totalYesShares,
        uint256 totalNoShares,
        uint256 totalVolume,
        uint256 creatorFee,
        bool isActive,
        string memory category,
        address oracle
    );
}

/**
 * @title PredictionOracle
 * @dev Oracle system for resolving prediction markets
 * @notice Handles automated and manual market resolution with dispute mechanisms
 */
contract PredictionOracle is Ownable, ReentrancyGuard {
    
    struct OracleRequest {
        uint256 marketId;
        address requester;
        uint256 timestamp;
        uint8 proposedOutcome;
        uint256 bond;
        bool isResolved;
        bool isDisputed;
        uint256 disputeDeadline;
    }
    
    struct Dispute {
        uint256 requestId;
        address disputer;
        uint8 proposedOutcome;
        uint256 bond;
        uint256 timestamp;
        bool isResolved;
    }
    
    struct AutomatedOracle {
        string dataSource; // "chainlink", "api", "manual"
        address chainlinkFeed;
        string apiEndpoint;
        bytes32 apiPath; // JSON path to extract value
        uint256 threshold; // For price/number based resolutions
        bool isActive;
    }
    
    // Events
    event ResolutionRequested(
        uint256 indexed requestId,
        uint256 indexed marketId,
        address indexed requester,
        uint8 proposedOutcome
    );
    
    event ResolutionDisputed(
        uint256 indexed requestId,
        uint256 indexed disputeId,
        address indexed disputer,
        uint8 proposedOutcome
    );
    
    event MarketResolvedByOracle(
        uint256 indexed marketId,
        uint8 outcome,
        uint256 requestId
    );
    
    event AutomatedOracleSet(
        uint256 indexed marketId,
        string dataSource,
        address chainlinkFeed
    );
    
    // State variables
    IPredictionMarket public predictionMarket;
    uint256 public nextRequestId = 1;
    uint256 public nextDisputeId = 1;
    uint256 public resolutionBond = 100 ether; // Bond required to propose resolution
    uint256 public disputeBond = 200 ether; // Bond required to dispute
    uint256 public disputePeriod = 24 hours; // Time to dispute a resolution
    
    // Mappings
    mapping(uint256 => OracleRequest) public resolutionRequests;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => AutomatedOracle) public automatedOracles; // marketId => oracle config
    mapping(address => bool) public authorizedResolvers;
    mapping(uint256 => uint256[]) public marketDisputes; // marketId => disputeIds
    
    // Modifiers
    modifier onlyAuthorizedResolver() {
        require(authorizedResolvers[msg.sender] || msg.sender == owner(), "Not authorized resolver");
        _;
    }
    
    constructor(address _predictionMarket) {
        predictionMarket = IPredictionMarket(_predictionMarket);
        authorizedResolvers[msg.sender] = true;
    }
    
    /**
     * @dev Request resolution of a market
     * @param marketId The market to resolve
     * @param proposedOutcome The proposed outcome (1=YES, 2=NO, 3=INVALID)
     */
    function requestResolution(
        uint256 marketId,
        uint8 proposedOutcome
    ) external payable nonReentrant {
        require(proposedOutcome >= 1 && proposedOutcome <= 3, "Invalid outcome");
        require(msg.value >= resolutionBond, "Insufficient bond");
        require(marketId > 0, "Invalid market ID");
        
        uint256 requestId = nextRequestId++;
        
        resolutionRequests[requestId] = OracleRequest({
            marketId: marketId,
            requester: msg.sender,
            timestamp: block.timestamp,
            proposedOutcome: proposedOutcome,
            bond: msg.value,
            isResolved: false,
            isDisputed: false,
            disputeDeadline: block.timestamp + disputePeriod
        });
        
        emit ResolutionRequested(requestId, marketId, msg.sender, proposedOutcome);
    }
    
    /**
     * @dev Dispute a resolution request
     * @param requestId The resolution request to dispute
     * @param proposedOutcome Alternative proposed outcome
     */
    function disputeResolution(
        uint256 requestId,
        uint8 proposedOutcome
    ) external payable nonReentrant {
        require(proposedOutcome >= 1 && proposedOutcome <= 3, "Invalid outcome");
        require(msg.value >= disputeBond, "Insufficient dispute bond");
        
        OracleRequest storage request = resolutionRequests[requestId];
        require(!request.isResolved, "Request already resolved");
        require(block.timestamp <= request.disputeDeadline, "Dispute period ended");
        require(proposedOutcome != request.proposedOutcome, "Same outcome as original");
        
        uint256 disputeId = nextDisputeId++;
        
        disputes[disputeId] = Dispute({
            requestId: requestId,
            disputer: msg.sender,
            proposedOutcome: proposedOutcome,
            bond: msg.value,
            timestamp: block.timestamp,
            isResolved: false
        });
        
        request.isDisputed = true;
        marketDisputes[request.marketId].push(disputeId);
        
        emit ResolutionDisputed(requestId, disputeId, msg.sender, proposedOutcome);
    }
    
    /**
     * @dev Execute resolution after dispute period (if no disputes) or manual resolution
     * @param requestId The resolution request to execute
     */
    function executeResolution(uint256 requestId) external onlyAuthorizedResolver {
        OracleRequest storage request = resolutionRequests[requestId];
        require(!request.isResolved, "Already resolved");
        
        uint8 finalOutcome;
        
        if (request.isDisputed) {
            // Manual resolution required for disputed cases
            // This would typically involve a governance vote or trusted oracle decision
            finalOutcome = resolveDispute(request.marketId);
        } else {
            require(block.timestamp > request.disputeDeadline, "Dispute period not ended");
            finalOutcome = request.proposedOutcome;
        }
        
        // Resolve the market
        predictionMarket.resolveMarket(request.marketId, finalOutcome);
        request.isResolved = true;
        
        // Return bond to requester if their outcome was correct
        if (finalOutcome == request.proposedOutcome) {
            payable(request.requester).transfer(request.bond);
        }
        
        emit MarketResolvedByOracle(request.marketId, finalOutcome, requestId);
    }
    
    /**
     * @dev Set up automated oracle for a market
     * @param marketId The market to set up automated resolution for
     * @param dataSource Type of data source ("chainlink", "api", "manual")
     * @param chainlinkFeed Chainlink price feed address (if using Chainlink)
     * @param apiEndpoint API endpoint URL (if using API)
     * @param apiPath JSON path to extract value from API response
     * @param threshold Threshold value for resolution
     */
    function setAutomatedOracle(
        uint256 marketId,
        string memory dataSource,
        address chainlinkFeed,
        string memory apiEndpoint,
        bytes32 apiPath,
        uint256 threshold
    ) external onlyOwner {
        automatedOracles[marketId] = AutomatedOracle({
            dataSource: dataSource,
            chainlinkFeed: chainlinkFeed,
            apiEndpoint: apiEndpoint,
            apiPath: apiPath,
            threshold: threshold,
            isActive: true
        });
        
        emit AutomatedOracleSet(marketId, dataSource, chainlinkFeed);
    }
    
    /**
     * @dev Resolve market using Chainlink price feed
     * @param marketId The market to resolve
     */
    function resolveWithChainlink(uint256 marketId) external onlyAuthorizedResolver {
        AutomatedOracle storage oracle = automatedOracles[marketId];
        require(oracle.isActive, "Automated oracle not set");
        require(keccak256(bytes(oracle.dataSource)) == keccak256(bytes("chainlink")), "Not chainlink oracle");
        
        AggregatorV3Interface priceFeed = AggregatorV3Interface(oracle.chainlinkFeed);
        (, int256 price,,,) = priceFeed.latestRoundData();
        
        uint8 outcome;
        if (uint256(price) >= oracle.threshold) {
            outcome = 1; // YES
        } else {
            outcome = 2; // NO
        }
        
        predictionMarket.resolveMarket(marketId, outcome);
        emit MarketResolvedByOracle(marketId, outcome, 0);
    }
    
    /**
     * @dev Manual resolution for disputed cases (governance or trusted oracle)
     * @param marketId The market to resolve
     * @return outcome The determined outcome
     */
    function resolveDispute(uint256 marketId) internal view returns (uint8 outcome) {
        // This is a simplified version - in practice, this would involve:
        // 1. Governance voting
        // 2. Multiple trusted oracles
        // 3. Reputation-based resolution
        // 4. Economic incentives for correct resolution
        
        // For now, return the most common disputed outcome
        uint256[] storage disputeIds = marketDisputes[marketId];
        if (disputeIds.length == 0) return 3; // INVALID if no disputes
        
        uint256[4] memory outcomeCounts; // [0, YES, NO, INVALID]
        
        for (uint256 i = 0; i < disputeIds.length; i++) {
            Dispute storage dispute = disputes[disputeIds[i]];
            outcomeCounts[dispute.proposedOutcome]++;
        }
        
        // Return the outcome with most votes
        uint8 maxOutcome = 1;
        for (uint8 i = 2; i <= 3; i++) {
            if (outcomeCounts[i] > outcomeCounts[maxOutcome]) {
                maxOutcome = i;
            }
        }
        
        return maxOutcome;
    }
    
    /**
     * @dev Get resolution request details
     * @param requestId The request ID
     * @return request The resolution request
     */
    function getResolutionRequest(uint256 requestId) external view returns (OracleRequest memory request) {
        return resolutionRequests[requestId];
    }
    
    /**
     * @dev Get dispute details
     * @param disputeId The dispute ID
     * @return dispute The dispute
     */
    function getDispute(uint256 disputeId) external view returns (Dispute memory dispute) {
        return disputes[disputeId];
    }
    
    /**
     * @dev Get automated oracle configuration
     * @param marketId The market ID
     * @return oracle The automated oracle configuration
     */
    function getAutomatedOracle(uint256 marketId) external view returns (AutomatedOracle memory oracle) {
        return automatedOracles[marketId];
    }
    
    // Admin functions
    function setResolutionBond(uint256 _resolutionBond) external onlyOwner {
        resolutionBond = _resolutionBond;
    }
    
    function setDisputeBond(uint256 _disputeBond) external onlyOwner {
        disputeBond = _disputeBond;
    }
    
    function setDisputePeriod(uint256 _disputePeriod) external onlyOwner {
        disputePeriod = _disputePeriod;
    }
    
    function setAuthorizedResolver(address resolver, bool authorized) external onlyOwner {
        authorizedResolvers[resolver] = authorized;
    }
    
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
}
