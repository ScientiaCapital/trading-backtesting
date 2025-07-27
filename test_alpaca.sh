#!/bin/bash
# Test Script for Alpaca Integration

echo "🚀 Testing Alpaca API Integration"
echo "================================="

# Test API key
API_KEY="tk_test_alpaca_$(date +%s)"

# Start the API server
echo "Starting API server with Alpaca integration..."
cd /Users/tmk/Documents/trading-backtesting

# Check if container is running
if /Applications/Docker.app/Contents/Resources/bin/docker ps | grep -q trading-backtesting; then
    echo "✅ Docker container is running"
    
    # Copy the new API file to container
    /Applications/Docker.app/Contents/Resources/bin/docker cp main_alpaca.py trading-backtesting:/app/main.py
    
    # Restart the API in the container
    echo "Restarting API with Alpaca integration..."
    /Applications/Docker.app/Contents/Resources/bin/docker exec -d trading-backtesting python main.py
    
    sleep 3
else
    echo "❌ Docker container not running. Starting it..."
    /Applications/Docker.app/Contents/Resources/bin/docker start trading-backtesting
    sleep 5
fi

echo ""
echo "📊 Testing API Endpoints:"
echo ""

# Test 1: Health check
echo "1. Health Check:"
curl -s http://localhost:8000/health | jq '.'

echo ""
echo "2. Get AAPL Quote (Real Alpaca Data):"
curl -s -H "Authorization: Bearer $API_KEY" \
     http://localhost:8000/api/mcp/market/quote/AAPL | jq '.'

echo ""
echo "3. Get Portfolio (Paper Trading):"
curl -s -H "Authorization: Bearer $API_KEY" \
     http://localhost:8000/api/mcp/portfolio | jq '.'

echo ""
echo "4. Run Backtest (SMA Crossover on SPY):"
curl -s -X POST -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "strategy": "sma_crossover",
       "symbol": "SPY",
       "start_date": "2024-01-01",
       "end_date": "2024-06-01",
       "initial_capital": 10000
     }' \
     http://localhost:8000/api/mcp/backtest/run | jq '.'

echo ""
echo "5. Get Account Info:"
curl -s http://localhost:8000/api/account/info | jq '.'

echo ""
echo "✅ Test complete! Check the results above."
echo ""
echo "📝 Next steps:"
echo "1. If all tests pass, your Alpaca integration is working!"
echo "2. You can now use these endpoints in the MCP server"
echo "3. Try different symbols and strategies"
