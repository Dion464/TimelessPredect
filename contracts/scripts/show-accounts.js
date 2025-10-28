const { ethers } = require("hardhat");

async function main() {
    console.log("🔑 Available Hardhat Accounts:\n");
    
    const signers = await ethers.getSigners();
    
    for (let i = 0; i < Math.min(5, signers.length); i++) {
        const signer = signers[i];
        const balance = await signer.getBalance();
        
        console.log(`Account ${i + 1}:`);
        console.log(`Address: ${signer.address}`);
        console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH`);
        console.log(`Private Key: Available in Hardhat config`);
        console.log("---");
    }
    
    // Show the standard Hardhat private keys
    const hardhatPrivateKeys = [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Account 1
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Account 2
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Account 3
        "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // Account 4
        "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"  // Account 5
    ];
    
    console.log("\n🔐 Private Keys to Import:");
    for (let i = 0; i < hardhatPrivateKeys.length; i++) {
        console.log(`Account ${i + 1}: ${hardhatPrivateKeys[i]}`);
    }
    
    console.log("\n💡 Import any of these private keys into MetaMask!");
    console.log("Each account should have 10,000 ETH on Hardhat Local network.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
