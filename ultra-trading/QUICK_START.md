# ULTRA Trading Platform - Quick Start Guide

## 🌐 Live Deployments (Ready Now!)

- **Production**: https://ultra-trading.tkipper.workers.dev
- **Staging**: https://ultra-trading-staging.tkipper.workers.dev

## 🚀 Quick Setup for Tomorrow's Market

### 1. Add Your Alpaca Credentials
Edit `.dev.vars` and add your Alpaca Paper Trading API credentials:
```
ALPACA_API_KEY=your_paper_api_key_here
ALPACA_API_SECRET=your_paper_api_secret_here
```

Get these from: https://app.alpaca.markets/paper/dashboard/overview

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Local Development
```bash
npm run dev
```

The server will start at http://localhost:8787

### 4. Test Basic Connection
```bash
# Test health endpoint
curl http://localhost:8787/ping

# Test account info (requires API keys)
curl http://localhost:8787/api/v1/trading/account \
  -H "Authorization: Bearer test-token" \
  -H "X-Tenant-ID: default"
```

### 5. Deploy to Cloudflare Workers (Manual Only)

**⚠️ IMPORTANT: This is a Workers app, NOT Pages. Deploy manually:**

```bash
# Deploy to staging first
wrangler deploy --env staging --minify

# Test staging, then deploy to production
wrangler deploy --env production --minify

# Set secrets in Cloudflare (if not already set)
wrangler secret put ALPACA_API_KEY --env production
wrangler secret put ALPACA_API_SECRET --env production
```

## 📊 Trading Strategies Available

### 1. Gamma Scalping Strategy
- Good for: Volatile markets
- Risk: Medium
- Capital Required: ~$10,000

### 2. Iron Condor Strategy  
- Good for: Range-bound markets
- Risk: Low-Medium
- Capital Required: ~$5,000

### 3. Wheel Strategy
- Good for: Steady income generation
- Risk: Low
- Capital Required: ~$10,000

## 🔧 Known Issues
- TypeScript strict mode temporarily relaxed
- WebSocket connections require Durable Objects (not yet configured)
- Some type definitions need refinement

## 📝 Important Notes
- Always use Paper Trading first!
- Market opens at 9:30 AM ET
- Pre-market: 4:00 AM - 9:30 AM ET
- After-hours: 4:00 PM - 8:00 PM ET

## 🆘 Troubleshooting

### "Invalid API Key" Error
- Make sure you're using Paper Trading API keys
- Check that keys are in `.dev.vars` file
- Restart the dev server after adding keys

### TypeScript Errors
- We've temporarily relaxed strict mode
- Focus on runtime functionality first
- Type errors won't prevent the app from running

### Can't Connect to Alpaca
- Verify you're on the Paper Trading environment
- Check API key permissions
- Ensure your IP isn't rate-limited

## 🎯 Quick Test Commands

```bash
# Get account info
curl http://localhost:8787/api/v1/trading/account -H "Authorization: Bearer test"

# Get market status  
curl http://localhost:8787/api/v1/trading/market/status -H "Authorization: Bearer test"

# Get quote for AAPL
curl http://localhost:8787/api/v1/trading/market/quotes/AAPL -H "Authorization: Bearer test"

# Submit a test order (paper trading)
curl -X POST http://localhost:8787/api/v1/trading/orders \
  -H "Authorization: Bearer test" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "quantity": 1,
    "side": "buy",
    "orderType": "market",
    "timeInForce": "day"
  }'
```

## 🚦 Ready to Trade?

1. ✅ API keys configured
2. ✅ Dev server running
3. ✅ Account endpoint responding
4. ✅ Market data flowing
5. 🎉 Start with small paper trades!

Remember: This is Paper Trading - perfect for testing strategies without risk!