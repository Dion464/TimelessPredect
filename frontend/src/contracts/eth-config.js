// Auto-generated contract configuration
// Generated at: 2025-11-12T12:07:21.804Z
// Network: unknown (Chain ID: 1337)

export const CONTRACT_ADDRESS = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";
export const CHAIN_ID = 1337;
export const MARKET_CREATION_FEE = "0.01";
export const PLATFORM_FEE_BPS = 200;

export const CONTRACT_ABI = [
  "function createMarket(string memory _question, string memory _description, string memory _category, uint256 _endTime, uint256 _resolutionTime) payable returns (uint256)",
  "function getMarket(uint256 _marketId) view returns (tuple(uint256 id, string question, string description, string category, uint256 endTime, uint256 resolutionTime, bool resolved, uint8 outcome, uint256 totalYesShares, uint256 totalNoShares, uint256 totalVolume, address creator, uint256 createdAt, bool active, uint256 lastTradedPrice, uint256 yesBidPrice, uint256 yesAskPrice, uint256 noBidPrice, uint256 noAskPrice))",
  "function getActiveMarkets() view returns (uint256[] memory)",
  "function getCurrentPrice(uint256 _marketId, bool _isYes) view returns (uint256)",
  "function getSharesAmount(uint256 _marketId, bool _isYes, uint256 _investAmount) view returns (uint256)",
  "function buyShares(uint256 _marketId, bool _isYes) payable",
  "function sellShares(uint256 _marketId, bool _isYes, uint256 _sharesToSell)",
  "function resolveMarket(uint256 _marketId, uint8 _outcome)",
  "function claimWinnings(uint256 _marketId)",
  "function getUserPosition(uint256 _marketId, address _user) view returns (tuple(uint256 yesShares, uint256 noShares, uint256 totalInvested))",
  "function marketCreationFee() view returns (uint256)",
  "event MarketCreated(uint256 indexed marketId, address indexed creator, string question, string category, uint256 endTime)",
  "event SharesPurchased(uint256 indexed marketId, address indexed buyer, bool isYes, uint256 shares, uint256 cost, uint256 newPrice)",
  "event SharesSold(uint256 indexed marketId, address indexed seller, bool isYes, uint256 shares, uint256 payout, uint256 newPrice)",
  "event MarketResolved(uint256 indexed marketId, uint8 outcome, uint256 totalPayout)"
];
