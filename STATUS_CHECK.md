# Server Status Check

## ✅ Backend Server is Running!

The backend API server is now running in the background on port 8080.

---

## Verify It's Working

### Test 1: Check if server is listening
```bash
lsof -i :8080
```
Should show: `node` process listening on port 8080

### Test 2: Test API endpoint
```bash
curl "http://localhost:8080/api/orders?marketId=1&outcomeId=0"
```
Should return JSON: `{"marketId":"1","outcomeId":"0","bids":[],"asks":[]}`

### Test 3: Check server logs
The server is running in the background. To see logs, you can:
- Check terminal where you started it
- Or restart it in foreground to see output

---

## Now Try Placing a Limit Order

1. **Refresh your browser** (hard refresh: Ctrl+Shift+R)
2. **Open browser console** (F12)
3. **Try placing a limit order**
4. **Check console** - should see API calls to `localhost:8080` (not errors)

---

## If You Need to Stop the Server

```bash
# Find the process
lsof -i :8080

# Kill it (replace PID with actual process ID)
kill <PID>

# Or kill all node processes (be careful!)
pkill -f "node api-server"
```

---

## If You Need to Restart the Server

```bash
# Stop current server
pkill -f "node api-server"

# Wait a moment
sleep 2

# Start again
cd /Users/zs/Desktop/tmlspredict/TimelessPredect
node api-server.js
```

---

## Server Should Show:

When started, you should see:
```
🚀 API server running on http://localhost:8080
   - GET  /api/price-history
   - POST /api/record-price
   - POST /api/orders (place order)
   - GET  /api/orders (get order book)
   - DELETE /api/orders/:id (cancel order)
   - POST /api/settle (settle trade)
   - WS   ws://localhost:8080 (WebSocket for order book)

🔄 Order matching service: Running (matches every 5s)
```

---

## Next Steps

1. ✅ Backend server is running
2. ✅ Frontend should be configured (check `frontend/.env`)
3. ✅ Try placing a limit order in the browser
4. ✅ Check console for any errors

The `ERR_CONNECTION_REFUSED` error should now be gone!

