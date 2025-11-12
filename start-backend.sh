#!/bin/bash

# Start Backend API Server
# Make sure you're in the project root directory

echo "🚀 Starting Backend API Server..."
echo ""

# Check if we're in the right directory
if [ ! -f "api-server.js" ]; then
    echo "❌ Error: api-server.js not found!"
    echo "   Please run this script from the project root directory:"
    echo "   cd /Users/zs/Desktop/tmlspredict/TimelessPredect"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Installing dependencies..."
    npm install
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "   Creating default .env file..."
    cat > .env << 'EOF'
EXCHANGE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
CHAIN_ID=1337
RPC_URL=http://localhost:8545
SETTLEMENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PAYMENT_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
OUTCOME_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
PORT=8080
API_BASE_URL=http://localhost:8080
EOF
    echo "✅ Created .env file. Update EXCHANGE_CONTRACT_ADDRESS after deploying contract."
fi

echo "✅ Starting server..."
echo ""
node api-server.js

