// Contract configuration - uses environment variables only
// No fallback to localhost - must set VITE_* environment variables

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
export const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID);
export const MARKET_CREATION_FEE = import.meta.env.VITE_MARKET_CREATION_FEE;
export const PLATFORM_FEE_BPS = parseInt(import.meta.env.VITE_PLATFORM_FEE_BPS);
export const RPC_URL = import.meta.env.VITE_RPC_URL;
export const NETWORK_NAME = import.meta.env.VITE_NETWORK_NAME;

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
