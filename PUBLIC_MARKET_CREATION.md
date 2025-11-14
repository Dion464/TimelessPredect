# Public Market Creation with Admin Approval

## Overview
Users can now submit prediction markets for admin approval. Markets are stored in a pending state until an admin reviews and approves them for on-chain deployment.

## Features

### For Public Users
- **Submit Markets**: Anyone can submit a market proposal at `/create`
- **Requires Wallet**: Must connect wallet to submit (creator address is recorded)
- **Pending Status**: Markets are stored in database with "PENDING" status
- **No Admin Access**: Regular users cannot access admin pages

### For Admins
- **Review Dashboard**: View all pending markets at `/admin/pending`
- **Approve & Deploy**: Approve markets to deploy them on-chain automatically
- **Reject with Reason**: Reject markets with a reason that's stored
- **Protected Routes**: Only whitelisted admin addresses can access admin pages

## Database Schema

### PendingMarket Model
```prisma
model PendingMarket {
  id              BigInt              @id @default(autoincrement())
  question        String
  description     String?
  category        String
  imageUrl        String?
  endTime         DateTime
  resolutionTime  DateTime
  rules           String?             // JSON string of rules array
  creator         String              // Wallet address
  status          PendingMarketStatus @default(PENDING)
  rejectionReason String?
  approvedBy      String?
  marketId        BigInt?             // Set when approved and created on-chain
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
}

enum PendingMarketStatus {
  PENDING
  APPROVED
  REJECTED
}
```

## API Endpoints

### POST /api/pending-markets
Submit a new pending market.

**Request Body:**
```json
{
  "question": "Will Bitcoin reach $100,000 by end of 2025?",
  "description": "Market resolves YES if...",
  "category": "Crypto",
  "imageUrl": "https://example.com/image.jpg",
  "endTime": "2025-12-31T23:59:00Z",
  "resolutionTime": "2026-01-07T23:59:00Z",
  "rules": ["Rule 1", "Rule 2"],
  "creator": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "pendingMarket": { ... }
}
```

### GET /api/pending-markets
Get pending markets (with optional filters).

**Query Parameters:**
- `status`: PENDING | APPROVED | REJECTED
- `creator`: Filter by creator address

**Response:**
```json
{
  "success": true,
  "pendingMarkets": [ ... ]
}
```

### GET /api/pending-markets/[id]
Get a single pending market by ID.

### PATCH /api/pending-markets/[id]
Approve or reject a pending market.

**Request Body (Approve):**
```json
{
  "action": "approve",
  "approvedBy": "0x...",
  "marketId": "123" // Optional, set after on-chain creation
}
```

**Request Body (Reject):**
```json
{
  "action": "reject",
  "rejectionReason": "Duplicate market"
}
```

### DELETE /api/pending-markets/[id]
Delete a pending or rejected market (cannot delete approved markets).

## Routes

### Public Routes
- `/create` - Public market creation form (requires wallet connection)
- `/` - Home page with all approved markets
- `/markets/:id` - Market detail page

### Protected Admin Routes
- `/admin` - Admin login page
- `/admin/pending` - Pending markets dashboard (admin only)
- `/admin/create-market` - Direct market creation (admin only)
- `/admin/revenue` - Revenue dashboard (admin only)

## Admin Addresses

Admin addresses are whitelisted in `frontend/src/helpers/AppRoutes.jsx`:

```javascript
const ADMIN_ADDRESSES = [
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Hardhat account #0
  // Add more admin addresses here
].map(addr => addr.toLowerCase());
```

**To add more admins:**
1. Add their wallet address to the `ADMIN_ADDRESSES` array
2. Redeploy the frontend

## Workflow

### User Submits Market
1. User clicks "Create" in navbar → Goes to `/create`
2. User connects wallet if not connected
3. User fills out market form:
   - Question (required)
   - Description (optional)
   - Category (required)
   - Image URL (optional)
   - End Date & Time (required)
   - Resolution Date & Time (required)
   - Rules (optional, can add multiple)
4. User clicks "Submit for Approval"
5. Market is saved to database with status "PENDING"
6. User sees success message and is redirected to home

### Admin Reviews Market
1. Admin logs in at `/admin` (username: admin, password: admin123)
2. Admin is redirected to `/admin/pending`
3. Admin sees list of pending markets with all details
4. Admin can filter by status: PENDING, APPROVED, REJECTED, ALL

### Admin Approves Market
1. Admin clicks "Approve & Deploy" on a pending market
2. System creates market on-chain using admin's wallet
3. Transaction is submitted and confirmed
4. Market ID is extracted from transaction receipt
5. Image URL is saved to database (if provided)
6. Rules are saved to localStorage (if provided)
7. Pending market status is updated to "APPROVED" with marketId
8. Market appears on homepage for all users

### Admin Rejects Market
1. Admin clicks "Reject" on a pending market
2. Admin enters rejection reason in prompt
3. Pending market status is updated to "REJECTED"
4. Rejection reason is stored in database
5. Creator can see rejection reason (future feature)

## UI Components

### CreateMarket.jsx
- Public market creation form
- Glassmorphism design matching site theme
- Form validation
- Real-time rule management
- Wallet connection check

### PendingMarkets.jsx
- Admin dashboard for reviewing markets
- Filter tabs (PENDING, APPROVED, REJECTED, ALL)
- Market cards with all details
- Approve/Reject buttons
- Processing states
- Transaction feedback

### WormStyleNavbar.jsx
- Updated "Create" button to go to `/create` (public page)
- No longer requires admin access

### AppRoutes.jsx
- Added `AdminRoute` component for protected routes
- Checks if user's wallet address is in `ADMIN_ADDRESSES`
- Redirects non-admins to `/admin` login page

## Security

### Admin Protection
- Admin routes are protected by wallet address whitelist
- Only whitelisted addresses can access admin pages
- Non-admins are redirected to login page

### Market Creation Fee
- Admins pay the 0.01 ETH market creation fee when approving
- Fee is paid from admin's wallet, not the original submitter

### Data Validation
- All required fields are validated on frontend
- API validates required fields on backend
- Date validation ensures end date is after current date
- Resolution date must be after end date

## Deployment

### Database Migration
On Vercel, the migration will run automatically during build:
```bash
npx prisma migrate deploy
```

### Environment Variables
No new environment variables needed. Uses existing:
- `DATABASE_URL` - PostgreSQL connection string
- `VITE_CONTRACT_ADDRESS` - Smart contract address
- `VITE_CHAIN_ID` - Network chain ID

### Vercel Configuration
The `vercel.json` already includes:
```json
{
  "buildCommand": "npm install && npx prisma generate && cd frontend && npm install && npm run build"
}
```

This ensures Prisma client is generated with the new schema.

## Future Enhancements

1. **User Dashboard**: Show user's submitted markets and their status
2. **Email Notifications**: Notify users when their market is approved/rejected
3. **Edit Pending Markets**: Allow users to edit pending markets before approval
4. **Admin Comments**: Allow admins to add comments/feedback on markets
5. **Batch Approval**: Approve multiple markets at once
6. **Market Templates**: Pre-filled templates for common market types
7. **Reputation System**: Track user's approval rate
8. **Appeal System**: Allow users to appeal rejected markets

## Testing

### Test Public Market Creation
1. Go to http://localhost:3000/create
2. Connect wallet (any address)
3. Fill out form and submit
4. Check database for new pending market

### Test Admin Approval
1. Go to http://localhost:3000/admin
2. Login with admin credentials
3. Should redirect to /admin/pending
4. Connect wallet with admin address (0xf39f...)
5. Click "Approve & Deploy" on a pending market
6. Confirm transaction in MetaMask
7. Market should appear on homepage

### Test Access Control
1. Connect wallet with non-admin address
2. Try to access /admin/pending
3. Should redirect to /admin login page
4. Try to access /admin/create-market
5. Should redirect to /admin login page

## Troubleshooting

### "Access denied. Admin only."
- Your wallet address is not in the `ADMIN_ADDRESSES` list
- Add your address to the list in `AppRoutes.jsx`

### Markets not appearing after approval
- Check that transaction was confirmed on-chain
- Check that marketId was correctly extracted from event
- Check that image was saved to database
- Refresh the homepage

### TLS connection error (local development)
- This is a known issue with Neon database and local Prisma
- Does not affect Vercel deployment
- Use `npx prisma generate` instead of `migrate dev` locally

### Pending markets not loading
- Check API endpoint is accessible
- Check CORS headers in API functions
- Check browser console for errors
- Verify database connection string is correct

