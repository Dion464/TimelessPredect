const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PredictionMarket", function () {
  let predictionMarket;
  let predictionOracle;
  let mockUSDC;
  let owner;
  let user1;
  let user2;
  let oracle;

  beforeEach(async function () {
    [owner, user1, user2, oracle] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();
    await mockUSDC.deployed();

    // Deploy PredictionMarket
    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
    predictionMarket = await PredictionMarket.deploy(mockUSDC.address);
    await predictionMarket.deployed();

    // Deploy PredictionOracle
    const PredictionOracle = await ethers.getContractFactory("PredictionOracle");
    predictionOracle = await PredictionOracle.deploy(predictionMarket.address);
    await predictionOracle.deployed();

    // Set up permissions
    await predictionMarket.setAuthorizedOracle(predictionOracle.address, true);
    await predictionOracle.setAuthorizedResolver(oracle.address, true);

    // Give users some USDC
    await mockUSDC.faucetTo(user1.address, 1000); // 1000 USDC
    await mockUSDC.faucetTo(user2.address, 1000); // 1000 USDC
  });

  describe("Market Creation", function () {
    it("Should create a market successfully", async function () {
      const questionTitle = "Will Bitcoin reach $100,000 by end of 2024?";
      const description = "This market resolves to YES if Bitcoin reaches $100,000.";
      const resolutionTime = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
      const finalResolutionTime = resolutionTime + 86400; // 2 days from now
      const creatorFee = 100; // 1%
      const category = "Crypto";

      const tx = await predictionMarket.createMarket(
        questionTitle,
        description,
        resolutionTime,
        finalResolutionTime,
        creatorFee,
        category,
        predictionOracle.address
      );

      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "MarketCreated");
      
      expect(event).to.not.be.undefined;
      expect(event.args.marketId).to.equal(1);
      expect(event.args.creator).to.equal(owner.address);
      expect(event.args.questionTitle).to.equal(questionTitle);

      // Check market data
      const market = await predictionMarket.getMarket(1);
      expect(market.questionTitle).to.equal(questionTitle);
      expect(market.description).to.equal(description);
      expect(market.creator).to.equal(owner.address);
      expect(market.isActive).to.be.true;
      expect(market.isResolved).to.be.false;
    });

    it("Should fail to create market with invalid parameters", async function () {
      await expect(
        predictionMarket.createMarket(
          "",
          "Description",
          Math.floor(Date.now() / 1000) - 1, // Past time
          Math.floor(Date.now() / 1000) + 86400,
          100,
          "Category",
          predictionOracle.address
        )
      ).to.be.revertedWith("Resolution time must be in future");
    });
  });

  describe("Trading", function () {
    let marketId;

    beforeEach(async function () {
      // Create a market
      const tx = await predictionMarket.createMarket(
        "Test Market",
        "Test Description",
        Math.floor(Date.now() / 1000) + 86400,
        Math.floor(Date.now() / 1000) + 172800,
        50, // 0.5%
        "Test",
        predictionOracle.address
      );
      const receipt = await tx.wait();
      marketId = receipt.events.find(e => e.event === "MarketCreated").args.marketId;
    });

    it("Should allow users to buy YES shares", async function () {
      const amount = ethers.utils.parseUnits("100", 6); // 100 USDC
      
      // Approve USDC spending
      await mockUSDC.connect(user1).approve(predictionMarket.address, amount);
      
      // Buy YES shares
      const tx = await predictionMarket.connect(user1).buyShares(marketId, true, amount, 0);
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === "SharesPurchased");
      expect(event).to.not.be.undefined;
      expect(event.args.buyer).to.equal(user1.address);
      expect(event.args.isYes).to.be.true;
      
      // Check user position
      const position = await predictionMarket.getUserPosition(marketId, user1.address);
      expect(position.yesShares).to.be.gt(0);
      expect(position.noShares).to.equal(0);
      expect(position.totalInvested).to.equal(amount);
    });

    it("Should allow users to buy NO shares", async function () {
      const amount = ethers.utils.parseUnits("100", 6); // 100 USDC
      
      // Approve USDC spending
      await mockUSDC.connect(user2).approve(predictionMarket.address, amount);
      
      // Buy NO shares
      const tx = await predictionMarket.connect(user2).buyShares(marketId, false, amount, 0);
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === "SharesPurchased");
      expect(event).to.not.be.undefined;
      expect(event.args.buyer).to.equal(user2.address);
      expect(event.args.isYes).to.be.false;
      
      // Check user position
      const position = await predictionMarket.getUserPosition(marketId, user2.address);
      expect(position.yesShares).to.equal(0);
      expect(position.noShares).to.be.gt(0);
      expect(position.totalInvested).to.equal(amount);
    });

    it("Should update market price after trades", async function () {
      const amount = ethers.utils.parseUnits("100", 6);
      
      // Get initial price
      const initialPrice = await predictionMarket.getCurrentPrice(marketId);
      
      // User1 buys YES shares
      await mockUSDC.connect(user1).approve(predictionMarket.address, amount);
      await predictionMarket.connect(user1).buyShares(marketId, true, amount, 0);
      
      // Price should increase (more YES demand)
      const newPrice = await predictionMarket.getCurrentPrice(marketId);
      expect(newPrice).to.be.gt(initialPrice);
    });

    it("Should allow selling shares", async function () {
      const buyAmount = ethers.utils.parseUnits("100", 6);
      
      // Buy shares first
      await mockUSDC.connect(user1).approve(predictionMarket.address, buyAmount);
      await predictionMarket.connect(user1).buyShares(marketId, true, buyAmount, 0);
      
      // Get position
      const position = await predictionMarket.getUserPosition(marketId, user1.address);
      const sharesToSell = position.yesShares.div(2); // Sell half
      
      // Sell shares
      const tx = await predictionMarket.connect(user1).sellShares(marketId, true, sharesToSell, 0);
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === "SharesSold");
      expect(event).to.not.be.undefined;
      expect(event.args.seller).to.equal(user1.address);
      expect(event.args.shares).to.equal(sharesToSell);
    });
  });

  describe("Market Resolution", function () {
    let marketId;

    beforeEach(async function () {
      // Create a market that can be resolved
      const tx = await predictionMarket.createMarket(
        "Test Market",
        "Test Description",
        Math.floor(Date.now() / 1000) + 1, // 1 second from now
        Math.floor(Date.now() / 1000) + 86400,
        50,
        "Test",
        predictionOracle.address
      );
      const receipt = await tx.wait();
      marketId = receipt.events.find(e => e.event === "MarketCreated").args.marketId;

      // Wait for resolution time
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    it("Should allow oracle to resolve market", async function () {
      // Resolve market as YES (outcome = 1)
      const tx = await predictionMarket.connect(oracle).resolveMarket(marketId, 1);
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === "MarketResolved");
      expect(event).to.not.be.undefined;
      expect(event.args.marketId).to.equal(marketId);
      expect(event.args.outcome).to.equal(1);
      
      // Check market is resolved
      const market = await predictionMarket.getMarket(marketId);
      expect(market.isResolved).to.be.true;
      expect(market.outcome).to.equal(1);
    });

    it("Should allow claiming winnings after resolution", async function () {
      const amount = ethers.utils.parseUnits("100", 6);
      
      // User buys YES shares
      await mockUSDC.connect(user1).approve(predictionMarket.address, amount);
      await predictionMarket.connect(user1).buyShares(marketId, true, amount, 0);
      
      // Resolve market as YES
      await predictionMarket.connect(oracle).resolveMarket(marketId, 1);
      
      // Check initial USDC balance
      const initialBalance = await mockUSDC.balanceOf(user1.address);
      
      // Claim winnings
      await predictionMarket.connect(user1).claimWinnings(marketId);
      
      // Check final balance (should be higher)
      const finalBalance = await mockUSDC.balanceOf(user1.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("USDC Integration", function () {
    it("Should handle USDC faucet", async function () {
      const initialBalance = await mockUSDC.balanceOf(user1.address);
      
      await mockUSDC.connect(user1).faucet();
      
      const finalBalance = await mockUSDC.balanceOf(user1.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should require USDC approval for trading", async function () {
      const marketId = 1;
      const amount = ethers.utils.parseUnits("100", 6);
      
      // Create market first
      await predictionMarket.createMarket(
        "Test Market",
        "Test Description",
        Math.floor(Date.now() / 1000) + 86400,
        Math.floor(Date.now() / 1000) + 172800,
        50,
        "Test",
        predictionOracle.address
      );
      
      // Try to buy without approval (should fail)
      await expect(
        predictionMarket.connect(user1).buyShares(marketId, true, amount, 0)
      ).to.be.revertedWith("Payment failed");
    });
  });

  describe("Fee System", function () {
    it("Should collect platform fees", async function () {
      const marketId = 1;
      const amount = ethers.utils.parseUnits("100", 6);
      
      // Create market
      await predictionMarket.createMarket(
        "Test Market",
        "Test Description",
        Math.floor(Date.now() / 1000) + 86400,
        Math.floor(Date.now() / 1000) + 172800,
        50,
        "Test",
        predictionOracle.address
      );
      
      // Buy and sell shares to generate fees
      await mockUSDC.connect(user1).approve(predictionMarket.address, amount);
      await predictionMarket.connect(user1).buyShares(marketId, true, amount, 0);
      
      const position = await predictionMarket.getUserPosition(marketId, user1.address);
      await predictionMarket.connect(user1).sellShares(marketId, true, position.yesShares, 0);
      
      // Platform should have collected fees (contract balance > 0)
      const contractBalance = await mockUSDC.balanceOf(predictionMarket.address);
      expect(contractBalance).to.be.gt(0);
    });
  });
});
