import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import priceHistoryHandler from './api/price-history.js';
import recordPriceHandler from './api/record-price.js';
import ordersHandler, { setBroadcastFunction, setSettlementCallback } from './api/orders.js';
import settleHandler from './api/settle.js';
import userStatsHandler from './api/user-stats.js';
import { getOrderMatcher } from './lib/orderMatcher.js';
import { executeOrderViaAMM } from './api/execute-amm-order.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Helper to convert Express req to Vercel-style format
function createVercelRequest(expressReq) {
  return {
    method: expressReq.method,
    url: `${expressReq.protocol}://${expressReq.get('host')}${expressReq.originalUrl}`,
    body: expressReq.body
  };
}

// API Routes
app.get('/api/price-history', async (req, res) => {
  try {
    const vercelReq = createVercelRequest(req);
    await priceHistoryHandler(vercelReq, res);
  } catch (error) {
    console.error('Error in price-history handler:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/record-price', async (req, res) => {
  try {
    const vercelReq = createVercelRequest(req);
    vercelReq.body = req.body;
    await recordPriceHandler(vercelReq, res);
  } catch (error) {
    console.error('Error in record-price handler:', error);
    res.status(500).json({ error: error.message });
  }
});

// Order management routes
app.post('/api/orders', async (req, res) => {
  try {
    const vercelReq = createVercelRequest(req);
    vercelReq.body = req.body;
    await ordersHandler(vercelReq, res);
  } catch (error) {
    console.error('Error in orders handler:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const vercelReq = createVercelRequest(req);
    vercelReq.body = req.body;
    await ordersHandler(vercelReq, res);
  } catch (error) {
    console.error('Error in orders handler:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/orders/:orderId', async (req, res) => {
  try {
    const vercelReq = createVercelRequest(req);
    vercelReq.body = req.body;
    // Add orderId to the URL for the handler
    vercelReq.url = `/api/orders/${req.params.orderId}`;
    await ordersHandler(vercelReq, res);
  } catch (error) {
    console.error('Error in orders handler:', error);
    res.status(500).json({ error: error.message });
  }
});

// Settlement route
app.post('/api/settle', async (req, res) => {
  try {
    const vercelReq = createVercelRequest(req);
    vercelReq.body = req.body;
    await settleHandler(vercelReq, res);
  } catch (error) {
    console.error('Error in settle handler:', error);
    res.status(500).json({ error: error.message });
  }
});

// User stats route
app.get('/api/user-stats/:address', async (req, res) => {
  try {
    const vercelReq = createVercelRequest(req);
    // Add the address parameter to the request
    vercelReq.params = { address: req.params.address };
    await userStatsHandler(vercelReq, res);
  } catch (error) {
    console.error('Error in user-stats handler:', error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket Server for real-time order book updates
const server = createServer(app);
const wss = new WebSocketServer({ 
  server,
  path: '/ws',
  // Handle connection upgrade
  verifyClient: (info) => {
    // Accept all connections for now
    return true;
  }
});

const clients = new Map(); // marketId:outcomeId -> Set of WebSocket connections

wss.on('connection', (ws, req) => {
  console.log('📡 New WebSocket connection from:', req.socket.remoteAddress);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'subscribe') {
        // Subscribe to order book updates for a market/outcome
        const key = `${data.marketId}:${data.outcomeId}`;
        if (!clients.has(key)) {
          clients.set(key, new Set());
        }
        clients.get(key).add(ws);
        ws.subscribedKey = key;
        
        ws.send(JSON.stringify({
          type: 'subscribed',
          marketId: data.marketId,
          outcomeId: data.outcomeId
        }));
        
        console.log(`✅ Client subscribed to ${key}`);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    if (ws.subscribedKey && clients.has(ws.subscribedKey)) {
      clients.get(ws.subscribedKey).delete(ws);
      if (clients.get(ws.subscribedKey).size === 0) {
        clients.delete(ws.subscribedKey);
      }
    }
    console.log('📡 WebSocket disconnected');
  });
});

// Broadcast order book updates
export function broadcastOrderBookUpdate(marketId, outcomeId, orderBookData) {
  const key = `${marketId}:${outcomeId}`;
  if (!clients.has(key)) return;
  
  const message = JSON.stringify({
    type: 'orderbook_update',
    marketId,
    outcomeId,
    ...orderBookData
  });
  
  clients.get(key).forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// Set broadcast function in orders handler (after function definition)
setBroadcastFunction(broadcastOrderBookUpdate);

// Set settlement callback in orders handler
setSettlementCallback(handleAutoSettlement);

// Auto-settlement callback
async function handleAutoSettlement({ makerOrder, takerOrder, fillSize, fillPrice }) {
  try {
    const API_BASE = process.env.API_BASE_URL || `http://localhost:${PORT}`;
    
    // Call settlement endpoint
    const response = await fetch(`${API_BASE}/api/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        makerOrder,
        takerOrder,
        fillSize,
        signatures: {
          maker: makerOrder.signature,
          taker: takerOrder.signature
        }
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Auto-settled trade: ${result.txHash}`);
    } else {
      console.error('Auto-settlement failed:', await response.text());
    }
  } catch (error) {
    console.error('Error in auto-settlement:', error);
  }
}

// Start order matching service
const orderMatcher = getOrderMatcher(handleAutoSettlement);

// Set callback for executing orders via AMM when market price crosses limit
orderMatcher.setAMMExecutionCallback(async (order) => {
  try {
    console.log(`💰 Executing order ${order.id} via AMM (market price crossed limit)`);
    await executeOrderViaAMM(order);
    
    // Broadcast order book update
    const { getOrderBook } = await import('./lib/orderBook.js');
    const orderBook = getOrderBook();
    const book = orderBook.getOrderBook(order.marketId, order.outcomeId, 10);
    if (broadcastOrderBookUpdate) {
      broadcastOrderBookUpdate(order.marketId, order.outcomeId, book);
    }
  } catch (error) {
    console.error(`Failed to execute order ${order.id} via AMM:`, error);
  }
});

orderMatcher.start(5000); // Match every 5 seconds

server.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`   - GET  /api/price-history`);
  console.log(`   - POST /api/record-price`);
  console.log(`   - POST /api/orders (place order)`);
  console.log(`   - GET  /api/orders (get order book)`);
  console.log(`   - DELETE /api/orders/:id (cancel order)`);
  console.log(`   - POST /api/settle (settle trade)`);
  console.log(`   - GET  /api/user-stats/:address (user profile stats)`);
  console.log(`   - WS   ws://localhost:${PORT} (WebSocket for order book)`);
  console.log(`\n🔄 Order matching service: Running (matches every 5s)`);
  console.log(`\n📊 Database: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ Not configured'}`);
  console.log(`   Exchange Contract: ${process.env.EXCHANGE_CONTRACT_ADDRESS || 'Not set'}`);
});

