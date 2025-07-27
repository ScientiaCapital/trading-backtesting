#!/bin/bash
# Direct curl test for Alpaca API

echo "🔍 Testing Alpaca API with curl..."
echo ""

# Test account endpoint
echo "📊 Testing Account Endpoint:"
curl -X GET https://paper-api.alpaca.markets/v2/account \
  -H "APCA-API-KEY-ID: PKULZQJRNA5SFQU6ES23" \
  -H "APCA-API-SECRET-KEY: ZEeHb6MV6gSWxfwQYJoqzY07RnEcJRlO3KqkFHFE" \
  -H "Content-Type: application/json" \
  -w "\n\nHTTP Status: %{http_code}\n" | jq .

echo ""
echo "🕒 Testing Clock Endpoint:"
curl -X GET https://paper-api.alpaca.markets/v2/clock \
  -H "APCA-API-KEY-ID: PKULZQJRNA5SFQU6ES23" \
  -H "APCA-API-SECRET-KEY: ZEeHb6MV6gSWxfwQYJoqzY07RnEcJRlO3KqkFHFE" \
  -H "Content-Type: application/json" | jq .