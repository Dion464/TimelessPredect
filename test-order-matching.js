#!/usr/bin/env node
/**
 * Test Order Matching with Same Prices
 * Tests if orders with matching prices are being bought/sold correctly
 * 
 * Usage: node test-order-matching.js <marketId>
 */

import 'dotenv/config';
import { ethers } from 'ethers';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const PROVIDER_URL = process.env.PROVIDER_URL || 'http://localhost:8545';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1337', 10);
const EXCHANGE_CONTRACT = process.env.EXCHANGE_CONTRACT_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9';

const ACCOUNT1_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ACCOUNT2_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

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
  return Math.floor(cents * 100);
}

function ticksToCents(ticks) {
  return ticks / 100;
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
  const signature = await wallet._signTypedData(domain, ORDER_TYPE, order);
  return { order, signature };
}

async function placeOrder(order, signature) {
  const response = await fetch(`${API_BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order, signature, isMarketOrder: false })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

async function getOrderBook(marketId, outcomeId) {
  const response = await fetch(`${API_BASE_URL}/api/orders?marketId=${marketId}&outcomeId=${outcomeId}`);
  return await response.json();
}

async function getUserOrders(userAddress) {
  const response = await fetch(`${API_BASE_URL}/api/orders?user=${userAddress}`);
  return await response.json();
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testOrderMatching() {
  console.log('\n🧪 Testing Order Matching with Same Prices\n');
  
  const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);
  const wallet1 = new ethers.Wallet(ACCOUNT1_PRIVATE_KEY, provider);
  const wallet2 = new ethers.Wallet(ACCOUNT2_PRIVATE_KEY, provider);

  const marketId = process.argv[2] || '8';
  const outcomeId = 0; // YES
  const expiry = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

  console.log(`Market ID: ${marketId}, Outcome: YES (${outcomeId})\n`);
  console.log(`Account 1: ${wallet1.address}`);
  console.log(`Account 2: ${wallet2.address}\n`);

  try {
    // Check current order book
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 1: Check Current Order Book');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const initialBook = await getOrderBook(marketId, outcomeId);
    console.log('Current Order Book:');
    console.log(`  Bids (Buy Orders): ${initialBook.bids?.length || 0}`);
    console.log(`  Asks (Sell Orders): ${initialBook.asks?.length || 0}\n`);

    // Test Case: Place Buy and Sell orders at EXACT SAME PRICE
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 2: Place Buy Order (Account 1)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const testPriceCents = 47.5; // Same price as shown in image
    const testPriceTicks = centsToTicks(testPriceCents);
    const buySize = ethers.utils.parseEther('0.1');

    const buyOrderData = {
      maker: wallet1.address,
      marketId,
      outcomeId,
      price: testPriceTicks.toString(),
      size: buySize.toString(),
      side: true, // buy
      expiry,
      salt: generateSalt()
    };

    const { order: buyOrder, signature: buySignature } = await createAndSignOrder(wallet1, buyOrderData);
    console.log(`📝 Buy Order:`);
    console.log(`   Price: ${testPriceCents}¢ (${testPriceTicks} ticks)`);
    console.log(`   Whole Cents: ${Math.floor(testPriceCents)}`);
    console.log(`   Size: ${ethers.utils.formatEther(buySize)} ETH`);
    console.log(`   Side: YES (buy)\n`);

    const buyResult = await placeOrder(buyOrder, buySignature);
    console.log(`✅ Buy order placed:`);
    console.log(`   Order ID: ${buyResult.orderId}`);
    console.log(`   Status: ${buyResult.status}`);
    
    if (buyResult.matches && buyResult.matches.length > 0) {
      console.log(`   ⚡ IMMEDIATE MATCH! Found ${buyResult.matches.length} match(es)`);
      buyResult.matches.forEach((match, idx) => {
        console.log(`      Match ${idx + 1}: ${ethers.utils.formatEther(match.fillSize)} ETH @ ${ticksToCents(parseInt(match.fillPrice))}¢`);
      });
    } else {
      console.log(`   ⏳ Order added to book (waiting for match)`);
    }
    console.log();

    await wait(2000); // Wait 2 seconds

    // Check order book after buy order
    const bookAfterBuy = await getOrderBook(marketId, outcomeId);
    console.log('Order Book After Buy:');
    console.log(`  Bids: ${bookAfterBuy.bids?.length || 0}`);
    console.log(`  Asks: ${bookAfterBuy.asks?.length || 0}\n`);

    // Place Sell Order at EXACT SAME PRICE
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 3: Place Sell Order (Account 2) - SAME PRICE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const sellPriceCents = 47.5; // EXACT SAME PRICE
    const sellPriceTicks = centsToTicks(sellPriceCents);
    const sellSize = ethers.utils.parseEther('0.1');

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
    console.log(`📝 Sell Order:`);
    console.log(`   Price: ${sellPriceCents}¢ (${sellPriceTicks} ticks)`);
    console.log(`   Whole Cents: ${Math.floor(sellPriceCents)}`);
    console.log(`   Size: ${ethers.utils.formatEther(sellSize)} ETH`);
    console.log(`   Side: NO (sell)\n`);

    console.log(`🔍 Price Matching Check:`);
    console.log(`   Buy Price: ${testPriceCents}¢ (${Math.floor(testPriceCents)} cents)`);
    console.log(`   Sell Price: ${sellPriceCents}¢ (${Math.floor(sellPriceCents)} cents)`);
    console.log(`   Same Whole Cents: ${Math.floor(testPriceCents) === Math.floor(sellPriceCents) ? '✅ YES' : '❌ NO'}`);
    console.log(`   Should Match: ${Math.floor(testPriceCents) >= Math.floor(sellPriceCents) ? '✅ YES' : '❌ NO'}\n`);

    const sellResult = await placeOrder(sellOrder, sellSignature);
    console.log(`✅ Sell order placed:`);
    console.log(`   Order ID: ${sellResult.orderId}`);
    console.log(`   Status: ${sellResult.status}`);
    
    if (sellResult.matches && sellResult.matches.length > 0) {
      console.log(`   ⚡ IMMEDIATE MATCH! Found ${sellResult.matches.length} match(es)`);
      sellResult.matches.forEach((match, idx) => {
        console.log(`      Match ${idx + 1}:`);
        console.log(`         Fill Size: ${ethers.utils.formatEther(match.fillSize)} ETH`);
        console.log(`         Fill Price: ${ticksToCents(parseInt(match.fillPrice))}¢`);
        console.log(`         Maker Order ID: ${match.makerOrder?.id || 'N/A'}`);
      });
    } else {
      console.log(`   ⏳ Order added to book (waiting for matcher service)`);
    }
    console.log();

    // Wait for matching service to process (runs every 5 seconds)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 4: Waiting for Matching Service (6 seconds)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    await wait(6000);

    // Check order book again
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 5: Check Order Book After Matching');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const finalBook = await getOrderBook(marketId, outcomeId);
    console.log('Final Order Book:');
    console.log(`  Bids (Buy Orders): ${finalBook.bids?.length || 0}`);
    if (finalBook.bids && finalBook.bids.length > 0) {
      finalBook.bids.forEach(bid => {
        console.log(`    - Order ${bid.orderId}: ${ticksToCents(parseInt(bid.price))}¢, Remaining: ${ethers.utils.formatEther(bid.remaining)} ETH`);
      });
    }
    console.log(`  Asks (Sell Orders): ${finalBook.asks?.length || 0}`);
    if (finalBook.asks && finalBook.asks.length > 0) {
      finalBook.asks.forEach(ask => {
        console.log(`    - Order ${ask.orderId}: ${ticksToCents(parseInt(ask.price))}¢, Remaining: ${ethers.utils.formatEther(ask.remaining)} ETH`);
      });
    }
    console.log();

    // Check user orders
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Step 6: Check User Orders');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const account1OrdersData = await getUserOrders(wallet1.address);
    const account1Orders = Array.isArray(account1OrdersData) ? account1OrdersData : (account1OrdersData.orders || []);
    console.log(`Account 1 Orders (${account1Orders.length}):`);
    if (account1Orders.length === 0) {
      console.log('  (No open orders - all filled or canceled)');
    } else {
      account1Orders.forEach(order => {
        console.log(`  Order ${order.id}:`);
        console.log(`    Type: ${order.side ? 'BUY (YES)' : 'SELL (NO)'}`);
        console.log(`    Price: ${ticksToCents(parseInt(order.price))}¢`);
        console.log(`    Size: ${ethers.utils.formatEther(order.size)} ETH`);
        console.log(`    Status: ${order.status}`);
        console.log(`    Filled: ${order.filled ? ethers.utils.formatEther(order.filled) : '0'} ETH`);
      });
    }
    console.log();

    const account2OrdersData = await getUserOrders(wallet2.address);
    const account2Orders = Array.isArray(account2OrdersData) ? account2OrdersData : (account2OrdersData.orders || []);
    console.log(`Account 2 Orders (${account2Orders.length}):`);
    if (account2Orders.length === 0) {
      console.log('  (No open orders - all filled or canceled)');
    } else {
      account2Orders.forEach(order => {
        console.log(`  Order ${order.id}:`);
        console.log(`    Type: ${order.side ? 'BUY (YES)' : 'SELL (NO)'}`);
        console.log(`    Price: ${ticksToCents(parseInt(order.price))}¢`);
        console.log(`    Size: ${ethers.utils.formatEther(order.size)} ETH`);
        console.log(`    Status: ${order.status}`);
        console.log(`    Filled: ${order.filled ? ethers.utils.formatEther(order.filled) : '0'} ETH`);
      });
    }
    console.log();

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const buyOrdersOpen = account1Orders.filter(o => o.side && (o.status === 'open' || o.status === 'partially_filled')).length;
    const sellOrdersOpen = account2Orders.filter(o => !o.side && (o.status === 'open' || o.status === 'partially_filled')).length;
    
    if (buyOrdersOpen === 0 && sellOrdersOpen === 0) {
      console.log('✅ SUCCESS: All orders matched and filled!');
    } else {
      console.log(`⚠️  WARNING: Orders not matched:`);
      console.log(`   Account 1 Open Buy Orders: ${buyOrdersOpen}`);
      console.log(`   Account 2 Open Sell Orders: ${sellOrdersOpen}`);
      console.log(`\n   Possible issues:`);
      console.log(`   - Matching service not running`);
      console.log(`   - Orders in different markets/outcomes`);
      console.log(`   - Price matching logic issue`);
      console.log(`   - Settlement failing`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Test Completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testOrderMatching().catch(console.error);

