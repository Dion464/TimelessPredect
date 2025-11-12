const { ethers } = require("hardhat");

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
  const accounts = await provider.listAccounts();
  
  console.log("Hardhat Accounts & Balances:\n");
  for (let i = 0; i < Math.min(5, accounts.length); i++) {
    const balance = await provider.getBalance(accounts[i]);
    const ethBalance = ethers.utils.formatEther(balance);
    console.log(`Account ${i + 1}: ${accounts[i]}`);
    console.log(`  Balance: ${ethBalance} ETH\n`);
  }
}

main().catch(console.error);
