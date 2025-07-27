#!/bin/bash
# Test Alpaca Trading API Endpoints

echo "🚀 Testing ULTRA Trading Platform - Alpaca Integration"
echo ""

# Base URL
BASE_URL="http://localhost:8788/api/v1"

# You'll need to get a valid session token first by logging in
# For testing, you can manually set this after logging in
SESSION_TOKEN="test-token"

echo "📊 1. Testing Account Endpoint..."
curl -X GET "$BASE_URL/trading/account" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" | jq .

echo ""
echo "📈 2. Testing Positions Endpoint..."
curl -X GET "$BASE_URL/trading/positions" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" | jq .

echo ""
echo "💹 3. Testing Market Status..."
curl -X GET "$BASE_URL/trading/market/status" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" | jq .

echo ""
echo "📊 4. Testing Quote for AAPL..."
curl -X GET "$BASE_URL/trading/market/quotes/AAPL" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -H "Content-Type: application/json" | jq .

echo ""
echo "✅ Testing complete!"