# TimelessPredect

This repository contains the on-chain smart contracts and frontend application for the SocialPredict-style prediction market.

## Project structure

- `contracts/` – Hardhat project with Solidity contracts, deployment scripts, and tests.
- `frontend/` – React (Vite) frontend for interacting with the prediction markets.

## Quick start

### Prerequisites

- Node.js 18+
- npm 9+

### Install dependencies

```bash
cd contracts
npm install
cd ../frontend
npm install
```

### Run a local Hardhat node

```bash
cd contracts
npm run node
```

In a separate terminal deploy the contracts (if needed):

```bash
npm run deploy:localhost
```

### Start the frontend

```bash
cd frontend
npm run start
```

Open http://localhost:5173 to access the app.

## Notes

- Contract addresses for the local Hardhat network are recorded in `contracts/deployments/`.
- The frontend reads contract metadata from `frontend/src/contracts/eth-config.js`.
