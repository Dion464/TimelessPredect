/**
 * Execute limit order via AMM when market price crosses limit
 */

import { ethers } from 'ethers';
import { getOrderBook } from '../lib/orderBook.js';

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const ETHPREDICTIONMARKET_ADDRESS = process.env.ETHPREDICTIONMARKET_ADDRESS;
const SETTLEMENT_PRIVATE_KEY = process.env.SETTLEMENT_PRIVATE_KEY;

// Minimal ABI for buyShares and sellShares
const ETHPREDICTIONMARKET_ABI = [
  "function buyShares(uint256 _marketId, bool _isYes) payable",
  "function sellShares(uint256 _marketId, bool _isYes, uint256 _shares)",
];

let provider = null;
let contract = null;
let settlementWallet = null;

function initContracts() {
  if (!ETHPREDICTIONMARKET_ADDRESS || !SETTLEMENT_PRIVATE_KEY) {
    console.warn('⚠️ AMM execution not available - missing ETHPREDICTIONMARKET_ADDRESS or SETTLEMENT_PRIVATE_KEY');
    return false;
  }

  try {
    provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    settlementWallet = new ethers.Wallet(SETTLEMENT_PRIVATE_KEY, provider);
    contract = new ethers.Contract(ETHPREDICTIONMARKET_ADDRESS, ETHPREDICTIONMARKET_ABI, settlementWallet);
    console.log('✅ AMM execution initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize AMM execution:', error);
    return false;
  }
}

/**
 * Execute a limit order via AMM
 * Note: This is a simplified approach - in production, you'd want to handle this differently
 * as executing on behalf of users requires careful security considerations
 */
export async function executeOrderViaAMM(order) {
  if (!contract) {
    if (!initContracts()) {
      throw new Error('AMM execution not available');
    }
  }

  try {
    const marketId = BigInt(order.marketId);
    const outcomeId = parseInt(order.outcomeId);
    const isYes = outcomeId === 0;
    const size = BigInt(order.size);
    const sizeEth = ethers.utils.formatEther(size.toString());

    console.log(`💼 Executing order ${order.id} via AMM:`, {
      marketId: marketId.toString(),
      isYes,
      size: sizeEth,
      side: order.side ? 'buy' : 'sell'
    });

    // For buy orders: call buyShares
    // For sell orders: call sellShares
    // NOTE: This requires the settlement wallet to have the shares/ETH
    // In a real system, you'd need to handle this more carefully
    
    if (order.side) {
      // Buy order
      const tx = await contract.buyShares(marketId, isYes, {
        value: size,
        gasLimit: 500000
      });
      await tx.wait();
      console.log(`✅ Buy order ${order.id} executed: ${tx.hash}`);
    } else {
      // Sell order - requires shares to be available
      // This is more complex and would need the user's shares
      throw new Error('Sell order execution via AMM not yet implemented - requires user shares');
    }

    // Mark order as filled in order book
    const orderBook = getOrderBook();
    orderBook.fillOrder(order.id, order.size);

    return { success: true, txHash: tx.hash };
  } catch (error) {
    console.error(`Error executing order ${order.id} via AMM:`, error);
    throw error;
  }
}

