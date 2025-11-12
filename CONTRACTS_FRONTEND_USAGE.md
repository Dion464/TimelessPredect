## Contracts ↔ Frontend Usage Map

This document summarizes what’s in the smart contracts and what the frontend consumes from them.

### Overview
- **Primary on-chain entrypoint used by the UI**: `ETHPredictionMarket` (exposed in the frontend as `contracts.predictionMarket`).
- **Pricing model**: `PricingAMM` is referenced by `ETHPredictionMarket` and read by the UI for market state/prices in select views.
- **Other contracts present**: `PredictionMarket` (ERC20-based variant, not used by current UI), `PredictionOracle` (admin/oracle flow), `MockUSDC` (test token). The current UI focuses on ETH-based flow.

---

### Contracts and Key Surfaces

#### ETHPredictionMarket.sol
Core ETH-based prediction market contract. The frontend calls/reads:
- Write
  - `buyShares(uint256 marketId, bool isYes)`; value: ETH
  - `sellShares(uint256 marketId, bool isYes, uint256 shares)`
- Read
  - `getMarket(uint256 marketId)`
  - `getActiveMarkets()`
  - `getUserPosition(uint256 marketId, address user)`
  - `getCurrentPrice(uint256 marketId, bool isYes)`
  - `getRecentTrades(uint256 marketId, uint256 limit)`
- Admin/Resolution (present, not commonly invoked by normal users via current UI)
  - `proposeResolution`, `disputeResolution`, `finalizeResolution`, `claimWinnings`, `resolveMarket`, etc.
- Events (useful for explorers/streams; the UI primarily uses read calls)
  - `MarketCreated`, `SharesPurchased`, `SharesSold`, `MarketResolved`, `ResolutionProposed`, `ResolutionDisputed`, `ResolutionFinalized`

Where referenced in the frontend:
- `frontend/src/hooks/useWeb3.jsx`:
  - Initializes `ethers.Contract` for `ETHPredictionMarket` using ABI and address
  - Calls `buyShares`, `sellShares`, `getUserPosition`, and aggregates market info via helper `getMarketData`
- `frontend/src/components/trading/Web3TradingInterface.jsx`:
  - Uses `buyShares`, `sellShares`, `getUserPosition`, `getMarketData` via `useWeb3`
- `frontend/src/pages/home/Home.jsx`:
  - Reads market data (e.g., total volume, prices) via `getMarketData`
- `frontend/src/pages/admin/MarketCreation.jsx`:
  - Calls `createMarket` through `useWeb3` (if enabled)

ABI surface exposed to UI (as shipped via `frontend/src/contracts/eth-config.js`):
- `pricingAMM()`
- `marketCreationFee()`
- `platformFeePercent()`
- `createMarket(...) payable`
- `getMarket(uint256)`
- `getActiveMarkets()`
- `getUserPosition(uint256,address)`
- `getCurrentPrice(uint256,bool)`
- `getRecentTrades(uint256,uint256)`
- `buyShares(uint256,bool) payable`
- `sellShares(uint256,bool,uint256)`
- Resolution/admin getters and actions
- Events listed above

Relevant files:
- `frontend/src/contracts/eth-config.js` (address/ABI export)
- `frontend/src/hooks/useWeb3.jsx` (contract wiring and core calls)
- Trading UIs under `frontend/src/components/trading/` and pages under `frontend/src/pages/`

#### PricingAMM.sol
AMM pricing state and helper view functions.
- Read (used by frontend):
  - `getMarketState(uint256 marketId)` → returns liquidity, yes/no shares, etc.
- Write (internal/system):
  - `updateMarketState(...)`, `buyYes/No`, `sellYes/No` (the UI doesn’t call these directly; `ETHPredictionMarket` orchestrates updates)

Where referenced in the frontend:
- `frontend/src/pages/market/PolymarketStyleTrading.jsx`:
  - Calls `contracts.pricingAMM.getMarketState(marketId)` for real-time price/liquidity context

#### PredictionOracle.sol
Resolution and oracle mechanics (bonds, disputes, automated resolvers). Present in repo, typically admin/back-office flow.
- The current UI does not directly call `PredictionOracle` in normal user flows.
- Admin actions may be scripted via `contracts/scripts/*` rather than UI.

#### PredictionMarket.sol (ERC20-based)
Alternate token-based market contract. Present but not wired into the current ETH-centric UI.

#### MockUSDC.sol
Test ERC20 with faucet/mint helpers. Not used by current ETH-only UI. Useful for script-driven tests or if a USDC flow is added later.

---

### Frontend Integration Details

Connection & initialization:
- `frontend/src/hooks/useWeb3.jsx`
  - Connects wallet via `window.ethereum` → `ethers.providers.Web3Provider`
  - Instantiates `ETHPredictionMarket` with address/ABI from `eth-config.js`
  - Resolves `pricingAMM` address via `predictionMarket.pricingAMM()` and constructs that contract if available

Core user actions surfaced by the UI:
- Buy YES/NO shares with ETH: `predictionMarket.buyShares(marketId, isYes, { value })`
- Sell YES/NO shares: `predictionMarket.sellShares(marketId, isYes, shares)`
- Read user position: `predictionMarket.getUserPosition(marketId, account)`
- Read market data: `predictionMarket.getMarket(marketId)`, `getCurrentPrice`, `getRecentTrades`
- Optional reads for analytics/price context: `pricingAMM.getMarketState(marketId)`

Error handling & gas:
- `useWeb3` estimates gas for buy/sell, adds buffer; falls back to fixed gas limits on estimation failure.
- Balances formatted via `ethers.utils.formatEther`.

---

### Addresses and Config
- Source of truth for the UI:
  - `frontend/src/contracts/eth-config.js`
    - `CONTRACT_ADDRESS`, `CHAIN_ID`, fees, and `CONTRACT_ABI`
  - The UI uses these to build `ethers.Contract` instances in `useWeb3`.

---

### What the UI Does NOT Currently Use
- Direct calls to `PredictionOracle` (resolution automation/disputes)
- The ERC20-based `PredictionMarket` variant
- `MockUSDC` flows

These can be integrated later if/when the product requires non-ETH settlement or in-UI resolution workflows.

