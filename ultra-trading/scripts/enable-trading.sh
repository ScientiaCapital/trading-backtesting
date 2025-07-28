#!/bin/bash

# Enable trading in observation mode
echo "Enabling trading in observation mode..."

# Set trading enabled flag
curl -X PUT https://ultra-trading.tkipper.workers.dev/api/v1/trading/control/enable \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "mode": "observation"}' | jq

echo "Trading enabled in observation mode"