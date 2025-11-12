// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title Exchange
 * @notice Hybrid CLOB exchange for prediction markets
 * @dev Uses EIP-712 signatures for gasless order placement, on-chain settlement
 */
contract Exchange is ReentrancyGuard, Ownable, EIP712 {
    using ECDSA for bytes32;

    // EIP-712 type hash for order struct
    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address maker,uint256 marketId,uint256 outcomeId,uint256 price,uint256 size,bool side,uint256 expiry,uint256 salt)"
    );

    struct Order {
        address maker;        // Order creator
        uint256 marketId;     // Market identifier
        uint256 outcomeId;    // 0 = YES, 1 = NO
        uint256 price;        // Price in ticks (4000 = 0.04 = 4¢)
        uint256 size;         // Number of shares
        bool side;            // true = buy, false = sell
        uint256 expiry;       // Order expiration timestamp
        uint256 salt;         // Random nonce for uniqueness
        bytes signature;      // EIP-712 signature (not stored on-chain, passed in)
    }

    struct Trade {
        uint256 marketId;
        address maker;
        address taker;
        uint256 outcomeId;
        uint256 price;
        uint256 size;
        uint256 timestamp;
    }

    // State variables
    IERC20 public paymentToken; // USDC or similar
    IERC1155 public outcomeToken; // Conditional token framework (CTF) contract
    address public treasury; // Platform fee recipient
    uint256 public platformFeeBps = 20; // 0.2% in basis points

    // Order tracking
    mapping(bytes32 => bool) public orderFilled; // orderHash => filled
    mapping(bytes32 => bool) public orderCanceled; // orderHash => canceled
    mapping(address => mapping(uint256 => bool)) public usedSalts; // maker => salt => used
    
    Trade[] public trades;
    
    // Events
    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed taker,
        uint256 marketId,
        uint256 outcomeId,
        uint256 price,
        uint256 size,
        uint256 fee
    );
    
    event OrderCanceled(
        bytes32 indexed orderHash,
        address indexed maker
    );

    constructor(
        address _paymentToken,
        address _outcomeToken,
        address _treasury
    ) EIP712("Exchange", "1") {
        paymentToken = IERC20(_paymentToken);
        outcomeToken = IERC1155(_outcomeToken);
        treasury = _treasury;
    }

    /**
     * @dev Get the EIP-712 domain separator
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev Compute order hash for EIP-712 verification
     */
    function getOrderHash(Order memory order) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    order.maker,
                    order.marketId,
                    order.outcomeId,
                    order.price,
                    order.size,
                    order.side,
                    order.expiry,
                    order.salt
                )
            )
        );
    }

    /**
     * @dev Verify EIP-712 signature
     */
    function verifyOrderSignature(Order memory order) public view returns (bool) {
        bytes32 orderHash = getOrderHash(order);
        address signer = orderHash.recover(order.signature);
        return signer == order.maker;
    }

    /**
     * @dev Fill an order (called by matched taker order)
     * @param makerOrder The signed maker order
     * @param takerSize Amount taker wants to fill
     */
    function fillOrder(
        Order memory makerOrder,
        uint256 takerSize
    ) external nonReentrant returns (bool) {
        require(takerSize > 0, "Taker size must be > 0");
        require(block.timestamp <= makerOrder.expiry, "Order expired");
        require(!orderFilled[getOrderHash(makerOrder)], "Order already filled");
        require(!orderCanceled[getOrderHash(makerOrder)], "Order canceled");
        require(!usedSalts[makerOrder.maker][makerOrder.salt], "Salt already used");
        require(verifyOrderSignature(makerOrder), "Invalid signature");

        uint256 fillSize = takerSize < makerOrder.size ? takerSize : makerOrder.size;
        uint256 totalValue = (fillSize * makerOrder.price) / 10000; // price is in ticks (4000 = 0.04)
        uint256 fee = (totalValue * platformFeeBps) / 10000;
        uint256 netValue = totalValue - fee;

        // Mark salt as used to prevent replay
        usedSalts[makerOrder.maker][makerOrder.salt] = true;

        if (makerOrder.side) {
            // Maker is buying, taker is selling
            // Taker receives USDC, maker receives outcome tokens
            require(
                paymentToken.transferFrom(msg.sender, makerOrder.maker, netValue),
                "Payment transfer failed"
            );
            require(
                paymentToken.transferFrom(msg.sender, treasury, fee),
                "Fee transfer failed"
            );
            
            // Mint or transfer outcome tokens to maker
            uint256 tokenId = getTokenId(makerOrder.marketId, makerOrder.outcomeId);
            outcomeToken.safeTransferFrom(
                msg.sender, // taker has the tokens
                makerOrder.maker, // maker receives them
                tokenId,
                fillSize,
                ""
            );
        } else {
            // Maker is selling, taker is buying
            // Maker receives USDC, taker receives outcome tokens
            require(
                paymentToken.transferFrom(msg.sender, makerOrder.maker, netValue),
                "Payment transfer failed"
            );
            require(
                paymentToken.transferFrom(msg.sender, treasury, fee),
                "Fee transfer failed"
            );
            
            // Transfer outcome tokens from maker to taker
            uint256 tokenId = getTokenId(makerOrder.marketId, makerOrder.outcomeId);
            outcomeToken.safeTransferFrom(
                makerOrder.maker,
                msg.sender,
                tokenId,
                fillSize,
                ""
            );
        }

        // Record trade
        trades.push(Trade({
            marketId: makerOrder.marketId,
            maker: makerOrder.maker,
            taker: msg.sender,
            outcomeId: makerOrder.outcomeId,
            price: makerOrder.price,
            size: fillSize,
            timestamp: block.timestamp
        }));

        // Mark order as filled if fully filled
        if (fillSize == makerOrder.size) {
            orderFilled[getOrderHash(makerOrder)] = true;
        }

        emit OrderFilled(
            getOrderHash(makerOrder),
            makerOrder.maker,
            msg.sender,
            makerOrder.marketId,
            makerOrder.outcomeId,
            makerOrder.price,
            fillSize,
            fee
        );

        return true;
    }

    /**
     * @dev Cancel an order on-chain
     */
    function cancelOrder(Order memory order) external {
        require(order.maker == msg.sender, "Only maker can cancel");
        require(verifyOrderSignature(order), "Invalid signature");
        
        bytes32 orderHash = getOrderHash(order);
        require(!orderFilled[orderHash], "Order already filled");
        
        orderCanceled[orderHash] = true;
        emit OrderCanceled(orderHash, msg.sender);
    }

    /**
     * @dev Calculate token ID for CTF-style outcome tokens
     * @param marketId Market identifier
     * @param outcomeId 0 = YES, 1 = NO
     */
    function getTokenId(uint256 marketId, uint256 outcomeId) public pure returns (uint256) {
        // Simple encoding: marketId * 2 + outcomeId
        // This ensures unique token IDs per market/outcome combination
        return marketId * 2 + outcomeId;
    }

    /**
     * @dev Update platform fee (only owner)
     */
    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high"); // Max 10%
        platformFeeBps = _feeBps;
    }

    /**
     * @dev Update treasury address (only owner)
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    /**
     * @dev Get recent trades
     */
    function getRecentTrades(uint256 count) external view returns (Trade[] memory) {
        uint256 length = trades.length;
        if (count > length) count = length;
        
        Trade[] memory recent = new Trade[](count);
        for (uint256 i = 0; i < count; i++) {
            recent[i] = trades[length - 1 - i];
        }
        return recent;
    }
}

