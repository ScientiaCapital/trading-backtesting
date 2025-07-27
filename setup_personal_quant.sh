#!/bin/bash
# Personal Quant Trading System Setup

echo "🚀 Setting up Personal Quant Trading System"
echo "=========================================="

# Set environment variables
export ALPACA_API_KEY_ID="PKDINXYX5XL2HL5P5TNV"
export TRADING_API_KEY="tk_personal_quant_$(date +%s)"
export TRADING_API_URL="http://localhost:8001"
export MARKET_DATA_API_URL="http://localhost:8000"

# Function to check if port is in use
check_port() {
    lsof -i :$1 > /dev/null 2>&1
    return $?
}

# Step 1: Start the main API with Alpaca integration (port 8000)
echo ""
echo "1. Starting Market Data API (port 8000)..."
if check_port 8000; then
    echo "✅ Market Data API already running on port 8000"
else
    echo "Starting Market Data API..."
    cd /Users/tmk/Documents/trading-backtesting
    python main_alpaca.py &
    MARKET_API_PID=$!
    echo "Market Data API started with PID: $MARKET_API_PID"
    sleep 3
fi

# Step 2: Start the Quant Trading System (port 8001)
echo ""
echo "2. Starting Quant Trading System (port 8001)..."
if check_port 8001; then
    echo "✅ Quant Trading System already running on port 8001"
else
    echo "Starting Quant Trading System..."
    cd /Users/tmk/Documents/trading-backtesting/quant-agents
    python personal_trading_system.py &
    QUANT_PID=$!
    echo "Quant Trading System started with PID: $QUANT_PID"
    sleep 3
fi

# Step 3: Build MCP Server
echo ""
echo "3. Building MCP Server..."
cd /Users/tmk/Documents/trading-backtesting/trading-mcp-server
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
echo "Building TypeScript..."
npm run build

# Step 4: Generate Claude Desktop config
echo ""
echo "4. Generating Claude Desktop Configuration..."

cat > /Users/tmk/Documents/trading-backtesting/claude_desktop_config.json << EOF
{
  "mcpServers": {
    "personal-quant": {
      "command": "node",
      "args": ["${HOME}/Documents/trading-backtesting/trading-mcp-server/dist/index.js"],
      "env": {
        "TRADING_API_KEY": "${TRADING_API_KEY}",
        "TRADING_API_URL": "${TRADING_API_URL}",
        "MARKET_DATA_API_URL": "${MARKET_DATA_API_URL}"
      }
    }
  }
}
EOF

echo "✅ Configuration saved to: ~/Documents/trading-backtesting/claude_desktop_config.json"

# Step 5: Test the setup
echo ""
echo "5. Testing the setup..."
echo ""

# Test Market Data API
echo "Testing Market Data API..."
curl -s -H "Authorization: Bearer ${TRADING_API_KEY}" \
     http://localhost:8000/api/mcp/market/quote/AAPL | jq '.' || echo "Market API not ready"

echo ""

# Test Quant System API
echo "Testing Quant Trading System..."
curl -s http://localhost:8001/trading/status | jq '.' || echo "Quant System not ready"

echo ""
echo "==============================================="
echo "✅ Personal Quant Trading System Setup Complete!"
echo "==============================================="
echo ""
echo "📋 Next Steps:"
echo "1. Copy the configuration from claude_desktop_config.json"
echo "2. Add it to Claude Desktop settings (Developer → Edit Config)"
echo "3. Restart Claude Desktop"
echo "4. Test with: 'What trading tools do you have?'"
echo ""
echo "🎯 Example Commands to Try:"
echo "- 'Analyze the market for AAPL, GOOGL, and TSLA'"
echo "- 'Show me current trading signals'"
echo "- 'What's my portfolio status?'"
echo "- 'Backtest SMA crossover strategy on SPY for the last year'"
echo "- 'Get my risk metrics'"
echo "- 'Start the automated trading system'"
echo ""
echo "⚠️  Running Services:"
echo "- Market Data API: http://localhost:8000"
echo "- Quant Trading System: http://localhost:8001"
echo ""
echo "To stop all services, run: pkill -f 'python.*trading'"
