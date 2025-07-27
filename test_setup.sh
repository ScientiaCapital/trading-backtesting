#!/bin/bash
# Test Setup Script for MCP Trading Assistant

echo "🚀 Setting up YOUR test environment..."

# 1. Generate your test API key
export TRADING_API_KEY="tk_test_$(date +%s | sha256sum | head -c 20)"
export TRADING_API_URL="http://localhost:8000"
export TRADING_USER_ID="tmk_test_001"
export TRADING_TIER="quant"  # You get the best tier!

echo "✅ Generated your test credentials:"
echo "   API Key: $TRADING_API_KEY"
echo "   User ID: $TRADING_USER_ID"
echo "   Tier: $TRADING_TIER (Full Access)"

# 2. Create your personal MCP config
cat > ~/Documents/trading-backtesting/tmk_mcp_config.json << EOF
{
  "mcpServers": {
    "trading-assistant": {
      "command": "node",
      "args": ["$HOME/Documents/trading-backtesting/trading-mcp-server/dist/index.js"],
      "env": {
        "TRADING_API_KEY": "$TRADING_API_KEY",
        "TRADING_API_URL": "$TRADING_API_URL",
        "TRADING_USER_ID": "$TRADING_USER_ID",
        "TRADING_TIER": "$TRADING_TIER"
      }
    }
  }
}
EOF

echo ""
echo "📋 Your MCP config has been created!"
echo "   Location: ~/Documents/trading-backtesting/tmk_mcp_config.json"

# 3. Test API endpoints
echo ""
echo "🧪 Testing API endpoints..."

# Start the API if not running
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "Starting API server..."
    cd ~/Documents/trading-backtesting
    ./services.sh api &
    sleep 5
fi

# Test endpoints
echo ""
echo "Testing market data endpoint:"
curl -s -H "Authorization: Bearer $TRADING_API_KEY" \
     http://localhost:8000/api/mcp/market/quote/AAPL | jq '.' || echo "API not ready yet"

echo ""
echo "📝 Next Steps:"
echo "1. Build the MCP server: cd trading-mcp-server && npm install && npm run build"
echo "2. Add the config to Claude Desktop settings"
echo "3. Test with: 'What trading tools do you have?'"
