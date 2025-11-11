/**
 * Price Formatting Utilities
 * Converts prices from cents/basis points to TCENT
 */

/**
 * Convert price from cents (0-100) to TCENT (0.00-1.00)
 * @param {number} cents - Price in cents (50 = 50¢)
 * @returns {string} - Price in TCENT format (0.50 TCENT)
 */
export const centsToTCENT = (cents) => {
  if (cents === undefined || cents === null) return '0.00';
  const tcent = cents / 100;
  return tcent.toFixed(2);
};

/**
 * Convert basis points (0-10000) to TCENT (0.00-1.00)
 * @param {number} basisPoints - Price in basis points (5000 = 50%)
 * @returns {string} - Price in TCENT format (0.50 TCENT)
 */
export const basisPointsToTCENT = (basisPoints) => {
  if (basisPoints === undefined || basisPoints === null) return '0.00';
  const tcent = basisPoints / 10000;
  return tcent.toFixed(2);
};

/**
 * Format price for display (removes $ sign, adds TCENT)
 * @param {number} price - Price value
 * @param {string} unit - Unit to display ('TCENT', 'shares', etc)
 * @returns {string} - Formatted price string
 */
export const formatPrice = (price, unit = 'TCENT') => {
  if (price === undefined || price === null) return `0.00 ${unit}`;
  return `${parseFloat(price).toFixed(2)} ${unit}`;
};

/**
 * Format volume for display
 * @param {number} volume - Volume in TCENT
 * @returns {string} - Formatted volume string
 */
export const formatVolume = (volume) => {
  if (!volume || volume === 0) return '0.00';
  
  // If volume is in Wei (very large number), convert to TCENT
  if (volume > 1e12) {
    const tcent = volume / 1e18;
    return tcent.toFixed(2);
  }
  
  return parseFloat(volume).toFixed(2);
};

/**
 * Remove dollar signs from string
 * @param {string} str - String potentially containing $
 * @returns {string} - String without $
 */
export const removeDollarSign = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/\$/g, '');
};

