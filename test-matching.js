#!/usr/bin/env node
/**
 * Order Matching Test - Whole Cent Matching
 * Tests that orders match correctly when prices match on whole cents
 * 
 * Usage: node test-matching.js <marketId>
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

async function testWholeCentMatching() {
  console.log('\n🧪 Testing Whole Cent Matching Logic\n');
  
  const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);
  const wallet1 = new ethers.Wallet(ACCOUNT1_PRIVATE_KEY, provider);
  const wallet2 = new ethers.Wallet(ACCOUNT2_PRIVATE_KEY, provider);

  const marketId = process.argv[2] || '1';
  const outcomeId = 0; // YES
  const expiry = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

  console.log(`Market ID: ${marketId}, Outcome: YES (${outcomeId})\n`);

  try {
    // Test Case 1: Buy at 42.67¢, Sell at 42.50¢ - Should match (same whole cents: 42)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST CASE 1: Whole Cent Matching (42.67¢ ↔ 42.50¢)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Place buy order at 42.67¢
    const buyPriceCents = 42.67;
    const buyPriceTicks = centsToTicks(buyPriceCents);
    const buySize = ethers.utils.parseEther('0.1');

    const buyOrderData = {
      maker: wallet1.address,
      marketId,
      outcomeId,
      price: buyPriceTicks.toString(),
      size: buySize.toString(),
      side: true,
      expiry,
      salt: generateSalt()
    };

    const { order: buyOrder, signature: buySignature } = await createAndSignOrder(wallet1, buyOrderData);
    console.log(`📝 Buy Order: ${buyPriceCents}¢ (${buyPriceTicks} ticks)`);
    
    const buyResult = await placeOrder(buyOrder, buySignature);
    console.log(`✅ Buy order placed: ${buyResult.orderId}, Status: ${buyResult.status}\n`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Place sell order at 42.50¢ (should match - same whole cents: 42)
    const sellPriceCents = 42.50;
    const sellPriceTicks = centsToTicks(sellPriceCents);
    const sellSize = ethers.utils.parseEther('0.05');

    const sellOrderData = {
      maker: wallet2.address,
      marketId,
      outcomeId,
      price: sellPriceTicks.toString(),
      size: sellSize.toString(),
      side: false,
      expiry,
      salt: generateSalt()
    };

    const { order: sellOrder, signature: sellSignature } = await createAndSignOrder(wallet2, sellOrderData);
    console.log(`📝 Sell Order: ${sellPriceCents}¢ (${sellPriceTicks} ticks)`);
    console.log(`🔍 Whole Cents Check:`);
    console.log(`   Buy: ${Math.floor(buyPriceCents)} cents`);
    console.log(`   Sell: ${Math.floor(sellPriceCents)} cents`);
    console.log(`   Should Match: ${Math.floor(buyPriceCents) >= Math.floor(sellPriceCents) ? '✅ YES' : '❌ NO'}\n`);

    const sellResult = await placeOrder(sellOrder, sellSignature);
    console.log(`✅ Sell order result:`);
    console.log(`   Order ID: ${sellResult.orderId}`);
    console.log(`   Status: ${sellResult.status}`);
    
    if (sellResult.matches && sellResult.matches.length > 0) {
      console.log(`   ✅ MATCHED! Found ${sellResult.matches.length} match(es)`);
      sellResult.matches.forEach((match, idx) => {
        const matchPriceCents = parseInt(match.fillPrice) / 100;
        console.log(`   Match ${idx + 1}:`);
        console.log(`     Fill Size: ${ethers.utils.formatEther(match.fillSize)} ETH`);
        console.log(`     Fill Price: ${matchPriceCents}¢`);
      });
    } else {
      console.log(`   ⚠️  No matches found`);
    }
    console.log();

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test Case 2: Buy at 43.00¢, Sell at 42.99¢ - Should NOT match (different whole cents)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST CASE 2: Different Whole Cents (43.00¢ ↔ 42.99¢)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const buyPriceCents2 = 43.00;
    const buyPriceTicks2 = centsToTicks(buyPriceCents2);

    const buyOrderData2 = {
      maker: wallet1.address,
      marketId,
      outcomeId,
      price: buyPriceTicks2.toString(),
      size: buySize.toString(),
      side: true,
      expiry,
      salt: generateSalt()
    };

    const { order: buyOrder2, signature: buySignature2 } = await createAndSignOrder(wallet1, buyOrderData2);
    console.log(`📝 Buy Order: ${buyPriceCents2}¢ (${buyPriceTicks2} ticks)`);
    
    const buyResult2 = await placeOrder(buyOrder2, buySignature2);
    console.log(`✅ Buy order placed: ${buyResult2.orderId}, Status: ${buyResult2.status}\n`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Place sell order at 42.99¢ (should NOT match - different whole cents: 43 vs 42)
    const sellPriceCents2 = 42.99;
    const sellPriceTicks2 = centsToTicks(sellPriceCents2);

    const sellOrderData2 = {
      maker: wallet2.address,
      marketId,
      outcomeId,
      price: sellPriceTicks2.toString(),
      size: sellSize.toString(),
      side: false,
      expiry,
      salt: generateSalt()
    };

    const { order: sellOrder2, signature: sellSignature2 } = await createAndSignOrder(wallet2, sellOrderData2);
    console.log(`📝 Sell Order: ${sellPriceCents2}¢ (${sellPriceTicks2} ticks)`);
    console.log(`🔍 Whole Cents Check:`);
    console.log(`   Buy: ${Math.floor(buyPriceCents2)} cents`);
    console.log(`   Sell: ${Math.floor(sellPriceCents2)} cents`);
    console.log(`   Should Match: ${Math.floor(buyPriceCents2) >= Math.floor(sellPriceCents2) ? '✅ YES' : '❌ NO'}\n`);

    const sellResult2 = await placeOrder(sellOrder2, sellSignature2);
    console.log(`✅ Sell order result:`);
    console.log(`   Order ID: ${sellResult2.orderId}`);
    console.log(`   Status: ${sellResult2.status}`);
    
    if (sellResult2.matches && sellResult2.matches.length > 0) {
      console.log(`   ✅ MATCHED! Found ${sellResult2.matches.length} match(es)`);
    } else {
      console.log(`   ⚠️  No matches (expected - different whole cents)`);
    }
    console.log();

    // Final Order Book Check
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Final Order Book Status');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const finalBook = await getOrderBook(marketId, outcomeId);
    console.log('📊 Order Book:');
    console.log(JSON.stringify(finalBook, null, 2));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Matching Test Completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testWholeCentMatching().catch(console.error);

