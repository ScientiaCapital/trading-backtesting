#!/bin/bash

# ULTRA Trading Platform - Connection Test Script
# Run this after adding your Alpaca API keys to .dev.vars

echo "🚀 ULTRA Trading Platform - Connection Test"
echo "==========================================="

# Base URL - change this if testing production
BASE_URL="http://localhost:8787"
AUTH_HEADER="Authorization: Bearer test-token"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=$3
    
    echo -n "Testing $name... "
    
    response=$(curl -s -w "\n%{http_code}" "$url" -H "$AUTH_HEADER" 2>/dev/null)
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ OK${NC} (Status: $status_code)"
        if [ "$name" = "Account Info" ] && [ "$status_code" = "200" ]; then
            echo "  Balance: $(echo $body | grep -o '"buyingPower":[0-9.]*' | cut -d: -f2)"
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (Status: $status_code)"
        echo "  Response: $body"
    fi
}

# Check if server is running
echo "1. Checking if server is running..."
if ! curl -s "$BASE_URL/ping" > /dev/null 2>&1; then
    echo -e "${RED}✗ Server is not running!${NC}"
    echo "  Please run: npm run dev"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"

# Test endpoints
echo ""
echo "2. Testing API Endpoints..."
echo "---------------------------"

test_endpoint "Health Check" "$BASE_URL/ping" "200"
test_endpoint "API Status" "$BASE_URL/status" "200"
test_endpoint "Account Info" "$BASE_URL/api/v1/trading/account" "200"
test_endpoint "Market Status" "$BASE_URL/api/v1/trading/market/status" "200"
test_endpoint "AAPL Quote" "$BASE_URL/api/v1/trading/market/quotes/AAPL" "200"

echo ""
echo "3. Testing Order Submission (Paper Trading)..."
echo "----------------------------------------------"

# Test market order
order_response=$(curl -s -X POST "$BASE_URL/api/v1/trading/orders" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d '{
        "symbol": "AAPL",
        "quantity": 1,
        "side": "buy",
        "orderType": "market",
        "timeInForce": "day"
    }' 2>/dev/null)

if echo "$order_response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Order submission works${NC}"
    order_id=$(echo "$order_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    echo "  Order ID: $order_id"
else
    echo -e "${RED}✗ Order submission failed${NC}"
    echo "  Response: $order_response"
fi

echo ""
echo "==========================================="
echo "Test complete!"
echo ""
echo "Next steps:"
echo "1. If all tests passed, you're ready to trade!"
echo "2. Check the Alpaca dashboard for your paper trades"
echo "3. Try different strategies in the platform"
echo ""