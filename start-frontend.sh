#!/bin/bash

# Start Frontend Development Server
# Make sure you're in the project root directory

echo "🚀 Starting Frontend Development Server..."
echo ""

# Check if we're in the right directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found!"
    echo "   Please run this script from the project root directory:"
    echo "   cd /Users/zs/Desktop/tmlspredict/TimelessPredect"
    exit 1
fi

cd frontend

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
VITE_EXCHANGE_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
VITE_CHAIN_ID=1337
VITE_API_BASE_URL=http://localhost:8080
EOF
    echo "✅ Created .env file. Update VITE_EXCHANGE_CONTRACT_ADDRESS after deploying contract."
fi

echo "✅ Starting frontend dev server..."
echo ""
npm start

