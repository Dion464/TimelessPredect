const { ethers } = require("hardhat");

/**
 * Deploy Exchange contract for hybrid CLOB order system
 * 
 * Requires:
 * - USDC or payment token address
 * - Outcome token contract (ERC-1155 CTF-style)
 * - Treasury address for fees
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Exchange contract with account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()));

  // Contract addresses - update these for your network
  const PAYMENT_TOKEN = process.env.PAYMENT_TOKEN_ADDRESS || ethers.constants.AddressZero; // USDC
  const OUTCOME_TOKEN = process.env.OUTCOME_TOKEN_ADDRESS || ethers.constants.AddressZero; // ERC-1155 CTF
  const TREASURY = process.env.TREASURY_ADDRESS || deployer.address;

  if (PAYMENT_TOKEN === ethers.constants.AddressZero) {
    console.warn("⚠️  PAYMENT_TOKEN_ADDRESS not set, using zero address");
  }
  if (OUTCOME_TOKEN === ethers.constants.AddressZero) {
    console.warn("⚠️  OUTCOME_TOKEN_ADDRESS not set, using zero address");
  }

  console.log("\n📋 Deployment Configuration:");
  console.log("  Payment Token:", PAYMENT_TOKEN);
  console.log("  Outcome Token:", OUTCOME_TOKEN);
  console.log("  Treasury:", TREASURY);

  // Deploy Exchange
  const Exchange = await ethers.getContractFactory("Exchange");
  const exchange = await Exchange.deploy(
    PAYMENT_TOKEN,
    OUTCOME_TOKEN,
    TREASURY
  );

  await exchange.deployed();

  console.log("\n✅ Exchange deployed to:", exchange.address);
  console.log("  Transaction hash:", exchange.deployTransaction.hash);

  // Get domain separator
  const domainSeparator = await exchange.DOMAIN_SEPARATOR();
  console.log("\n📝 Domain Separator:", domainSeparator);

  // Get network info
  const network = await ethers.provider.getNetwork();

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId,
    exchangeAddress: exchange.address,
    paymentToken: PAYMENT_TOKEN,
    outcomeToken: OUTCOME_TOKEN,
    treasury: TREASURY,
    domainSeparator: domainSeparator,
    deployer: deployer.address,
    deployedAt: new Date().toISOString()
  };

  console.log("\n📦 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require('fs');
  const path = require('path');
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const networkName = network.name === 'hardhat' ? 'localhost' : network.name;
  const deploymentFile = path.join(deploymentsDir, `exchange-${networkName}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${deploymentFile}`);

  console.log("\n🎉 Exchange contract deployment complete!");
  console.log("\n📌 Next steps:");
  console.log("  1. Set EXCHANGE_CONTRACT_ADDRESS in your .env file");
  console.log("  2. Set CHAIN_ID in your .env file");
  console.log("  3. Deploy outcome token contract (ERC-1155) if not already deployed");
  console.log("  4. Approve Exchange contract to spend payment tokens");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

