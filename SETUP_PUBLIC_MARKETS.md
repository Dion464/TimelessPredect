# Setup Guide: Public Market Creation

## Quick Start

### 1. Push to GitHub
```bash
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
git push origin main
```

### 2. Update Database Schema on Vercel
The database migration will happen automatically on next deployment, but you can also run it manually:

```bash
# In Vercel project settings, add this to build command (already done):
npm install && npx prisma generate && npx prisma db push && cd frontend && npm install && npm run build
```

Or run manually via Vercel CLI:
```bash
vercel env pull
npx prisma db push
```

### 3. Configure Admin Addresses

**Important:** Update the admin whitelist with your actual admin wallet addresses!

Edit `frontend/src/helpers/AppRoutes.jsx`:
```javascript
const ADMIN_ADDRESSES = [
  '0xYOUR_ADMIN_ADDRESS_HERE',  // Replace with your wallet
  '0xANOTHER_ADMIN_ADDRESS',    // Add more as needed
].map(addr => addr.toLowerCase());
```

Also update in `frontend/src/pages/admin/PendingMarkets.jsx`:
```javascript
const ADMIN_ADDRESSES = [
  '0xYOUR_ADMIN_ADDRESS_HERE',  // Must match AppRoutes.jsx
].map(addr => addr.toLowerCase());
```

### 4. Deploy to Vercel
```bash
git add -A
git commit -m "Update admin addresses"
git push origin main
```

Vercel will automatically deploy with the new changes.

## Testing Locally

### 1. Start Local Services
```bash
# Terminal 1 - Hardhat Node (if testing locally)
cd contracts
npx hardhat node

# Terminal 2 - Frontend
cd frontend
npm start
```

### 2. Test Public Market Creation
1. Go to http://localhost:3000
2. Click "Create" button in navbar
3. Connect your wallet
4. Fill out the market form
5. Submit for approval
6. Check that you see success message

### 3. Test Admin Approval
1. Go to http://localhost:3000/admin
2. Login with:
   - Username: `admin`
   - Password: `admin123`
3. You'll be redirected to `/admin/pending`
4. Connect wallet with admin address (0xf39f... for Hardhat)
5. You should see the pending market
6. Click "Approve & Deploy"
7. Confirm transaction in MetaMask
8. Wait for confirmation
9. Market should appear on homepage

### 4. Test Access Control
1. Connect wallet with non-admin address
2. Try to go to http://localhost:3000/admin/pending
3. Should be redirected to login page
4. Try to go to http://localhost:3000/admin/create-market
5. Should be redirected to login page

## Production Deployment Checklist

- [ ] Update admin addresses in both files
- [ ] Push changes to GitHub
- [ ] Verify Vercel deployment succeeds
- [ ] Check that database migration ran (check Vercel logs)
- [ ] Test public market creation on production
- [ ] Test admin approval on production
- [ ] Verify markets appear on homepage after approval
- [ ] Test that non-admins cannot access admin pages

## Admin Addresses for Different Networks

### Hardhat Local (for testing)
```javascript
'0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'  // Account #0
```

### Incentiv Testnet / Production
Replace with your actual wallet addresses that will be admins.

## Troubleshooting

### "Access denied. Admin only."
**Solution:** Add your wallet address to the `ADMIN_ADDRESSES` array in both:
- `frontend/src/helpers/AppRoutes.jsx`
- `frontend/src/pages/admin/PendingMarkets.jsx`

### Database migration fails
**Solution:** The migration will run automatically on Vercel. If it fails:
1. Check Vercel logs for error details
2. Verify `DATABASE_URL` is set correctly
3. Try running `npx prisma db push` manually via Vercel CLI

### Markets not appearing after approval
**Solution:**
1. Check transaction was confirmed on blockchain
2. Check browser console for errors
3. Verify market ID was extracted from transaction
4. Check that image was saved to database
5. Hard refresh the homepage (Cmd+Shift+R / Ctrl+Shift+R)

### API endpoints returning 404
**Solution:**
1. Verify `vercel.json` has correct API routing
2. Check that API files are in `/api/` directory (not `/frontend/api/`)
3. Redeploy to Vercel

## Features Overview

### For Users
- ✅ Submit markets at `/create`
- ✅ See submission confirmation
- ✅ Markets stored as "PENDING"
- ✅ No admin access required

### For Admins
- ✅ Review dashboard at `/admin/pending`
- ✅ Filter by status (PENDING/APPROVED/REJECTED/ALL)
- ✅ Approve & deploy on-chain
- ✅ Reject with reason
- ✅ Protected routes (wallet-based)

### Security
- ✅ Admin routes protected by wallet whitelist
- ✅ Non-admins redirected to login
- ✅ Market creation fee paid by admin (not submitter)
- ✅ All data validated on frontend and backend

## Next Steps

1. **Push to GitHub** (see step 1 above)
2. **Update admin addresses** (see step 3 above)
3. **Test on Vercel** after deployment
4. **Monitor pending markets** at `/admin/pending`
5. **Approve quality markets** to grow the platform!

## Support

For issues or questions:
1. Check `PUBLIC_MARKET_CREATION.md` for detailed documentation
2. Check Vercel deployment logs
3. Check browser console for frontend errors
4. Check database for pending markets: `npx prisma studio`

