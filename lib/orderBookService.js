const prisma = require('./prismaClient.js');
const { ethers } = require('ethers');
const { createTradeActivity } = require('./activityService.js');

const ORDER_STATUS = {
  OPEN: 'OPEN',
  PARTIAL: 'PARTIAL',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
};

const USER_STATUS_MAP = {
  OPEN: 'open',
  PARTIAL: 'partially_filled',
  FILLED: 'filled',
  CANCELLED: 'cancelled',
};

const parseBigInt = (value) => {
  if (value === null || value === undefined) {
    return 0n;
  }
  return typeof value === 'bigint' ? value : BigInt(value.toString());
};

const ticksToCents = (ticks) => ticks / 100;

const formatBookOrder = (order) => {
  const remaining = parseBigInt(order.remainingWei ?? order.remaining_wei);
  return {
    id: order.id.toString(),
    maker: order.maker,
    marketId: order.marketId?.toString?.() ?? order.market_id?.toString?.(),
    outcomeId: order.outcomeId ?? order.outcome_id,
    price: ticksToCents(order.priceTicks ?? order.price_ticks),
    ticks: order.priceTicks ?? order.price_ticks,
    amount: parseFloat(ethers.utils.formatEther(remaining)),
    remainingWei: remaining.toString(),
    side: order.side ?? order.is_buy ? 'buy' : 'sell',
    status: USER_STATUS_MAP[order.status] ?? order.status?.toLowerCase?.() ?? 'open',
    createdAt: order.createdAt?.toISOString?.() ?? order.created_at?.toISOString?.(),
  };
};

const formatUserOrder = (order) => {
  const remaining = parseBigInt(order.remainingWei ?? order.remaining_wei);
  const size = parseBigInt(order.sizeWei ?? order.size_wei);
  const filled = size - remaining;

  return {
    id: order.id.toString(),
    marketId: order.marketId.toString(),
    outcomeId: order.outcomeId,
    priceTicks: order.priceTicks,
    price: ticksToCents(order.priceTicks),
    sizeWei: size.toString(),
    amount: parseFloat(ethers.utils.formatEther(size)),
    remainingWei: remaining.toString(),
    remainingAmount: parseFloat(ethers.utils.formatEther(remaining)),
    filledWei: filled.toString(),
    filledAmount: parseFloat(ethers.utils.formatEther(filled)),
    side: order.side ? 'buy' : 'sell',
    status: USER_STATUS_MAP[order.status] ?? order.status.toLowerCase(),
    signature: order.signature,
    createdAt: order.createdAt.toISOString(),
  };
};

async function getOrderBook({ marketId, outcomeId, depth = 10 }) {
  const normalizedMarketId = BigInt(marketId);
  const normalizedOutcomeId = parseInt(outcomeId, 10);
  const limit = Math.max(1, Math.min(depth, 100));

  const [asks, bids] = await Promise.all([
    prisma.order.findMany({
      where: {
        marketId: normalizedMarketId,
        outcomeId: normalizedOutcomeId,
        side: false,
        status: { in: [ORDER_STATUS.OPEN, ORDER_STATUS.PARTIAL] },
      },
      orderBy: [
        { priceTicks: 'asc' },
        { createdAt: 'asc' },
      ],
      take: limit,
    }),
    prisma.order.findMany({
      where: {
        marketId: normalizedMarketId,
        outcomeId: normalizedOutcomeId,
        side: true,
        status: { in: [ORDER_STATUS.OPEN, ORDER_STATUS.PARTIAL] },
      },
      orderBy: [
        { priceTicks: 'desc' },
        { createdAt: 'asc' },
      ],
      take: limit,
    }),
  ]);

  return {
    marketId: normalizedMarketId.toString(),
    outcomeId: normalizedOutcomeId,
    bids: bids.map(formatBookOrder),
    asks: asks.map(formatBookOrder),
  };
}

async function getUserOrders({ userAddress, marketId }) {
  if (!userAddress) return [];

  const where = {
    maker: userAddress.toLowerCase(),
  };

  if (marketId) {
    where.marketId = BigInt(marketId);
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: [
      { createdAt: 'desc' },
    ],
    take: 200,
  });

  return orders.map(formatUserOrder);
}

const getStatusAfterFill = (remaining, totalSize) => {
  if (remaining === 0n) return ORDER_STATUS.FILLED;
  if (remaining === totalSize) return ORDER_STATUS.OPEN;
  return ORDER_STATUS.PARTIAL;
};

const getOppositePriceFilter = (side, priceTicks, isMarketOrder) => {
  if (isMarketOrder) {
    return undefined;
  }

  if (side) {
    // incoming buy order -> match asks <= price
    return { lte: priceTicks };
  }

  // incoming sell order -> match bids >= price
  return { gte: priceTicks };
};

async function createOrderAndMatch({ order, signature, isMarketOrder = false }) {
  if (!order || !signature) {
    throw new Error('Order and signature are required');
  }

  const marketId = BigInt(order.marketId);
  const outcomeId = parseInt(order.outcomeId, 10);
  const priceTicks = parseInt(order.price ?? order.priceTicks, 10);
  const side = order.side === true || order.side === 'buy' || order.side === 1;
  const sizeWei = parseBigInt(order.size ?? order.sizeWei);

  if (!Number.isFinite(priceTicks)) {
    throw new Error('Invalid price provided');
  }

  const result = {
    status: 'open',
    fills: [],
    order: null,
    remaining: sizeWei.toString(),
  };

  await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: {
        maker: order.maker.toLowerCase(),
        marketId,
        outcomeId,
        priceTicks,
        sizeWei: sizeWei.toString(),
        remainingWei: sizeWei.toString(),
        side,
        status: ORDER_STATUS.OPEN,
        signature,
        salt: order.salt ?? null,
        expiry: order.expiry ? new Date(parseInt(order.expiry, 10) * 1000) : null,
        orderHash: order.orderHash ?? null,
      },
    });

    let remaining = sizeWei;
    const priceCondition = getOppositePriceFilter(side, priceTicks, isMarketOrder);

    const oppositeOrders = await tx.order.findMany({
      where: {
        marketId,
        outcomeId,
        side: !side,
        status: { in: [ORDER_STATUS.OPEN, ORDER_STATUS.PARTIAL] },
        ...(priceCondition ? { priceTicks: priceCondition } : {}),
      },
      orderBy: side
        ? [{ priceTicks: 'asc' }, { createdAt: 'asc' }]
        : [{ priceTicks: 'desc' }, { createdAt: 'asc' }],
    });

    const fills = [];
    const fillOrderData = []; // Store order data for activity events

    for (const existing of oppositeOrders) {
      if (remaining <= 0n) break;

      const available = parseBigInt(existing.remainingWei);
      if (available <= 0n) continue;

      const fillSize = remaining < available ? remaining : available;
      if (fillSize <= 0n) continue;

      remaining -= fillSize;
      const newExistingRemaining = available - fillSize;
      const existingStatus = getStatusAfterFill(newExistingRemaining, parseBigInt(existing.sizeWei));

      await tx.order.update({
        where: { id: existing.id },
        data: {
          remainingWei: newExistingRemaining.toString(),
          status: existingStatus,
        },
      });

      const fillRecord = await tx.orderFill.create({
        data: {
          makerOrderId: existing.id,
          takerOrderId: createdOrder.id,
          marketId,
          outcomeId,
          fillSizeWei: fillSize.toString(),
          fillPriceTicks: existing.priceTicks,
        },
      });

      fills.push({
        id: fillRecord.id.toString(),
        makerOrderId: existing.id.toString(),
        takerOrderId: createdOrder.id.toString(),
        fillSizeWei: fillSize.toString(),
        fillPriceTicks: existing.priceTicks,
      });

      // Store order data for activity events
      fillOrderData.push({
        makerOrderId: existing.id.toString(),
        makerAddress: existing.maker,
        makerIsBuying: existing.side,
        fillSizeWei: fillSize.toString(),
        fillPriceTicks: existing.priceTicks,
      });
    }

    // Create activity events for fills (after transaction completes, async, non-blocking)
    if (fills.length > 0 && fillOrderData.length > 0) {
      // Get market info once (async, non-blocking)
      prisma.market.findUnique({
        where: { marketId },
      }).then(market => {
        // Create activity events for each fill
        fills.forEach((fill, index) => {
          const orderData = fillOrderData[index];
          if (!orderData) return;

          // The maker order is the existing order, taker is the new order
          // If maker is buying (side=true), then taker is selling
          const makerIsBuying = orderData.makerIsBuying;
          const fillUser = makerIsBuying ? orderData.makerAddress : order.maker;
          const fillIsYes = outcomeId === 0; // 0 = YES, 1 = NO
          const priceBps = parseInt(orderData.fillPriceTicks, 10) * 100;
          const costWei = (BigInt(orderData.fillSizeWei) * BigInt(parseInt(orderData.fillPriceTicks, 10)) / 10000n).toString();

          if (fillUser) {
            // isBuy is true because fillUser is always the buyer in this logic
            createTradeActivity({
              marketId,
              userAddress: fillUser,
              isYes: fillIsYes,
              isBuy: true, // fillUser is always the buyer
              sharesWei: orderData.fillSizeWei,
              priceBps,
              costWei,
              txHash: null, // Limit orders don't have tx hash yet
              blockNumber: null,
              blockTime: new Date(),
              market,
            }).catch(err => console.error('Failed to create activity for order fill:', err));
          }
        });
      }).catch(() => {
        // If market fetch fails, still try to create events without market info
        fills.forEach((fill, index) => {
          const orderData = fillOrderData[index];
          if (!orderData) return;

          const makerIsBuying = orderData.makerIsBuying;
          const fillUser = makerIsBuying ? orderData.makerAddress : order.maker;
          const fillIsYes = outcomeId === 0;
          const priceBps = parseInt(orderData.fillPriceTicks, 10) * 100;
          const costWei = (BigInt(orderData.fillSizeWei) * BigInt(parseInt(orderData.fillPriceTicks, 10)) / 10000n).toString();

          if (fillUser) {
            // isBuy is true because fillUser is always the buyer in this logic
            createTradeActivity({
              marketId,
              userAddress: fillUser,
              isYes: fillIsYes,
              isBuy: true, // fillUser is always the buyer
              sharesWei: orderData.fillSizeWei,
              priceBps,
              costWei,
              txHash: null,
              blockNumber: null,
              blockTime: new Date(),
              market: null,
            }).catch(err => console.error('Failed to create activity for order fill:', err));
          }
        });
      });
    }

    const newStatus = getStatusAfterFill(remaining, sizeWei);

    const updatedOrder = await tx.order.update({
      where: { id: createdOrder.id },
      data: {
        remainingWei: remaining.toString(),
        status: newStatus,
      },
    });

    result.fills = fills;
    result.matches = fills;
    result.order = formatUserOrder(updatedOrder);
    result.remaining = remaining.toString();

    if (fills.length === 0) {
      result.status = 'open';
    } else if (remaining === 0n) {
      result.status = 'matched';
    } else {
      result.status = 'partially_filled';
    }
  });

  return result;
}

async function cancelOrder({ orderId, userAddress }) {
  const id = BigInt(orderId);
  const order = await prisma.order.findUnique({
    where: { id },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (userAddress && order.maker !== userAddress.toLowerCase()) {
    throw new Error('Not authorized to cancel this order');
  }

  if (order.status === ORDER_STATUS.FILLED) {
    throw new Error('Order already filled');
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: ORDER_STATUS.CANCELLED,
      remainingWei: '0',
    },
  });

  return formatUserOrder(updated);
}

module.exports = {
  getOrderBook,
  getUserOrders,
  createOrderAndMatch,
  cancelOrder,
};

