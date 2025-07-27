# ULTRA Trading Platform

🚀 **Next-generation trading platform built on Cloudflare Workers with AI-powered analysis**

## 🌐 Live Deployments

- **Production**: https://ultra-trading.tkipper.workers.dev
- **Staging**: https://ultra-trading-staging.tkipper.workers.dev

## ⚡ Features

- **Real-time Trading** with Alpaca Markets Paper Trading
- **AI-Powered Analysis** using Google Gemini and Anthropic Claude
- **Advanced Strategies**: Gamma Scalping, Iron Condor, Wheel Strategy
- **Global Edge Deployment** on Cloudflare's network
- **Real-time Market Data** with WebSocket streaming
- **Comprehensive Backtesting** with historical data

## 🏗️ Architecture

- **Runtime**: Cloudflare Workers (Edge Computing)
- **Framework**: Hono.js with TypeScript
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 + KV
- **Trading API**: Alpaca Markets Paper Trading
- **AI Services**: Google Gemini, Anthropic Claude

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Cloudflare account
- Alpaca Paper Trading account

### Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Visit http://localhost:8787
```

### Deployment

**⚠️ IMPORTANT: This is a Workers application, NOT a Pages application**

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production  
npm run deploy:production

# Or deploy directly with wrangler
wrangler deploy --env production --minify
```

### Environment Setup

1. **Configure Alpaca Credentials**:
   ```bash
   # Copy your Alpaca Paper Trading credentials to .dev.vars
   ALPACA_API_KEY=your_key_here
   ALPACA_API_SECRET=your_secret_here
   ```

2. **Set up Cloudflare Resources**:
   ```bash
   npm run setup:cloudflare
   npm run setup:secrets:production
   ```

3. **Initialize Database**:
   ```bash
   npm run db:init
   ```

## 📊 API Endpoints

### Trading
- `GET /api/v1/trading/account` - Account information
- `POST /api/v1/trading/orders` - Submit orders
- `GET /api/v1/trading/orders` - List orders
- `GET /api/v1/trading/positions` - Current positions
- `GET /api/v1/trading/market/quotes/{symbol}` - Real-time quotes

### Market Data
- `GET /api/v1/trading/market/status` - Market status
- `GET /api/v1/trading/market/quotes/{symbol}` - Latest quotes
- `WS /ws/trading` - Real-time trading updates

### System
- `GET /ping` - Health check
- `GET /docs` - API documentation
- `GET /status` - System status

## 🧪 Testing

```bash
# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Test Alpaca connection
npm run test:alpaca
```

## 📈 Trading Strategies

### Gamma Scalping
Dynamic hedging strategy that profits from volatility changes in options positions.

### Iron Condor
Options strategy that profits from low volatility by selling both call and put spreads.

### Wheel Strategy
Systematic options strategy combining cash-secured puts and covered calls.

## 🔧 Configuration

All configuration is in `wrangler.jsonc`:

```jsonc
{
  "name": "ultra-trading",
  "main": "src/index.ts",
  "compatibility_date": "2025-07-26",
  "env": {
    "staging": { "name": "ultra-trading-staging" },
    "production": { "name": "ultra-trading" }
  }
}
```

## 🚨 Important Notes

1. **Workers Only**: This is a Cloudflare Workers application, not Pages
2. **No GitHub Auto-Deployment**: Deploy manually via CLI to prevent conflicts
3. **Paper Trading**: Currently configured for Alpaca Paper Trading only
4. **Edge Computing**: Runs globally on Cloudflare's edge network

## 📚 Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [Quick Start Guide](./QUICK_START.md)
- [API Documentation](https://ultra-trading.tkipper.workers.dev/docs)

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test locally with `npm run dev`
4. Deploy to staging: `npm run deploy:staging`
5. Test staging deployment
6. Deploy to production: `npm run deploy:production`

## 📄 License

MIT License - Built for educational and paper trading purposes.

---

🚀 **Ready for tomorrow's market!** Built with ❤️ on Cloudflare Workers.