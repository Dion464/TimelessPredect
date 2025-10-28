// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PricingAMM.sol";

contract ETHPredictionMarket is ReentrancyGuard, Ownable {
    PricingAMM public pricingAMM;
    struct Market {
        uint256 id;
        string question;
        string description;
        string category;
        uint256 endTime;
        uint256 resolutionTime;
        bool resolved;
        uint8 outcome; // 0 = not resolved, 1 = YES, 2 = NO, 3 = INVALID
        uint256 totalYesShares;
        uint256 totalNoShares;
        uint256 totalVolume;
        address creator;
        uint256 createdAt;
        bool active;
        // Polymarket-style orderbook pricing
        uint256 lastTradedPrice; // Last traded price in basis points (0-10000)
        uint256 yesBidPrice; // Best bid for YES in basis points
        uint256 yesAskPrice; // Best ask for YES in basis points
        uint256 noBidPrice;  // Best bid for NO in basis points
        uint256 noAskPrice;  // Best ask for NO in basis points
    }

    struct Position {
        uint256 yesShares;
        uint256 noShares;
        uint256 totalInvested;
    }

    struct Trade {
        uint256 marketId;
        address trader;
        bool isYes;
        uint256 shares;
        uint256 price;
        uint256 timestamp;
    }

    struct LimitOrder {
        uint256 marketId;
        address trader;
        bool isYes;
        uint256 price; // Price in basis points (0-10000)
        uint256 amount; // Amount in ETH
        uint256 timestamp;
        bool filled;
        bool cancelled;
    }

    // State variables
    uint256 public nextMarketId;
    uint256 public marketCreationFee; // Fee to create market
    uint256 public platformFeePercent; // Platform fee in basis points
    
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Position)) public positions;
    mapping(address => uint256[]) public userMarkets;
    
    uint256[] public activeMarketIds;
    Trade[] public allTrades;
    LimitOrder[] public allLimitOrders;
    mapping(uint256 => uint256[]) public marketLimitOrders; // marketId => order IDs
    
    // Events
    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string question,
        string category,
        uint256 endTime
    );
    
    event SharesPurchased(
        uint256 indexed marketId,
        address indexed buyer,
        bool isYes,
        uint256 shares,
        uint256 cost,
        uint256 newPrice
    );
    
    event SharesSold(
        uint256 indexed marketId,
        address indexed seller,
        bool isYes,
        uint256 shares,
        uint256 payout,
        uint256 newPrice
    );
    
    event MarketResolved(
        uint256 indexed marketId,
        uint8 outcome,
        uint256 totalPayout
    );
    
    event LimitOrderPlaced(uint256 indexed marketId, address indexed trader, bool isYes, uint256 price, uint256 amount);

    constructor(uint256 _marketCreationFee, uint256 _platformFeePercent) {
        nextMarketId = 1;
        marketCreationFee = _marketCreationFee;
        platformFeePercent = _platformFeePercent;
        
        // Deploy and initialize the pricing AMM with a unique salt
        // Use block.timestamp to ensure unique deployment
        bytes32 salt = keccak256(abi.encodePacked(block.timestamp, block.difficulty));
        pricingAMM = new PricingAMM{salt: salt}();
    }

    // Create a new prediction market
    function createMarket(
        string memory _question,
        string memory _description,
        string memory _category,
        uint256 _endTime,
        uint256 _resolutionTime
    ) external payable nonReentrant {
        require(msg.value >= marketCreationFee, "Insufficient market creation fee");
        require(_endTime > block.timestamp, "End time must be in future");
        require(_resolutionTime > _endTime, "Resolution time must be after end time");
        require(bytes(_question).length > 0, "Question cannot be empty");

        uint256 marketId = nextMarketId++;
        
        markets[marketId] = Market({
            id: marketId,
            question: _question,
            description: _description,
            category: _category,
            endTime: _endTime,
            resolutionTime: _resolutionTime,
            resolved: false,
            outcome: 0,
            totalYesShares: 0,
            totalNoShares: 0,
            totalVolume: 0,
            creator: msg.sender,
            createdAt: block.timestamp,
            active: true,
            // Initialize Polymarket-style pricing
            lastTradedPrice: 5000, // 50% initial price
            yesBidPrice: 0, // No initial bids
            yesAskPrice: 10000, // No initial asks
            noBidPrice: 0, // No initial bids
            noAskPrice: 10000 // No initial asks
        });

        activeMarketIds.push(marketId);
        userMarkets[msg.sender].push(marketId);

        // Initialize pricing AMM for this market
        pricingAMM.createMarket(marketId, 1 ether); // Initial liquidity of 1 ETH

        emit MarketCreated(marketId, msg.sender, _question, _category, _endTime);
    }

    // Buy shares (YES or NO)
    function buyShares(uint256 _marketId, bool _isYes) external payable nonReentrant {
        require(msg.value > 0, "Must send ETH to buy shares");
        Market storage market = markets[_marketId];
        require(market.active, "Market not active");
        require(!market.resolved, "Market already resolved");
        require(block.timestamp < market.endTime, "Market has ended");

        // Calculate platform fee
        uint256 platformFee = (msg.value * platformFeePercent) / 10000;
        uint256 investmentAmount = msg.value - platformFee;

        // Calculate shares using LMSR pricing
        uint256 shares = pricingAMM.calculateSharesToGive(_marketId, _isYes, investmentAmount);
        require(shares > 0, "No shares calculated");

        // Update market state
        if (_isYes) {
            market.totalYesShares += shares;
        } else {
            market.totalNoShares += shares;
        }
        market.totalVolume += msg.value;

        // Update user position
        Position storage position = positions[_marketId][msg.sender];
        if (_isYes) {
            position.yesShares += shares;
        } else {
            position.noShares += shares;
        }
        position.totalInvested += msg.value;

        // Update pricing AMM (don't send ETH, just update state)
        if (_isYes) {
            pricingAMM.buyYes{value: 0}(_marketId, investmentAmount);
        } else {
            pricingAMM.buyNo{value: 0}(_marketId, investmentAmount);
        }

        // Get current prices from AMM
        (uint256 yesPrice, uint256 noPrice) = pricingAMM.calculatePrice(_marketId);
        market.lastTradedPrice = _isYes ? yesPrice : noPrice;

        // Record trade
        allTrades.push(Trade({
            marketId: _marketId,
            trader: msg.sender,
            isYes: _isYes,
            shares: shares,
            price: _isYes ? yesPrice : noPrice,
            timestamp: block.timestamp
        }));

        emit SharesPurchased(_marketId, msg.sender, _isYes, shares, msg.value, _isYes ? yesPrice : noPrice);
    }

    // Sell shares
    function sellShares(uint256 _marketId, bool _isYes, uint256 _shares) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.active, "Market not active");
        require(!market.resolved, "Market already resolved");
        require(block.timestamp < market.endTime, "Market has ended");
        require(_shares > 0, "Must sell at least some shares");

        Position storage position = positions[_marketId][msg.sender];
        
        // Check user has enough shares
        if (_isYes) {
            require(position.yesShares >= _shares, "Insufficient YES shares");
        } else {
            require(position.noShares >= _shares, "Insufficient NO shares");
        }

        // Get current price before the sale
        (uint256 yesPrice, uint256 noPrice) = pricingAMM.calculatePrice(_marketId);
        uint256 currentPrice = _isYes ? yesPrice : noPrice;
        
        // Calculate payout: shares * currentPrice / 10000 (convert from basis points)
        // Apply a small fee (2%)
        uint256 payout = (_shares * currentPrice) / 10000;
        uint256 platformFee = (payout * 200) / 10000; // 2% fee
        uint256 userPayout = payout - platformFee;

        // Update user position FIRST (before any external calls to prevent reentrancy)
        if (_isYes) {
            position.yesShares -= _shares;
            market.totalYesShares -= _shares;
        } else {
            position.noShares -= _shares;
            market.totalNoShares -= _shares;
        }

        // Update PricingAMM to reflect the sell (decreases shares, affects pricing)
        if (_isYes) {
            pricingAMM.sellYes(_marketId, _shares);
        } else {
            pricingAMM.sellNo(_marketId, _shares);
        }

        // Update total volume
        market.totalVolume += payout;

        // Transfer ETH to user if there's balance, otherwise just update state
        if (address(this).balance >= userPayout) {
            payable(msg.sender).transfer(userPayout);
        } else if (address(this).balance > 0) {
            // Transfer what we can
            payable(msg.sender).transfer(address(this).balance);
        }
        // If no balance, the market is just transitioning without payout

        // Record trade
        allTrades.push(Trade({
            marketId: _marketId,
            trader: msg.sender,
            isYes: _isYes,
            shares: _shares,
            price: currentPrice,
            timestamp: block.timestamp
        }));

        emit SharesSold(_marketId, msg.sender, _isYes, _shares, userPayout, currentPrice);
    }

    // Resolve market (only owner or creator after resolution time)
    function resolveMarket(uint256 _marketId, uint8 _outcome) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.active, "Market not active");
        require(!market.resolved, "Market already resolved");
        require(_outcome >= 1 && _outcome <= 3, "Invalid outcome"); // 1=YES, 2=NO, 3=INVALID
        require(
            msg.sender == owner() || 
            (msg.sender == market.creator && block.timestamp >= market.resolutionTime),
            "Not authorized to resolve"
        );

        market.resolved = true;
        market.outcome = _outcome;
        market.active = false;

        // Remove from active markets
        for (uint i = 0; i < activeMarketIds.length; i++) {
            if (activeMarketIds[i] == _marketId) {
                activeMarketIds[i] = activeMarketIds[activeMarketIds.length - 1];
                activeMarketIds.pop();
                break;
            }
        }

        emit MarketResolved(_marketId, _outcome, market.totalVolume);
    }

    // Auto-resolve market with random outcome (automated resolution every 1.5 minutes)
    function autoResolveMarket(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.active, "Market not active");
        require(!market.resolved, "Market already resolved");
        require(msg.sender == owner(), "Only owner can auto-resolve");

        // Generate pseudo-random outcome (1=YES, 2=NO)
        // Using block data for randomness (not production-ready, but works for demo)
        uint256 randomNumber = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            _marketId,
            market.totalVolume,
            market.totalYesShares,
            market.totalNoShares
        )));
        
        // 50/50 chance for YES or NO
        uint8 outcome = (randomNumber % 2 == 0) ? 1 : 2; // 1=YES, 2=NO

        market.resolved = true;
        market.outcome = outcome;
        market.active = false;

        // Remove from active markets
        for (uint i = 0; i < activeMarketIds.length; i++) {
            if (activeMarketIds[i] == _marketId) {
                activeMarketIds[i] = activeMarketIds[activeMarketIds.length - 1];
                activeMarketIds.pop();
                break;
            }
        }

        emit MarketResolved(_marketId, outcome, market.totalVolume);
    }

    // Claim winnings after market resolution
    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        require(market.resolved, "Market not resolved");
        
        Position storage position = positions[_marketId][msg.sender];
        require(position.yesShares > 0 || position.noShares > 0, "No position in market");

        uint256 payout = 0;
        
        if (market.outcome == 1 && position.yesShares > 0) {
            // YES won
            payout = position.yesShares * 1 ether / (market.totalYesShares > 0 ? market.totalYesShares : 1);
            position.yesShares = 0;
        } else if (market.outcome == 2 && position.noShares > 0) {
            // NO won
            payout = position.noShares * 1 ether / (market.totalNoShares > 0 ? market.totalNoShares : 1);
            position.noShares = 0;
        } else if (market.outcome == 3) {
            // INVALID - refund proportionally
            uint256 totalShares = position.yesShares + position.noShares;
            payout = (position.totalInvested * totalShares) / (position.yesShares + position.noShares);
            position.yesShares = 0;
            position.noShares = 0;
        }

        require(payout > 0, "No winnings to claim");
        require(address(this).balance >= payout, "Insufficient contract balance");

        payable(msg.sender).transfer(payout);
    }

    // Calculate shares for purchase using AMM formula
    function calculateSharesForPurchase(uint256 _marketId, bool _isYes, uint256 _amount) public view returns (uint256) {
        Market storage market = markets[_marketId];
        
        if (market.totalYesShares == 0 && market.totalNoShares == 0) {
            // First trade - return amount directly as shares (1:1 ratio)
            return _amount;
        }

        // For simplicity, use a 1:1 ratio for now
        // This means 1 ETH invested = 1 share received
        // This is more predictable and user-friendly
        return _amount;
    }

    // Calculate payout for selling shares
    function calculatePayoutForSale(uint256 _marketId, bool _isYes, uint256 _shares) public view returns (uint256) {
        // For simplicity, use 1:1 ratio for selling too
        // This means 1 share = 1 ETH payout
        return _shares;
    }

    // Get current price (probability) for YES or NO using LMSR
    function getCurrentPrice(uint256 _marketId, bool _isYes) public view returns (uint256) {
        (uint256 yesPrice, uint256 noPrice) = pricingAMM.calculatePrice(_marketId);
        return _isYes ? yesPrice : noPrice;
    }

    // Place a limit order (Polymarket style)
    function placeLimitOrder(
        uint256 _marketId,
        bool _isYes,
        uint256 _price, // Price in basis points (0-10000)
        uint256 _amount // Amount in ETH
    ) external payable nonReentrant {
        Market storage market = markets[_marketId];
        require(market.active, "Market not active");
        require(!market.resolved, "Market already resolved");
        require(block.timestamp < market.endTime, "Market has ended");
        require(_price > 0 && _price <= 10000, "Invalid price");
        require(msg.value >= _amount, "Insufficient payment");
        require(_amount > 0, "Amount must be positive");

        // Create limit order
        uint256 orderId = allLimitOrders.length;
        allLimitOrders.push(LimitOrder({
            marketId: _marketId,
            trader: msg.sender,
            isYes: _isYes,
            price: _price,
            amount: _amount,
            timestamp: block.timestamp,
            filled: false,
            cancelled: false
        }));

        marketLimitOrders[_marketId].push(orderId);

        // Update orderbook (simplified - in real Polymarket this would be more complex)
        if (_isYes) {
            if (_price > market.yesBidPrice) {
                market.yesBidPrice = _price;
            }
            if (_price < market.yesAskPrice) {
                market.yesAskPrice = _price;
            }
        } else {
            if (_price > market.noBidPrice) {
                market.noBidPrice = _price;
            }
            if (_price < market.noAskPrice) {
                market.noAskPrice = _price;
            }
        }

        emit LimitOrderPlaced(_marketId, msg.sender, _isYes, _price, _amount);
    }

    // View functions
    function getMarket(uint256 _marketId) external view returns (Market memory) {
        return markets[_marketId];
    }

    function getActiveMarkets() external view returns (uint256[] memory) {
        return activeMarketIds;
    }

    function getUserPosition(uint256 _marketId, address _user) external view returns (Position memory) {
        return positions[_marketId][_user];
    }

    function getUserMarkets(address _user) external view returns (uint256[] memory) {
        return userMarkets[_user];
    }

    function getRecentTrades(uint256 _marketId, uint256 _limit) external view returns (Trade[] memory) {
        uint256 count = 0;
        for (uint i = allTrades.length; i > 0 && count < _limit; i--) {
            if (allTrades[i-1].marketId == _marketId) {
                count++;
            }
        }

        Trade[] memory trades = new Trade[](count);
        uint256 index = 0;
        for (uint i = allTrades.length; i > 0 && index < count; i--) {
            if (allTrades[i-1].marketId == _marketId) {
                trades[index] = allTrades[i-1];
                index++;
            }
        }
        return trades;
    }

    // Admin functions
    function setMarketCreationFee(uint256 _fee) external onlyOwner {
        marketCreationFee = _fee;
    }

    function setPlatformFeePercent(uint256 _feePercent) external onlyOwner {
        require(_feePercent <= 1000, "Fee too high"); // Max 10%
        platformFeePercent = _feePercent;
    }

    function withdrawFees() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // Emergency functions
    function emergencyPause(uint256 _marketId) external onlyOwner {
        markets[_marketId].active = false;
    }

    function emergencyUnpause(uint256 _marketId) external onlyOwner {
        markets[_marketId].active = true;
    }
}
