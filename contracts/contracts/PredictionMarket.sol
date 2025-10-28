// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PredictionMarket
 * @dev Main contract for decentralized prediction markets
 * @notice Handles market creation, trading, and resolution
 */
contract PredictionMarket is ReentrancyGuard, Ownable, Pausable {
    
    // Market structure
    struct Market {
        uint256 id;
        string questionTitle;
        string description;
        address creator;
        uint256 creationTime;
        uint256 resolutionTime;
        uint256 finalResolutionTime;
        bool isResolved;
        uint8 outcome; // 0 = unresolved, 1 = YES, 2 = NO, 3 = INVALID
        uint256 totalYesShares;
        uint256 totalNoShares;
        uint256 totalVolume;
        uint256 creatorFee; // in basis points (100 = 1%)
        bool isActive;
        string category;
        address oracle; // Oracle address for resolution
    }
    
    // Position structure for users
    struct Position {
        uint256 yesShares;
        uint256 noShares;
        uint256 totalInvested;
    }
    
    // Order structure for order book
    struct Order {
        uint256 id;
        address trader;
        uint256 marketId;
        bool isYes; // true for YES, false for NO
        uint256 shares;
        uint256 price; // price per share in wei
        uint256 timestamp;
        bool isActive;
    }
    
    // Events
    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string questionTitle,
        uint256 resolutionTime
    );
    
    event SharesPurchased(
        uint256 indexed marketId,
        address indexed buyer,
        bool isYes,
        uint256 shares,
        uint256 cost
    );
    
    event SharesSold(
        uint256 indexed marketId,
        address indexed seller,
        bool isYes,
        uint256 shares,
        uint256 payout
    );
    
    event MarketResolved(
        uint256 indexed marketId,
        uint8 outcome,
        address indexed oracle
    );
    
    event OrderPlaced(
        uint256 indexed orderId,
        uint256 indexed marketId,
        address indexed trader,
        bool isYes,
        uint256 shares,
        uint256 price
    );
    
    event OrderMatched(
        uint256 indexed orderId,
        uint256 indexed marketId,
        address indexed buyer,
        uint256 shares,
        uint256 price
    );
    
    // State variables
    IERC20 public paymentToken; // USDC or similar stablecoin
    uint256 public nextMarketId = 1;
    uint256 public nextOrderId = 1;
    uint256 public platformFee = 200; // 2% in basis points
    uint256 public constant MAX_FEE = 1000; // 10% maximum fee
    
    // Mappings
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Position)) public positions;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => uint256[]) public marketOrders; // marketId => orderIds
    mapping(address => bool) public authorizedOracles;
    mapping(uint256 => mapping(bool => uint256[])) public orderBook; // marketId => isYes => orderIds
    
    // Modifiers
    modifier onlyOracle(uint256 marketId) {
        require(
            authorizedOracles[msg.sender] || msg.sender == markets[marketId].oracle,
            "Not authorized oracle"
        );
        _;
    }
    
    modifier marketExists(uint256 marketId) {
        require(marketId < nextMarketId && markets[marketId].isActive, "Market does not exist");
        _;
    }
    
    modifier marketNotResolved(uint256 marketId) {
        require(!markets[marketId].isResolved, "Market already resolved");
        _;
    }
    
    constructor(address _paymentToken) {
        paymentToken = IERC20(_paymentToken);
    }
    
    /**
     * @dev Create a new prediction market
     * @param questionTitle The question being predicted
     * @param description Detailed description of the market
     * @param resolutionTime When the market should be resolved
     * @param finalResolutionTime Final deadline for resolution
     * @param creatorFee Fee percentage for market creator (in basis points)
     * @param category Market category
     * @param oracle Address authorized to resolve this market
     */
    function createMarket(
        string memory questionTitle,
        string memory description,
        uint256 resolutionTime,
        uint256 finalResolutionTime,
        uint256 creatorFee,
        string memory category,
        address oracle
    ) external whenNotPaused returns (uint256) {
        require(resolutionTime > block.timestamp, "Resolution time must be in future");
        require(finalResolutionTime > resolutionTime, "Final resolution must be after resolution");
        require(creatorFee <= MAX_FEE, "Creator fee too high");
        require(bytes(questionTitle).length > 0, "Question title required");
        
        uint256 marketId = nextMarketId++;
        
        markets[marketId] = Market({
            id: marketId,
            questionTitle: questionTitle,
            description: description,
            creator: msg.sender,
            creationTime: block.timestamp,
            resolutionTime: resolutionTime,
            finalResolutionTime: finalResolutionTime,
            isResolved: false,
            outcome: 0,
            totalYesShares: 0,
            totalNoShares: 0,
            totalVolume: 0,
            creatorFee: creatorFee,
            isActive: true,
            category: category,
            oracle: oracle
        });
        
        emit MarketCreated(marketId, msg.sender, questionTitle, resolutionTime);
        return marketId;
    }
    
    /**
     * @dev Buy shares in a market using AMM pricing
     * @param marketId The market to buy shares in
     * @param isYes True for YES shares, false for NO shares
     * @param amount Amount of payment token to spend
     * @param minShares Minimum shares to receive (slippage protection)
     */
    function buyShares(
        uint256 marketId,
        bool isYes,
        uint256 amount,
        uint256 minShares
    ) external marketExists(marketId) marketNotResolved(marketId) nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be positive");
        
        Market storage market = markets[marketId];
        require(block.timestamp < market.resolutionTime, "Market closed for trading");
        
        // Calculate shares using constant product AMM formula
        uint256 shares = calculateSharesFromAmount(marketId, isYes, amount);
        require(shares >= minShares, "Slippage too high");
        
        // Transfer payment token from user
        require(paymentToken.transferFrom(msg.sender, address(this), amount), "Payment failed");
        
        // Update market state
        if (isYes) {
            market.totalYesShares += shares;
        } else {
            market.totalNoShares += shares;
        }
        market.totalVolume += amount;
        
        // Update user position
        Position storage position = positions[marketId][msg.sender];
        if (isYes) {
            position.yesShares += shares;
        } else {
            position.noShares += shares;
        }
        position.totalInvested += amount;
        
        emit SharesPurchased(marketId, msg.sender, isYes, shares, amount);
    }
    
    /**
     * @dev Sell shares back to the AMM
     * @param marketId The market to sell shares in
     * @param isYes True for YES shares, false for NO shares
     * @param shares Number of shares to sell
     * @param minPayout Minimum payout to receive (slippage protection)
     */
    function sellShares(
        uint256 marketId,
        bool isYes,
        uint256 shares,
        uint256 minPayout
    ) external marketExists(marketId) marketNotResolved(marketId) nonReentrant whenNotPaused {
        require(shares > 0, "Shares must be positive");
        
        Position storage position = positions[marketId][msg.sender];
        if (isYes) {
            require(position.yesShares >= shares, "Insufficient YES shares");
        } else {
            require(position.noShares >= shares, "Insufficient NO shares");
        }
        
        Market storage market = markets[marketId];
        require(block.timestamp < market.resolutionTime, "Market closed for trading");
        
        // Calculate payout using AMM formula
        uint256 payout = calculatePayoutFromShares(marketId, isYes, shares);
        require(payout >= minPayout, "Slippage too high");
        
        // Update market state
        if (isYes) {
            market.totalYesShares -= shares;
            position.yesShares -= shares;
        } else {
            market.totalNoShares -= shares;
            position.noShares -= shares;
        }
        
        // Calculate fees
        uint256 platformFeeAmount = (payout * platformFee) / 10000;
        uint256 creatorFeeAmount = (payout * market.creatorFee) / 10000;
        uint256 userPayout = payout - platformFeeAmount - creatorFeeAmount;
        
        // Transfer payouts
        require(paymentToken.transfer(msg.sender, userPayout), "Payout failed");
        if (creatorFeeAmount > 0) {
            require(paymentToken.transfer(market.creator, creatorFeeAmount), "Creator fee failed");
        }
        
        emit SharesSold(marketId, msg.sender, isYes, shares, userPayout);
    }
    
    /**
     * @dev Resolve a market (only callable by authorized oracle)
     * @param marketId The market to resolve
     * @param outcome The resolution outcome (1 = YES, 2 = NO, 3 = INVALID)
     */
    function resolveMarket(
        uint256 marketId,
        uint8 outcome
    ) external marketExists(marketId) marketNotResolved(marketId) onlyOracle(marketId) {
        require(outcome >= 1 && outcome <= 3, "Invalid outcome");
        require(block.timestamp >= markets[marketId].resolutionTime, "Too early to resolve");
        
        Market storage market = markets[marketId];
        market.isResolved = true;
        market.outcome = outcome;
        
        emit MarketResolved(marketId, outcome, msg.sender);
    }
    
    /**
     * @dev Claim winnings after market resolution
     * @param marketId The resolved market
     */
    function claimWinnings(
        uint256 marketId
    ) external marketExists(marketId) nonReentrant {
        Market storage market = markets[marketId];
        require(market.isResolved, "Market not resolved");
        
        Position storage position = positions[marketId][msg.sender];
        require(position.yesShares > 0 || position.noShares > 0, "No position to claim");
        
        uint256 payout = 0;
        
        if (market.outcome == 1) { // YES won
            payout = position.yesShares;
        } else if (market.outcome == 2) { // NO won
            payout = position.noShares;
        } else if (market.outcome == 3) { // INVALID - refund proportionally
            uint256 totalShares = market.totalYesShares + market.totalNoShares;
            if (totalShares > 0) {
                uint256 userShares = position.yesShares + position.noShares;
                payout = (market.totalVolume * userShares) / totalShares;
            }
        }
        
        // Clear position
        position.yesShares = 0;
        position.noShares = 0;
        
        if (payout > 0) {
            require(paymentToken.transfer(msg.sender, payout), "Payout failed");
        }
    }
    
    /**
     * @dev Calculate shares received for a given payment amount using AMM
     * @param marketId The market
     * @param isYes True for YES shares, false for NO shares
     * @param amount Payment amount
     * @return shares Number of shares that would be received
     */
    function calculateSharesFromAmount(
        uint256 marketId,
        bool isYes,
        uint256 amount
    ) public view returns (uint256 shares) {
        Market storage market = markets[marketId];
        
        // Simple constant product AMM: x * y = k
        // Where x = YES pool, y = NO pool
        uint256 yesPool = market.totalYesShares + 1000 ether; // Add liquidity buffer
        uint256 noPool = market.totalNoShares + 1000 ether;
        uint256 k = yesPool * noPool;
        
        if (isYes) {
            // Calculate new YES pool after adding amount
            uint256 newYesPool = yesPool + amount;
            uint256 newNoPool = k / newYesPool;
            shares = noPool - newNoPool;
        } else {
            // Calculate new NO pool after adding amount
            uint256 newNoPool = noPool + amount;
            uint256 newYesPool = k / newNoPool;
            shares = yesPool - newYesPool;
        }
    }
    
    /**
     * @dev Calculate payout for selling shares using AMM
     * @param marketId The market
     * @param isYes True for YES shares, false for NO shares
     * @param shares Number of shares to sell
     * @return payout Amount of payment token that would be received
     */
    function calculatePayoutFromShares(
        uint256 marketId,
        bool isYes,
        uint256 shares
    ) public view returns (uint256 payout) {
        Market storage market = markets[marketId];
        
        uint256 yesPool = market.totalYesShares + 1000 ether;
        uint256 noPool = market.totalNoShares + 1000 ether;
        uint256 k = yesPool * noPool;
        
        if (isYes) {
            uint256 newYesPool = yesPool - shares;
            uint256 newNoPool = k / newYesPool;
            payout = newNoPool - noPool;
        } else {
            uint256 newNoPool = noPool - shares;
            uint256 newYesPool = k / newNoPool;
            payout = newYesPool - yesPool;
        }
    }
    
    /**
     * @dev Get current market price for YES shares
     * @param marketId The market
     * @return price Current price of YES shares (0-1000000, representing 0-100%)
     */
    function getCurrentPrice(uint256 marketId) external view returns (uint256 price) {
        Market storage market = markets[marketId];
        uint256 yesPool = market.totalYesShares + 1000 ether;
        uint256 noPool = market.totalNoShares + 1000 ether;
        
        // Price = noPool / (yesPool + noPool)
        price = (noPool * 1000000) / (yesPool + noPool);
    }
    
    /**
     * @dev Get user's position in a market
     * @param marketId The market
     * @param user The user address
     * @return yesShares Number of YES shares owned
     * @return noShares Number of NO shares owned
     * @return totalInvested Total amount invested
     */
    function getUserPosition(
        uint256 marketId,
        address user
    ) external view returns (uint256 yesShares, uint256 noShares, uint256 totalInvested) {
        Position storage position = positions[marketId][user];
        return (position.yesShares, position.noShares, position.totalInvested);
    }
    
    /**
     * @dev Get market information
     * @param marketId The market
     * @return market Market struct
     */
    function getMarket(uint256 marketId) external view returns (Market memory market) {
        return markets[marketId];
    }
    
    // Admin functions
    function setPlatformFee(uint256 _platformFee) external onlyOwner {
        require(_platformFee <= MAX_FEE, "Fee too high");
        platformFee = _platformFee;
    }
    
    function setAuthorizedOracle(address oracle, bool authorized) external onlyOwner {
        authorizedOracles[oracle] = authorized;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = paymentToken.balanceOf(address(this));
        require(paymentToken.transfer(owner(), balance), "Withdrawal failed");
    }
}
