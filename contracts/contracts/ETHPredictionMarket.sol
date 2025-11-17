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
    
    // Optimistic Oracle Resolution System
    struct ResolutionProposal {
        uint8 proposedOutcome; // 1=YES, 2=NO, 3=INVALID
        address proposer;
        uint256 proposalTime;
        uint256 proposerBond;
        bool disputed;
        address disputer;
        uint256 disputeTime;
        uint256 disputerBond;
        bool finalized;
    }
    
    mapping(uint256 => ResolutionProposal) public resolutionProposals;
    uint256 public proposerBondAmount = 0.01 ether; // Default bond amount (0.01 ETH)
    uint256 public disputePeriod = 1 days; // Default dispute period (1 day)
    uint256 public disputerBondMultiplier = 2; // Disputer must post 2x the proposer bond
    
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
    
    // Optimistic Oracle Events
    event ResolutionProposed(
        uint256 indexed marketId,
        address indexed proposer,
        uint8 proposedOutcome,
        uint256 proposalTime,
        uint256 bond
    );
    
    event ResolutionDisputed(
        uint256 indexed marketId,
        address indexed disputer,
        uint256 disputeTime,
        uint256 bond
    );
    
    event ResolutionFinalized(
        uint256 indexed marketId,
        uint8 finalOutcome,
        address indexed finalizer
    );

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

        // Ensure AMM market is properly initialized before proceeding
        // Check liquidity to verify market exists in AMM
        (,, uint256 ammLiquidity,) = pricingAMM.markets(_marketId);
        require(ammLiquidity > 0, "AMM market not initialized - please wait for market creation to complete");

        // Update AMM state to current market state BEFORE calculating shares
        pricingAMM.updateMarketState(_marketId, market.totalYesShares, market.totalNoShares);
        
        // Calculate platform fee
        uint256 platformFee;
        uint256 investmentAmount;
        unchecked {
            platformFee = (msg.value * platformFeePercent) / 10000;
            investmentAmount = msg.value - platformFee;
        }

        // Calculate shares based on current price
        // If price is 50¢, then 0.1 ETH should buy ~0.2 shares
        // Formula: shares = (investmentAmount * priceMultiplier) / currentPrice
        // where currentPrice is in basis points (5000 = 50¢)
        
        uint256 shares;
        unchecked {
            // Get current price from AMM
            (uint256 currentYesPrice, uint256 currentNoPrice) = pricingAMM.calculatePrice(_marketId);
            
            // Ensure AMM returned valid prices (should always return at least 5000 for initial state)
            require(currentYesPrice > 0 && currentNoPrice > 0, "AMM price calculation failed");
            uint256 currentPrice = _isYes ? currentYesPrice : currentNoPrice;
            
            // CRITICAL: Prevent trading when price is at extreme values
            // Prices are clamped to 100-9900 basis points (1%-99%) but double-check here
            require(currentPrice >= 100 && currentPrice <= 9900, "Price at extreme, trading disabled");
            require(currentPrice > 0, "Invalid price");
            
            // Calculate shares: investmentAmount / (currentPrice / 10000)
            // Example: 0.1 ETH / (5000/10000) = 0.1 ETH / 0.5 = 0.2 shares
            // To avoid division loss: shares = (investmentAmount * 10000) / currentPrice
            // But we need to protect against overflow
            
            // Correct calculation: at 50¢ price, 0.1 ETH buys 0.2 shares
            // Formula: shares = investmentAmount * 10000 / currentPrice
            // Example: (0.1 * 10000) / 5000 = 1000 / 5000 = 0.2
            // Need to scale properly for wei amounts
            shares = (investmentAmount * 10000) / currentPrice;
            
            // Apply 98% to account for fees/slippage
            shares = (shares * 9800) / 10000;
            
            // Ensure minimum
            if (shares == 0) {
                shares = 1;
            }
        }
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

        // Update AMM state again with the new totals AFTER adding shares
        pricingAMM.updateMarketState(_marketId, market.totalYesShares, market.totalNoShares);
        
        // Get current prices from AMM
        (uint256 finalYesPrice, uint256 finalNoPrice) = pricingAMM.calculatePrice(_marketId);
        market.lastTradedPrice = _isYes ? finalYesPrice : finalNoPrice;

        // Record trade
        allTrades.push(Trade({
            marketId: _marketId,
            trader: msg.sender,
            isYes: _isYes,
            shares: shares,
            price: _isYes ? finalYesPrice : finalNoPrice,
            timestamp: block.timestamp
        }));

        emit SharesPurchased(_marketId, msg.sender, _isYes, shares, msg.value, _isYes ? finalYesPrice : finalNoPrice);
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
        (uint256 currentYesPrice, uint256 currentNoPrice) = pricingAMM.calculatePrice(_marketId);
        uint256 currentPrice = _isYes ? currentYesPrice : currentNoPrice;
        
        // CRITICAL: Prevent trading when price is at extreme values
        require(currentPrice >= 100 && currentPrice <= 9900, "Price at extreme, trading disabled");
        require(currentPrice > 0, "Invalid price");
        
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

        // Update AMM state to match our market state for accurate price calculations
        pricingAMM.updateMarketState(_marketId, market.totalYesShares, market.totalNoShares);

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

    // ============ Optimistic Oracle Resolution Functions ============
    
    /**
     * @dev Propose a resolution for a market (anyone can propose with bond)
     * @param _marketId The market to propose resolution for
     * @param _proposedOutcome The outcome being proposed (1=YES, 2=NO, 3=INVALID)
     */
    function proposeResolution(uint256 _marketId, uint8 _proposedOutcome) external payable nonReentrant {
        Market storage market = markets[_marketId];
        require(market.active, "Market not active");
        require(!market.resolved, "Market already resolved");
        require(_proposedOutcome >= 1 && _proposedOutcome <= 3, "Invalid outcome");
        require(block.timestamp >= market.resolutionTime, "Market not ready for resolution");
        require(msg.value >= proposerBondAmount, "Insufficient bond amount");
        
        ResolutionProposal storage proposal = resolutionProposals[_marketId];
        require(proposal.proposer == address(0) || proposal.finalized, "Proposal already exists or disputed");
        
        // If there was a previous proposal that was disputed, create new one
        if (proposal.disputed) {
            // Previous proposal was disputed, allow new proposal
            delete resolutionProposals[_marketId];
        }
        
        // Create new proposal
        proposal.proposedOutcome = _proposedOutcome;
        proposal.proposer = msg.sender;
        proposal.proposalTime = block.timestamp;
        proposal.proposerBond = msg.value;
        proposal.disputed = false;
        proposal.finalized = false;
        
        emit ResolutionProposed(_marketId, msg.sender, _proposedOutcome, block.timestamp, msg.value);
    }
    
    /**
     * @dev Dispute a proposed resolution (requires posting bond)
     * @param _marketId The market with the proposal to dispute
     */
    function disputeResolution(uint256 _marketId) external payable nonReentrant {
        ResolutionProposal storage proposal = resolutionProposals[_marketId];
        require(proposal.proposer != address(0), "No proposal exists");
        require(!proposal.disputed, "Already disputed");
        require(!proposal.finalized, "Already finalized");
        require(block.timestamp < proposal.proposalTime + disputePeriod, "Dispute period expired");
        
        uint256 requiredBond = proposal.proposerBond * disputerBondMultiplier;
        require(msg.value >= requiredBond, "Insufficient dispute bond");
        
        proposal.disputed = true;
        proposal.disputer = msg.sender;
        proposal.disputeTime = block.timestamp;
        proposal.disputerBond = msg.value;
        
        // Return proposer's bond to them (they lost)
        if (proposal.proposerBond > 0) {
            payable(proposal.proposer).transfer(proposal.proposerBond);
            proposal.proposerBond = 0;
        }
        
        emit ResolutionDisputed(_marketId, msg.sender, block.timestamp, msg.value);
        
        // Clear the proposal to allow new proposal
        delete resolutionProposals[_marketId];
    }
    
    /**
     * @dev Finalize a resolution if dispute period has passed
     * @param _marketId The market to finalize resolution for
     */
    function finalizeResolution(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        ResolutionProposal storage proposal = resolutionProposals[_marketId];
        
        require(proposal.proposer != address(0), "No proposal exists");
        require(!proposal.disputed, "Proposal was disputed");
        require(!proposal.finalized, "Already finalized");
        require(block.timestamp >= proposal.proposalTime + disputePeriod, "Dispute period not expired");
        require(!market.resolved, "Market already resolved");
        
        // Finalize the resolution
        proposal.finalized = true;
        market.resolved = true;
        market.outcome = proposal.proposedOutcome;
        market.active = false;
        
        // Return proposer's bond as reward for correct resolution
        if (proposal.proposerBond > 0) {
            payable(proposal.proposer).transfer(proposal.proposerBond);
        }
        
        // Remove from active markets
        for (uint i = 0; i < activeMarketIds.length; i++) {
            if (activeMarketIds[i] == _marketId) {
                activeMarketIds[i] = activeMarketIds[activeMarketIds.length - 1];
                activeMarketIds.pop();
                break;
            }
        }
        
        emit ResolutionFinalized(_marketId, proposal.proposedOutcome, msg.sender);
        emit MarketResolved(_marketId, proposal.proposedOutcome, market.totalVolume);
    }
    
    /**
     * @dev Get resolution proposal details
     * @param _marketId The market ID
     */
    function getResolutionProposal(uint256 _marketId) external view returns (
        uint8 proposedOutcome,
        address proposer,
        uint256 proposalTime,
        uint256 proposerBond,
        bool disputed,
        address disputer,
        uint256 disputeTime,
        bool finalized,
        uint256 timeUntilFinalizable
    ) {
        ResolutionProposal memory proposal = resolutionProposals[_marketId];
        uint256 finalizableTime = proposal.proposalTime + disputePeriod;
        
        return (
            proposal.proposedOutcome,
            proposal.proposer,
            proposal.proposalTime,
            proposal.proposerBond,
            proposal.disputed,
            proposal.disputer,
            proposal.disputeTime,
            proposal.finalized,
            block.timestamp >= finalizableTime ? 0 : finalizableTime - block.timestamp
        );
    }
    
    // ============ Admin Functions for Optimistic Oracle ============
    
    /**
     * @dev Set the proposer bond amount (only owner)
     */
    function setProposerBondAmount(uint256 _amount) external onlyOwner {
        proposerBondAmount = _amount;
    }
    
    /**
     * @dev Set the dispute period (only owner)
     */
    function setDisputePeriod(uint256 _period) external onlyOwner {
        disputePeriod = _period;
    }
    
    /**
     * @dev Set the disputer bond multiplier (only owner)
     */
    function setDisputerBondMultiplier(uint256 _multiplier) external onlyOwner {
        disputerBondMultiplier = _multiplier;
    }
    
    // ============ Legacy Resolution Functions (for backward compatibility) ============
    
    /**
     * @dev Resolve market (only owner or creator after resolution time) - LEGACY
     * Still available but recommend using optimistic oracle instead
     */
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

        // Clear any existing proposals
        delete resolutionProposals[_marketId];

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
            // YES won - pay 1 TCENT (1 ether) per share
            payout = position.yesShares; // 1 ether per share directly
            position.yesShares = 0;
        } else if (market.outcome == 2 && position.noShares > 0) {
            // NO won - pay 1 TCENT (1 ether) per share
            payout = position.noShares; // 1 ether per share directly
            position.noShares = 0;
        } else if (market.outcome == 3) {
            // INVALID - refund proportionally
            uint256 totalShares = position.yesShares + position.noShares;
            if (totalShares > 0) {
                payout = (position.totalInvested * totalShares) / totalShares;
            }
            position.yesShares = 0;
            position.noShares = 0;
        } else {
            // User lost - no payout, shares are forfeited (contract keeps the funds)
            // Clear losing shares
            if (market.outcome == 1 && position.noShares > 0) {
                position.noShares = 0; // NO shares lost - forfeited to contract
            } else if (market.outcome == 2 && position.yesShares > 0) {
                position.yesShares = 0; // YES shares lost - forfeited to contract
            }
            // Payout remains 0 for losers
        }

        // Only require payout > 0 if user won (has winnings to claim)
        // If user lost, payout is 0 but we still clear their position
        if (payout > 0) {
            require(address(this).balance >= payout, "Insufficient contract balance");
            payable(msg.sender).transfer(payout);
        } else {
            // User lost - position is already cleared, but no payout
            // Allow this so users can "claim" to clear their losing position from the UI
        }
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
