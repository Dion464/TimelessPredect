#!/usr/bin/env node
/**
 * Comprehensive Order System Test Script
 * Tests buy/sell orders with two accounts
 * 
 * Usage: node test-orders.js
 * 
 * Prerequisites:
 * 1. Backend server running on localhost:8080
 * 2. Hardhat node running on localhost:8545
 * 3. At least one market created (marketId required)
 */

import 'dotenv/config';
import { ethers } from 'ethers';
// Use built-in fetch (Node 18+) or node-fetch if needed

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const PROVIDER_URL = process.env.PROVIDER_URL || 'http://localhost:8545';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1337', 10);
const EXCHANGE_CONTRACT = process.env.EXCHANGE_CONTRACT_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';

// Test accounts (Hardhat default accounts)
const ACCOUNT1_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Account 0
const ACCOUNT2_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Account 1

// EIP-712 Domain
const EIP712_DOMAIN_NAME = 'Exchange';
const EIP712_DOMAIN_VERSION = '1';

const ORDER_TYPE = {
  Order: [
    { name: 'maker', type: 'address' },
    { name: 'marketId', type: 'uint256' },
    { name: 'outcomeId', type: 'uint256' },
    { name: 'price', type: 'uint256' },
    { name: 'size', type: 'uint256' },
    { name: 'side', type: 'bool' },
    { name: 'expiry', type: 'uint256' },
    { name: 'salt', type: 'uint256' }
  ]
};

function getDomain(chainId, verifyingContract) {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId: chainId,
    verifyingContract: verifyingContract
  };
}

function centsToTicks(cents) {
  return Math.floor(cents * 100); // e.g., 42.67 cents = 4267 ticks
}

function ticksToCents(ticks) {
  return ticks / 100; // e.g., 4267 ticks = 42.67 cents
}

function generateSalt() {
  return ethers.BigNumber.from(ethers.utils.randomBytes(32)).toString();
}

async function createAndSignOrder(wallet, orderData) {
  const order = {
    maker: orderData.maker.toLowerCase(),
    marketId: orderData.marketId.toString(),
    outcomeId: orderData.outcomeId.toString(),
    price: orderData.price.toString(),
    size: orderData.size.toString(),
    side: orderData.side,
    expiry: orderData.expiry.toString(),
    salt: orderData.salt.toString()
  };

  const domain = getDomain(CHAIN_ID, EXCHANGE_CONTRACT);
  
  const signature = await wallet._signTypedData(
    domain,
    ORDER_TYPE,
    order
  );

  return { order, signature };
}

async function placeOrder(order, signature, isMarketOrder = false) {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      order,
      signature,
      isMarketOrder
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Order placement failed: ${data.error || response.statusText}`);
  }

  return data;
}

async function getOrderBook(marketId, outcomeId) {
  const response = await fetch(`${API_BASE_URL}/api/orders?marketId=${marketId}&outcomeId=${outcomeId}`);
  const data = await response.json();
  return data;
}

async function getUserOrders(userAddress) {
  const response = await fetch(`${API_BASE_URL}/api/orders?user=${userAddress}`);
  const data = await response.json();
  return data;
}

async function waitForMatches(orderId, timeout = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Check if order was matched (would need to query order status)
    // For now, just wait
  }
}

async function testOrderSystem() {
  console.log('\n🧪 Starting Order System Test...\n');
  console.log('Configuration:');
  console.log(`  API Base URL: ${API_BASE_URL}`);
  console.log(`  Provider URL: ${PROVIDER_URL}`);
  console.log(`  Chain ID: ${CHAIN_ID}`);
  console.log(`  Exchange Contract: ${EXCHANGE_CONTRACT}\n`);

  // Setup providers and wallets
  const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);
  const wallet1 = new ethers.Wallet(ACCOUNT1_PRIVATE_KEY, provider);
  const wallet2 = new ethers.Wallet(ACCOUNT2_PRIVATE_KEY, provider);

  console.log('📝 Test Accounts:');
  console.log(`  Account 1: ${wallet1.address}`);
  console.log(`  Account 2: ${wallet2.address}\n`);

  // Get market ID from user or use default
  const marketId = process.argv[2] || '1';
  const outcomeId = 0; // YES = 0, NO = 1
  const expiry = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

  console.log(`📊 Testing Market ID: ${marketId}, Outcome: YES (${outcomeId})\n`);

  try {
    // Test 1: Place Limit Buy Order from Account 1
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 1: Place Limit Buy Order (Account 1)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const buyPriceCents = 45; // 45 cents
    const buyPriceTicks = centsToTicks(buyPriceCents);
    const buySize = ethers.utils.parseEther('0.1'); // 0.1 ETH

    const buyOrderData = {
      maker: wallet1.address,
      marketId,
      outcomeId,
      price: buyPriceTicks.toString(),
      size: buySize.toString(),
      side: true, // buy
      expiry,
      salt: generateSalt()
    };

    const { order: buyOrder, signature: buySignature } = await createAndSignOrder(wallet1, buyOrderData);
    
    console.log('📝 Order Details:');
    console.log(`  Type: Limit Buy`);
    console.log(`  Price: ${buyPriceCents}¢ (${buyPriceTicks} ticks)`);
    console.log(`  Size: ${ethers.utils.formatEther(buySize)} ETH`);
    console.log(`  Maker: ${wallet1.address}\n`);

    const buyResult = await placeOrder(buyOrder, buySignature, false);
    console.log('✅ Order placed:', buyResult);
    console.log(`  Order ID: ${buyResult.orderId}`);
    console.log(`  Status: ${buyResult.status}\n`);

    // Wait a bit for order to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Check Order Book
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 2: Check Order Book');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const orderBook = await getOrderBook(marketId, outcomeId);
    console.log('📊 Order Book:');
    console.log(JSON.stringify(orderBook, null, 2));
    console.log();

    // Test 3: Place Limit Sell Order from Account 2 (should match)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 3: Place Limit Sell Order (Account 2)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Note: Account 2 needs shares first!\n');
    console.log('   For this test, we assume Account 2 has shares.');
    console.log('   In real scenario, Account 2 would need to buy shares first.\n');

    const sellPriceCents = 44; // 44 cents (should match with 45¢ buy)
    const sellPriceTicks = centsToTicks(sellPriceCents);
    const sellSize = ethers.utils.parseEther('0.05'); // 0.05 ETH

    const sellOrderData = {
      maker: wallet2.address,
      marketId,
      outcomeId,
      price: sellPriceTicks.toString(),
      size: sellSize.toString(),
      side: false, // sell
      expiry,
      salt: generateSalt()
    };

    const { order: sellOrder, signature: sellSignature } = await createAndSignOrder(wallet2, sellOrderData);
    
    console.log('📝 Order Details:');
    console.log(`  Type: Limit Sell`);
    console.log(`  Price: ${sellPriceCents}¢ (${sellPriceTicks} ticks)`);
    console.log(`  Size: ${ethers.utils.formatEther(sellSize)} ETH`);
    console.log(`  Maker: ${wallet2.address}\n`);

    console.log('🔍 Price Matching Check:');
    console.log(`  Buy Order Price: ${buyPriceCents}¢ (${buyPriceCents} cents)`);
    console.log(`  Sell Order Price: ${sellPriceCents}¢ (${sellPriceCents} cents)`);
    console.log(`  Buy Whole Cents: ${Math.floor(buyPriceCents)}`);
    console.log(`  Sell Whole Cents: ${Math.floor(sellPriceCents)}`);
    console.log(`  Should Match: ${Math.floor(buyPriceCents) >= Math.floor(sellPriceCents) ? '✅ YES' : '❌ NO'}\n`);

    const sellResult = await placeOrder(sellOrder, sellSignature, false);
    console.log('✅ Order placed:', sellResult);
    console.log(`  Order ID: ${sellResult.orderId}`);
    console.log(`  Status: ${sellResult.status}`);
    
    if (sellResult.matches && sellResult.matches.length > 0) {
      console.log(`  Matches Found: ${sellResult.matches.length}`);
      sellResult.matches.forEach((match, idx) => {
        console.log(`    Match ${idx + 1}:`);
        console.log(`      Fill Size: ${ethers.utils.formatEther(match.fillSize)} ETH`);
        console.log(`      Fill Price: ${ticksToCents(parseInt(match.fillPrice))}¢`);
      });
    }
    console.log();

    // Wait for matching service to process
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 4: Check Order Book Again
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 4: Check Order Book After Matching');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const orderBookAfter = await getOrderBook(marketId, outcomeId);
    console.log('📊 Updated Order Book:');
    console.log(JSON.stringify(orderBookAfter, null, 2));
    console.log();

    // Test 5: Check User Orders
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 5: Check User Orders');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const account1Orders = await getUserOrders(wallet1.address);
    console.log(`📋 Account 1 (${wallet1.address}) Orders:`);
    console.log(JSON.stringify(account1Orders, null, 2));
    console.log();

    const account2Orders = await getUserOrders(wallet2.address);
    console.log(`📋 Account 2 (${wallet2.address}) Orders:`);
    console.log(JSON.stringify(account2Orders, null, 2));
    console.log();

    // Test 6: Test Market Order
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 6: Place Market Buy Order (Account 1)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const marketBuySize = ethers.utils.parseEther('0.02'); // 0.02 ETH

    const marketBuyOrderData = {
      maker: wallet1.address,
      marketId,
      outcomeId,
      price: '0', // Market orders don't need price
      size: marketBuySize.toString(),
      side: true, // buy
      expiry,
      salt: generateSalt()
    };

    const { order: marketBuyOrder, signature: marketBuySignature } = await createAndSignOrder(wallet1, marketBuyOrderData);
    
    console.log('📝 Market Order Details:');
    console.log(`  Type: Market Buy`);
    console.log(`  Size: ${ethers.utils.formatEther(marketBuySize)} ETH`);
    console.log(`  Maker: ${wallet1.address}\n`);

    const marketBuyResult = await placeOrder(marketBuyOrder, marketBuySignature, true);
    console.log('✅ Market Order Result:', marketBuyResult);
    console.log(`  Status: ${marketBuyResult.status}`);
    if (marketBuyResult.status === 'no_matches') {
      console.log(`  ⚠️  No matches - would use AMM fallback`);
    }
    console.log();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All Tests Completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testOrderSystem().catch(console.error);

