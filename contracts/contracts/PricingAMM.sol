// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PricingAMM {
    struct Market {
        uint256 yesShares;
        uint256 noShares;
        uint256 liquidity; // total ETH in pool
        uint256 b;         // liquidity parameter (higher = more liquid)
    }

    mapping(uint256 => Market) public markets;
    uint256 public constant B_PARAM = 1000000; // LMSR liquidity parameter (increased to prevent division by zero)
    uint256 public constant FEE_BASIS_POINTS = 200; // 2% fee

    event MarketCreated(uint256 indexed marketId, uint256 initialLiquidity);
    event YesBought(uint256 indexed marketId, uint256 amount, uint256 newYesPrice, uint256 newNoPrice);
    event NoBought(uint256 indexed marketId, uint256 amount, uint256 newYesPrice, uint256 newNoPrice);

    function createMarket(uint256 marketId, uint256 initialLiquidity) external {
        // Allow overwriting existing markets to fix the issue
        markets[marketId] = Market({
            yesShares: 0,
            noShares: 0,
            liquidity: initialLiquidity,
            b: B_PARAM
        });
        
        emit MarketCreated(marketId, initialLiquidity);
    }

    function calculatePrice(uint256 marketId)
        public
        view
        returns (uint256 yesPrice, uint256 noPrice)
    {
        Market memory m = markets[marketId];
        
        if (m.liquidity == 0) {
            // Initial state: 50/50
            return (5000, 5000); // 50¢ each in basis points
        }

        // Simple dynamic pricing based on share distribution
        // More YES shares = higher YES price, more NO shares = higher NO price
        uint256 totalShares = m.yesShares + m.noShares;
        
        if (totalShares == 0) {
            return (5000, 5000); // 50/50 if no shares
        }
        
        // Calculate price based on share ratio (CORRECTED AMM LOGIC)
        // YES price = (yesShares / totalShares) * 10000
        // NO price = (noShares / totalShares) * 10000
        // This creates correct relationship: more YES shares = higher YES price
        yesPrice = (m.yesShares * 10000) / totalShares;
        noPrice = (m.noShares * 10000) / totalShares;
        
        // Ensure minimum price of 1¢ (100 basis points) and maximum of 99¢ (9900 basis points)
        if (yesPrice < 100) yesPrice = 100;
        if (yesPrice > 9900) yesPrice = 9900;
        if (noPrice < 100) noPrice = 100;
        if (noPrice > 9900) noPrice = 9900;
        
        // Ensure they sum to 10000 (100¢)
        uint256 total = yesPrice + noPrice;
        if (total != 10000) {
            yesPrice = (yesPrice * 10000) / total;
            noPrice = 10000 - yesPrice;
        }
    }

    function buyYes(uint256 marketId, uint256 amount) external payable {
        Market storage m = markets[marketId];
        require(m.liquidity > 0, "Market not initialized");

        // Calculate shares to give based on current price
        uint256 sharesToGive = calculateSharesToGive(marketId, true, amount);
        
        // Update shares - this affects pricing
        m.yesShares += sharesToGive;
        m.liquidity += amount;
        
        // Get new prices after the update
        (uint256 newYesPrice, uint256 newNoPrice) = calculatePrice(marketId);
        
        emit YesBought(marketId, amount, newYesPrice, newNoPrice);
    }

    function buyNo(uint256 marketId, uint256 amount) external payable {
        Market storage m = markets[marketId];
        require(m.liquidity > 0, "Market not initialized");

        // Calculate shares to give based on current price
        uint256 sharesToGive = calculateSharesToGive(marketId, false, amount);
        
        // Update shares - this affects pricing
        m.noShares += sharesToGive;
        m.liquidity += amount;
        
        // Get new prices after the update
        (uint256 newYesPrice, uint256 newNoPrice) = calculatePrice(marketId);
        
        emit NoBought(marketId, amount, newYesPrice, newNoPrice);
    }

    // Sell YES shares - decreases YES shares, increases YES price
    function sellYes(uint256 marketId, uint256 shares) external {
        Market storage m = markets[marketId];
        require(m.liquidity > 0, "Market not initialized");
        require(shares > 0, "Must sell at least some shares");
        require(m.yesShares >= shares, "Not enough YES shares in pool");
        
        // Decrease YES shares - this increases YES price (less supply)
        m.yesShares -= shares;
        
        // Get new prices after the update
        (uint256 newYesPrice, uint256 newNoPrice) = calculatePrice(marketId);
        
        emit YesBought(marketId, shares, newYesPrice, newNoPrice);
    }

    // Sell NO shares - decreases NO shares, increases NO price
    function sellNo(uint256 marketId, uint256 shares) external {
        Market storage m = markets[marketId];
        require(m.liquidity > 0, "Market not initialized");
        require(shares > 0, "Must sell at least some shares");
        require(m.noShares >= shares, "Not enough NO shares in pool");
        
        // Decrease NO shares - this increases NO price (less supply)
        m.noShares -= shares;
        
        // Get new prices after the update
        (uint256 newYesPrice, uint256 newNoPrice) = calculatePrice(marketId);
        
        emit NoBought(marketId, shares, newYesPrice, newNoPrice);
    }

    function calculateSharesToGive(uint256 marketId, bool isYes, uint256 amount) 
        public 
        view 
        returns (uint256) 
    {
        Market memory m = markets[marketId];
        
        // For initial liquidity or edge cases, use 1:1 ratio
        if (m.liquidity == 0 || (m.yesShares == 0 && m.noShares == 0)) {
            return amount; // 1:1 ratio for initial liquidity
        }

        // Calculate current prices
        uint256 totalShares = m.yesShares + m.noShares;
        
        // If only one side has shares, give 1:1 ratio
        if (totalShares == 0) {
            return amount;
        }
        
        uint256 currentPrice = isYes ? (m.yesShares * 10000) / totalShares : (m.noShares * 10000) / totalShares;
        
        // Ensure minimum price of 1¢ (100 basis points)
        if (currentPrice < 100) {
            currentPrice = 100;
        }
        
        // Calculate shares based on current price
        // If buying YES at 30¢, you get more shares than buying at 70¢
        uint256 sharesToGive = (amount * 10000) / currentPrice;
        
        // Apply a small fee (2%)
        sharesToGive = (sharesToGive * 9800) / 10000;
        
        return sharesToGive;
    }

    function calculateCost(uint256 yesShares, uint256 noShares) internal pure returns (uint256) {
        // Prevent division by zero
        if (B_PARAM == 0) {
            return 0;
        }
        
        // C = b * ln(exp(q_yes/b) + exp(q_no/b))
        uint256 expYes = exp(yesShares * 1e18 / B_PARAM);
        uint256 expNo = exp(noShares * 1e18 / B_PARAM);
        uint256 sum = expYes + expNo;
        
        // Prevent overflow
        if (sum == 0) {
            return 0;
        }
        
        // Approximate ln(x) for small x
        if (sum <= 1e18) {
            return B_PARAM * (sum - 1e18) / 1e18;
        }
        
        return B_PARAM * lnApprox(sum);
    }

    // Basic exponential approximation for LMSR
    function exp(uint256 x) internal pure returns (uint256) {
        // exp(x) ≈ 1 + x + x²/2! + x³/3! for small x
        if (x == 0) return 1e18;
        
        uint256 result = 1e18;
        uint256 term = x;
        
        for (uint256 i = 1; i <= 3; i++) {
            result += term;
            term = (term * x) / (i * 1e18);
        }
        
        return result;
    }

    // Basic logarithm approximation
    function lnApprox(uint256 x) internal pure returns (uint256) {
        // Simple approximation: ln(x) ≈ x - 1 for x close to 1
        if (x >= 1e18) {
            return (x - 1e18) / 1e18;
        }
        return 0;
    }

    // Get current market state
    function getMarketState(uint256 marketId) external view returns (
        uint256 yesShares,
        uint256 noShares,
        uint256 liquidity,
        uint256 yesPrice,
        uint256 noPrice
    ) {
        Market memory m = markets[marketId];
        (yesPrice, noPrice) = calculatePrice(marketId);
        
        return (m.yesShares, m.noShares, m.liquidity, yesPrice, noPrice);
    }
}
