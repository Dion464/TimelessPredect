## Database setup (Neon Postgres on Vercel)

1) Add environment variables in Vercel → Project → Settings → Environment Variables
- POSTGRES_URL = your pooled Neon URL (recommended)
- Optionally also set DATABASE_URL with the same value

2) Create tables in Neon
- Open Neon SQL editor and run the contents of `db/schema.sql`

3) Ingestion (recommended)
- Point your Alchemy/Infura log webhook for `SharesPurchased`/`SharesSold` to an API endpoint that inserts rows
- If you host API routes elsewhere, reuse this schema and the payload shape:
  - txHash, logIndex, marketId, trader, isYes, sharesWei, priceBps, costWei, blockNumber, blockTime (unix seconds)

4) Local Indexer (optional)
- Create a local `.env.local` (not committed) with:
 - `RPC_URL` = your chain RPC
 - `INGEST_ENDPOINT` = your deployed `/api/ingest` URL
  - `PREDICTION_MARKET_ADDRESS` = deployed ETHPredictionMarket address
- Run the listener locally:
  - `node scripts/trade-indexer.js`

5) Local seeding (optional)
- With no live trades yet, generate sample on-chain activity and persist it straight to Postgres:
  - `cd contracts`
  - `npx hardhat run scripts/seed-db.js`

Notes
- Store numeric values as strings (wei/bps) to avoid float issues in JS
- Use pooled connection URLs on serverless platforms

### Prisma usage
1. Ensure `DATABASE_URL` is set in Vercel (or locally in `.env.local`).
2. Generate Prisma Client locally before deploy:
   - From `TimelessPredect/`: `npx prisma generate`
3. API routes now use Node.js runtime with Prisma (`api/trades.js`, `api/positions.js`, `api/ingest.js`).

