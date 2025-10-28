// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @dev Mock USDC token for testing purposes
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private _decimals = 6; // USDC has 6 decimals
    
    constructor() ERC20("Mock USD Coin", "USDC") {
        // Mint 1 million USDC to deployer for testing
        _mint(msg.sender, 1000000 * 10**_decimals);
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint tokens to any address (for testing)
     * @param to Address to mint tokens to
     * @param amount Amount to mint (in wei, considering 6 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev Faucet function - anyone can get 1000 USDC for testing
     */
    function faucet() external {
        require(balanceOf(msg.sender) < 10000 * 10**_decimals, "Already have enough USDC");
        _mint(msg.sender, 1000 * 10**_decimals); // Mint 1000 USDC
    }
    
    /**
     * @dev Faucet function with custom amount (owner only)
     * @param to Address to send tokens to
     * @param amount Amount in USDC (will be converted to wei)
     */
    function faucetTo(address to, uint256 amount) external onlyOwner {
        _mint(to, amount * 10**_decimals);
    }
}
