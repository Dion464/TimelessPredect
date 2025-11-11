export const config = { runtime: 'nodejs' };

import { getOrderBook } from '../lib/orderBook.js';
import { verifyOrderSignature, computeOrderHash } from '../lib/eip712.js';
import { ethers } from 'ethers';

// Contract addresses - should be in env
const EXCHANGE_CONTRACT = process.env.EXCHANGE_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1337', 10);
const PORT = process.env.PORT || 8080;

// Broadcast function will be set by api-server.js
let broadcastOrderBookUpdate = () => {};
let settlementCallback = null; // Will be set by api-server.js

export function setBroadcastFunction(fn) {
  broadcastOrderBookUpdate = fn;
}

export function setSettlementCallback(callback) {
  settlementCallback = callback;
}

const orderBook = getOrderBook();

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Place new order
    return handlePostOrder(req, res);
  } else if (req.method === 'GET') {
    // Get order book or user orders
    return handleGetOrders(req, res);
  } else if (req.method === 'DELETE') {
    // Cancel order
    return handleCancelOrder(req, res);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * POST /api/orders - Place a new order
 */
async function handlePostOrder(req, res) {
  try {
    const { order, signature, isMarketOrder } = req.body;

    // Validate order structure
    if (!order || !signature) {
      return res.status(400).json({ error: 'Order and signature required' });
    }

    // Verify signature
    console.log('🔍 Verifying signature:', {
      orderMaker: order.maker,
      chainId: CHAIN_ID,
      exchangeContract: EXCHANGE_CONTRACT,
      orderKeys: Object.keys(order)
    });
    
    const isValid = verifyOrderSignature(
      order,
      signature,
      CHAIN_ID,
      EXCHANGE_CONTRACT
    );

    console.log('🔍 Signature verification result:', isValid);

    if (!isValid) {
      console.error('❌ Signature verification failed:', {
        order: JSON.stringify(order, null, 2),
        signature,
        chainId: CHAIN_ID,
        exchangeContract: EXCHANGE_CONTRACT
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Check expiry
    if (order.expiry && parseInt(order.expiry) < Math.floor(Date.now() / 1000)) {
      return res.status(400).json({ error: 'Order expired' });
    }

    // For market orders, find best available price and fill immediately
    if (isMarketOrder) {
      return handleMarketOrder(order, signature, res);
    }

    // For limit orders, add to book and try to match
    const orderHash = computeOrderHash(order, CHAIN_ID, EXCHANGE_CONTRACT);
    const orderId = orderBook.addOrder({
      ...order,
      signature,
      orderHash: orderHash
    });

    // Broadcast order book update
    try {
      const book = orderBook.getOrderBook(order.marketId, order.outcomeId, 10);
      if (broadcastOrderBookUpdate) {
        broadcastOrderBookUpdate(order.marketId, order.outcomeId, book);
      }
    } catch (err) {
      console.warn('Failed to broadcast order book update:', err);
    }

    // Try to match against existing orders
    const matches = orderBook.findMatches(order);

    if (matches.length > 0) {
      // Orders matched - trigger settlement IMMEDIATELY
      console.log(`✅ Found ${matches.length} matches for order ${orderId}`);
      
      // Process matches and trigger settlement
      try {
        // Process each match
        for (const match of matches) {
          // Fill orders in book
          orderBook.fillOrder(orderId, match.fillSize);
          orderBook.fillOrder(match.order.id, match.fillSize);
          
          // Trigger settlement if callback is available
          if (settlementCallback) {
            try {
              await settlementCallback({
                makerOrder: match.order,
                takerOrder: {
                  ...order,
                  id: orderId,
                  signature
                },
                fillSize: match.fillSize,
                fillPrice: match.fillPrice
              });
              console.log(`✅ Settlement triggered for order ${orderId}`);
            } catch (settlementError) {
              console.error('Error in settlement callback:', settlementError);
            }
          } else {
            console.warn('⚠️  Settlement callback not set - settlement skipped');
          }
        }
        
        // Broadcast order book update
        try {
          const book = orderBook.getOrderBook(order.marketId, order.outcomeId, 10);
          if (broadcastOrderBookUpdate) {
            broadcastOrderBookUpdate(order.marketId, order.outcomeId, book);
          }
        } catch (err) {
          console.warn('Failed to broadcast order book update:', err);
        }
        
        return res.status(200).json({
          orderId,
          status: 'matched',
          message: 'Order matched and settlement triggered',
          matches: matches.map(m => ({
            makerOrder: m.order,
            fillSize: m.fillSize,
            fillPrice: m.fillPrice
          }))
        });
      } catch (settlementError) {
        console.error('Error settling matched orders:', settlementError);
        // Still return matches even if settlement fails (user can retry)
        return res.status(200).json({
          orderId,
          status: 'matched',
          message: 'Order matched but settlement failed - will retry',
          matches: matches.map(m => ({
            makerOrder: m.order,
            fillSize: m.fillSize,
            fillPrice: m.fillPrice
          }))
        });
      }
    }

    // No matches - order added to book
    return res.status(201).json({
      orderId,
      status: 'open',
      message: 'Order added to order book'
    });

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle market order (execute at best available price from order book)
 * If no matches in order book, return indication to use AMM fallback
 * 
 * Market Buy: Fills instantly against best available sell orders
 * Market Sell: Fills instantly if there's a matching buy order in the book
 * 
 * If no matches, the order should fallback to AMM (handled by frontend)
 */
async function handleMarketOrder(order, signature, res) {
  try {
    // Find matches in order book
    const matches = orderBook.findMatches(order);
    
    if (matches.length === 0) {
      // No matches in order book - return special status to indicate AMM fallback
      return res.status(200).json({ 
        status: 'no_matches',
        message: 'No matching orders in order book - use AMM fallback',
        useAMM: true
      });
    }

    // Fill at best available prices (sorted by match logic)
    const fills = [];
    let remainingSize = BigInt(order.size);
    
    for (const match of matches) {
      if (remainingSize <= 0n) break;
      
      const fillSize = BigInt(match.fillSize) < remainingSize 
        ? BigInt(match.fillSize) 
        : remainingSize;
      
      fills.push({
        makerOrder: match.order,
        fillSize: fillSize.toString(),
        fillPrice: match.fillPrice
      });
      
      remainingSize -= fillSize;
    }

    // Update order book with fills
    for (const fill of fills) {
      orderBook.fillOrder(fill.makerOrder.id, fill.fillSize);
    }

    // If partially filled, mark remaining as partial
    if (remainingSize > 0n) {
      console.warn(`Market order partially filled: ${remainingSize} remaining`);
      // Create a limit order for the remaining size
      const orderHash = computeOrderHash(order, CHAIN_ID, EXCHANGE_CONTRACT);
      const remainingOrder = {
        ...order,
        size: remainingSize.toString(),
        signature,
        orderHash
      };
      orderBook.addOrder(remainingOrder);
    }

    return res.status(200).json({
      status: 'matched',
      fills,
      remaining: remainingSize.toString(),
      message: 'Market order filled from order book'
    });

  } catch (error) {
    console.error('Error processing market order:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/orders - Get order book or user orders
 */
async function handleGetOrders(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const marketId = url.searchParams.get('marketId');
    const outcomeId = url.searchParams.get('outcomeId');
    const userAddress = url.searchParams.get('user');

    if (marketId && outcomeId) {
      // Get order book depth
      const depth = parseInt(url.searchParams.get('depth') || '10', 10);
      const book = orderBook.getOrderBook(marketId, outcomeId, depth);
      return res.status(200).json({
        marketId,
        outcomeId,
        bids: book.bids,
        asks: book.asks
      });
    }

    if (userAddress) {
      // Get user's orders
      const orders = orderBook.getUserOrders(userAddress, marketId);
      return res.status(200).json({ orders });
    }

    return res.status(400).json({ 
      error: 'Must provide marketId+outcomeId or user address' 
    });

  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * DELETE /api/orders/:orderId - Cancel an order
 */
async function handleCancelOrder(req, res) {
  try {
    // Extract orderId from URL path
    const urlPath = req.url || '';
    const orderId = urlPath.split('/').pop() || urlPath.split('/').slice(-1)[0];
    const { userAddress, signature } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID required' });
    }

    const order = orderBook.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Verify user owns the order
    if (userAddress && order.maker.toLowerCase() !== userAddress.toLowerCase()) {
      return res.status(403).json({ error: 'Not authorized to cancel this order' });
    }

    const canceled = orderBook.cancelOrder(orderId);
    if (!canceled) {
      return res.status(400).json({ error: 'Cannot cancel order (may be filled)' });
    }

    return res.status(200).json({
      orderId,
      status: 'canceled',
      message: 'Order canceled successfully'
    });

  } catch (error) {
    console.error('Error canceling order:', error);
    res.status(500).json({ error: error.message });
  }
}

