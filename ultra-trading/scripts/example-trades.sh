#!/bin/bash

# ULTRA Trading Platform - Example Trading Commands
# These are example API calls for different trading scenarios

BASE_URL="http://localhost:8787"
AUTH="Authorization: Bearer test-token"

echo "📊 ULTRA Trading Platform - Example Trades"
echo "=========================================="
echo ""

echo "1. Market Buy Order (1 share of AAPL):"
echo "--------------------------------------"
cat << 'EOF'
curl -X POST "$BASE_URL/api/v1/trading/orders" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "quantity": 1,
    "side": "buy",
    "orderType": "market",
    "timeInForce": "day"
  }'
EOF

echo ""
echo "2. Limit Buy Order (10 shares of MSFT at $400):"
echo "-----------------------------------------------"
cat << 'EOF'
curl -X POST "$BASE_URL/api/v1/trading/orders" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "MSFT",
    "quantity": 10,
    "side": "buy",
    "orderType": "limit",
    "limitPrice": 400.00,
    "timeInForce": "gtc"
  }'
EOF

echo ""
echo "3. Stop Loss Order (Sell 5 TSLA if drops to $200):"
echo "--------------------------------------------------"
cat << 'EOF'
curl -X POST "$BASE_URL/api/v1/trading/orders" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TSLA",
    "quantity": 5,
    "side": "sell",
    "orderType": "stop",
    "stopPrice": 200.00,
    "timeInForce": "gtc"
  }'
EOF

echo ""
echo "4. Get All Open Orders:"
echo "----------------------"
cat << 'EOF'
curl "$BASE_URL/api/v1/trading/orders?status=open" \
  -H "$AUTH"
EOF

echo ""
echo "5. Get Current Positions:"
echo "------------------------"
cat << 'EOF'
curl "$BASE_URL/api/v1/trading/positions" \
  -H "$AUTH"
EOF

echo ""
echo "6. Close a Position (Sell all AAPL shares):"
echo "-------------------------------------------"
cat << 'EOF'
curl -X DELETE "$BASE_URL/api/v1/trading/positions/AAPL" \
  -H "$AUTH"
EOF

echo ""
echo "7. Get Account Information:"
echo "--------------------------"
cat << 'EOF'
curl "$BASE_URL/api/v1/trading/account" \
  -H "$AUTH"
EOF

echo ""
echo "8. Get Real-time Quote:"
echo "----------------------"
cat << 'EOF'
curl "$BASE_URL/api/v1/trading/market/quotes/SPY" \
  -H "$AUTH"
EOF

echo ""
echo "9. Get Historical Bars (Last 10 days):"
echo "-------------------------------------"
cat << 'EOF'
curl "$BASE_URL/api/v1/trading/market/bars/AAPL?timeframe=1Day&limit=10" \
  -H "$AUTH"
EOF

echo ""
echo "10. Cancel an Order:"
echo "-------------------"
cat << 'EOF'
curl -X DELETE "$BASE_URL/api/v1/trading/orders/{order_id}" \
  -H "$AUTH"
EOF

echo ""
echo "=========================================="
echo "⚠️  Remember: These are for PAPER TRADING"
echo "Always test strategies with paper money first!"
echo ""
echo "To execute any command, replace:"
echo '- $BASE_URL with actual URL'
echo '- $AUTH with actual auth header'
echo "- {order_id} with actual order ID"
echo ""