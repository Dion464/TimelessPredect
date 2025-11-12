const { ethers } = require("hardhat");

async function main() {
  const PREDICTION_MARKET_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
  const contract = new ethers.Contract(
    PREDICTION_MARKET_ADDRESS,
    ["function getActiveMarkets() external view returns (uint256[])"],
    provider
  );
  
  try {
    const markets = await contract.getActiveMarkets();
    console.log("Active Markets:", markets.map(m => m.toString()));
    console.log("Total markets:", markets.length);
    
    if (markets.length > 0) {
      for (const marketId of markets.slice(0, 3)) {
        const market = await contract.getMarket(marketId);
        console.log(`\nMarket ${marketId}:`);
        console.log("  Question:", market.question);
        console.log("  Active:", market.active);
        console.log("  Resolved:", market.resolved);
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);
