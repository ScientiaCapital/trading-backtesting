# ULTRA Trading Platform

🚀 **AI-Powered Quant Hedge Fund Trading Desk built on Cloudflare Workers**

## 🌐 Live Deployments

- **Production**: https://ultra-trading.tkipper.workers.dev
- **Staging**: https://ultra-trading-staging.tkipper.workers.dev

## 🤖 AI-Powered Trading

ULTRA leverages a sophisticated multi-agent AI architecture to create an autonomous trading system:

### AI Agents
- **Market Analyst Agent** (Powered by Google Gemini API / Cloudflare AI) - Real-time market analysis and pattern recognition
- **Strategy Optimizer Agent** (Powered by Anthropic Claude API) - Strategy optimization and risk assessment
- **Execution Agent** - Smart order routing and position management
- **Risk Manager Agent** (Powered by Cloudflare Workers AI) - Portfolio risk monitoring and stop-loss enforcement
- **Performance Analyst Agent** (Powered by Cloudflare Workers AI) - Daily P&L tracking with automatic $300 target stops

### Key Features
- **Autonomous Trading** - AI agents collaborate to analyze, decide, and execute trades
- **Real-time Collaboration** - Agents communicate via Cloudflare Durable Objects
- **Daily Profit Target** - Automatically stops trading when $300 profit is reached
- **Hybrid AI Approach** - Combines Cloudflare Workers AI with external APIs (Gemini, Claude)
- **Edge Computing** - Sub-millisecond decision making at Cloudflare's edge

## ⚡ Core Features

- **Real-time Trading** with Alpaca Markets Paper Trading
- **AI-Powered Analysis** using Google Gemini and Anthropic Claude
- **Advanced Strategies**: Gamma Scalping, Iron Condor, Wheel Strategy
- **Global Edge Deployment** on Cloudflare's network
- **Real-time Market Data** with WebSocket streaming
- **Comprehensive Backtesting** with historical data
- **Automated Trading Pipeline** with risk validation
- **Live Monitoring Dashboard** with WebSocket updates

## 🏗️ Architecture

### Multi-Agent AI System
```
┌──────────────────────────────────────────────────────────────────────┐
│                       ULTRA Trading Platform                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌───────────────┐   ┌──────────────┐   ┌────────────┐   ┌─────────┐│
│  │    Market     │   │   Strategy   │   │ Execution  │   │  Risk   ││
│  │   Analyst     │◄─►│  Optimizer   │◄─►│   Agent    │◄─►│ Manager ││
│  │(Gemini/CF AI) │   │(Claude API)  │   │            │   │ (CF AI) ││
│  └──────┬────────┘   └──────┬───────┘   └─────┬──────┘   └────┬────┘│
│         │                   │                  │               │      │
│    ┌────▼─────┐       ┌─────▼────────────────▼────────────────▼────┐│
│    │Performance│       │   Durable Objects (Agent Coordinator)      ││
│    │ Analyst   │◄─────►│         Real-time Communication            ││
│    │  (CF AI)  │       └────────────────────────────────────────────┘│
│    └───────────┘                                                     │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │                 Cloudflare Workers Runtime (Edge)                 ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ ││
│  │  │ Workers AI │  │     D1     │  │     KV     │  │     R2     │ ││
│  │  │  Binding   │  │  Database  │  │   Cache    │  │  Storage   │ ││
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘ ││
│  └──────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

### Infrastructure Stack
- **Runtime**: Cloudflare Workers (Global Edge Computing)
- **Framework**: Hono.js with TypeScript
- **State Management**: Cloudflare Durable Objects
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 + KV
- **Trading API**: Alpaca Markets Paper Trading
- **AI Integration**: 
  - Cloudflare Workers AI (Risk & Performance Analysis)
  - Google Gemini API (Market Analysis)
  - Anthropic Claude API (Strategy Optimization)
- **Real-time**: WebSockets + Cron Triggers

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

#### Automated Deployment via GitHub Actions
1. **Push to main branch** → Automatically deploys to staging
2. **Manual trigger** → Deploy to production via GitHub Actions workflow

#### Manual Deployment
```bash
# Validate build before deployment
npm run validate:build

# Deploy to staging
npm run deploy:staging

# Deploy to production  
npm run deploy:production

# Or deploy directly with wrangler
wrangler deploy --env production --minify
```

### Environment Setup

1. **Configure API Keys**:
   ```bash
   # Set up AI API keys
   wrangler secret put GOOGLE_API_KEY
   wrangler secret put ANTHROPIC_API_KEY
   
   # Set up Alpaca Paper Trading credentials
   wrangler secret put ALPACA_KEY_ID
   wrangler secret put ALPACA_SECRET_KEY
   
   # For local development, add to .dev.vars
   GOOGLE_API_KEY=your_gemini_key_here
   ANTHROPIC_API_KEY=your_claude_key_here
   ALPACA_KEY_ID=your_alpaca_key_here
   ALPACA_SECRET_KEY=your_alpaca_secret_here
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

### AI Agents
- `POST /api/v1/ai/agents/analyze` - Trigger market analysis
- `GET /api/v1/ai/agents/status` - Get agent status
- `POST /api/v1/ai/agents/configure` - Configure agent parameters
- `WS /ws/ai/agents` - Real-time agent communication

### Automated Trading
- `POST /api/v1/auto/start` - Start automated trading
- `POST /api/v1/auto/stop` - Stop automated trading
- `GET /api/v1/auto/performance` - Daily performance metrics
- `GET /api/v1/auto/profit` - Current profit/loss status

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

### AI-Enhanced Strategies
All strategies are continuously optimized by our AI agents:

#### Gamma Scalping
- **AI Enhancement**: Gemini analyzes real-time volatility patterns
- **Optimization**: Claude adjusts hedge ratios dynamically
- **Execution**: Automated rebalancing based on gamma exposure

#### Iron Condor
- **AI Enhancement**: Pattern recognition for range-bound markets
- **Optimization**: Strike selection based on ML predictions
- **Risk Management**: Automatic adjustment when breached

#### Wheel Strategy
- **AI Enhancement**: Optimal strike/expiry selection
- **Optimization**: Premium maximization algorithms
- **Automation**: Fully automated put/call assignments

### Daily Profit Target
- **Goal**: $300/day profit target
- **Protection**: Automatic trading stop when target reached
- **Risk Control**: Maximum daily loss limits enforced

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

- [AI Models Guide](./CLAUDE.md) - Complete guide to AI integration
- [AI Agents Architecture](./AI_AGENTS.md) - Multi-agent system design
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