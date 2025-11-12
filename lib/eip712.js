/**
 * EIP-712 Signature Verification Utilities
 * Matches the Exchange.sol contract structure
 */

import { ethers } from 'ethers';

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

/**
 * Get EIP-712 domain separator
 */
export function getDomain(chainId, verifyingContract) {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId: chainId,
    verifyingContract: verifyingContract
  };
}

/**
 * Create typed data for EIP-712 signing
 */
export function createOrderTypedData(order, chainId, verifyingContract) {
  const domain = getDomain(chainId, verifyingContract);
  
  return {
    domain,
    types: ORDER_TYPE,
    primaryType: 'Order',
    message: {
      maker: order.maker,
      marketId: order.marketId.toString(),
      outcomeId: order.outcomeId.toString(),
      price: order.price.toString(),
      size: order.size.toString(),
      side: order.side,
      expiry: order.expiry.toString(),
      salt: order.salt.toString()
    }
  };
}

/**
 * Verify EIP-712 signature
 */
export function verifyOrderSignature(order, signature, chainId, verifyingContract) {
  try {
    // Ensure all values are strings/numbers as expected
    const normalizedOrder = {
      maker: order.maker.toLowerCase(),
      marketId: order.marketId.toString(),
      outcomeId: order.outcomeId.toString(),
      price: order.price.toString(),
      size: order.size.toString(),
      side: Boolean(order.side),
      expiry: order.expiry.toString(),
      salt: order.salt.toString()
    };
    
    const typedData = createOrderTypedData(normalizedOrder, chainId, verifyingContract);
    
    console.log('🔍 Verifying signature with:', {
      domain: typedData.domain,
      messageKeys: Object.keys(typedData.message),
      message: typedData.message
    });
    
    const messageHash = ethers.utils._TypedDataEncoder.hash(
      typedData.domain,
      typedData.types,
      typedData.message
    );
    
    const recoveredAddress = ethers.utils.recoverAddress(messageHash, signature);
    const isMatch = recoveredAddress.toLowerCase() === normalizedOrder.maker.toLowerCase();
    
    console.log('🔍 Signature verification:', {
      recoveredAddress: recoveredAddress.toLowerCase(),
      expectedMaker: normalizedOrder.maker,
      match: isMatch
    });
    
    return isMatch;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Recover signer from signature
 */
export function recoverOrderSigner(order, signature, chainId, verifyingContract) {
  try {
    const typedData = createOrderTypedData(order, chainId, verifyingContract);
    const messageHash = ethers.utils._TypedDataEncoder.hash(
      typedData.domain,
      typedData.types,
      typedData.message
    );
    
    return ethers.utils.recoverAddress(messageHash, signature);
  } catch (error) {
    console.error('Signature recovery error:', error);
    return null;
  }
}

/**
 * Compute order hash (matches contract's getOrderHash)
 */
export function computeOrderHash(order, chainId, verifyingContract) {
  const typedData = createOrderTypedData(order, chainId, verifyingContract);
  return ethers.utils._TypedDataEncoder.hash(
    typedData.domain,
    typedData.types,
    typedData.message
  );
}

