# ULTRA Trading MVP - Iron Condor Backtester

A simple, focused MVP for backtesting Iron Condor options strategies.

## Features
- Iron Condor strategy backtesting
- Simple web interface
- Results stored in NEON PostgreSQL
- Deployed on Vercel

## Tech Stack
- **Backend**: Node.js + Express
- **Database**: NEON PostgreSQL
- **Frontend**: Vanilla HTML/CSS/JS
- **Deployment**: Vercel

## Quick Start

### Local Development
```bash
npm install
npm run dev
# Visit http://localhost:3000
```

### Deploy to Vercel
```bash
vercel
```

## Project Structure
```
ultra-mvp/
├── api/
│   ├── index.js              # Express API
│   └── ironCondorBacktest.js # Strategy logic
├── public/
│   └── index.html           # Simple UI
├── package.json
├── vercel.json              # Deployment config
└── .env                     # Database connection
```

## API Endpoints
- `GET /api/health` - Health check
- `POST /api/backtest` - Run Iron Condor backtest
- `GET /api/backtests` - Get recent backtests
- `POST /api/init-db` - Initialize database

## Next Steps
1. Add more trading strategies
2. Integrate real market data
3. Add user authentication
4. Implement paper trading
5. Add performance analytics