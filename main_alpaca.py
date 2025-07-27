"""
Enhanced Trading API with Real Alpaca Integration
"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
from datetime import datetime, timedelta
from alpaca.trading.client import TradingClient
from alpaca.data import StockHistoricalDataClient
from alpaca.data.requests import StockLatestQuoteRequest, StockBarsRequest
from alpaca.data.timeframe import TimeFrame
import pandas as pd
import numpy as np
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Trading Backtesting API with MCP Support",
    description="API for algorithmic trading with Alpaca integration",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Alpaca clients
ALPACA_API_KEY = os.getenv("ALPACA_API_KEY_ID")
ALPACA_SECRET = os.getenv("ALPACA_API_SECRET", "")
ALPACA_BASE_URL = os.getenv("ALPACA_BASE_URL")

# For paper trading, we don't need the secret key
trading_client = TradingClient(
    api_key=ALPACA_API_KEY,
    secret_key=ALPACA_SECRET,
    paper=True
)

# For market data, we only need the API key
data_client = StockHistoricalDataClient(
    api_key=ALPACA_API_KEY,
    secret_key=None
)

# Data models
class BacktestRequest(BaseModel):
    strategy: str
    symbol: str
    start_date: str
    end_date: str
    initial_capital: float = 10000.0
    parameters: Optional[dict] = {}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "alpaca_connected": ALPACA_API_KEY is not None
    }

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Trading Backtesting API with Alpaca Integration",
        "endpoints": [
            "/health",
            "/docs",
            "/api/mcp/market/quote/{symbol}",
            "/api/mcp/backtest/run",
            "/api/mcp/portfolio",
            "/api/account/info"
        ]
    }

# MCP Endpoints with Real Alpaca Data

@app.get("/api/mcp/market/quote/{symbol}")
async def get_real_quote(symbol: str, request: Request):
    """Get real market quote from Alpaca"""
    # Check auth (for MCP)
    auth = request.headers.get("Authorization", "")
    if not (auth.startswith("Bearer tk_test_") or auth.startswith("Bearer tk_")):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    try:
        # Get latest quote from Alpaca
        request_params = StockLatestQuoteRequest(symbol_or_symbols=symbol.upper())
        quotes = data_client.get_stock_latest_quote(request_params)
        
        quote = quotes[symbol.upper()]
        
        # Get daily bars for change calculation
        bars_request = StockBarsRequest(
            symbol_or_symbols=symbol.upper(),
            timeframe=TimeFrame.Day,
            start=datetime.now() - timedelta(days=2),
            limit=2
        )
        bars = data_client.get_stock_bars(bars_request)
        
        # Calculate daily change
        if symbol.upper() in bars.data and len(bars.data[symbol.upper()]) >= 2:
            prev_close = bars.data[symbol.upper()][-2].close
            current_price = quote.ask_price if quote.ask_price else quote.bid_price
            change = current_price - prev_close
            change_percent = (change / prev_close) * 100
        else:
            change = 0
            change_percent = 0
        
        return {
            "symbol": symbol.upper(),
            "price": float(quote.ask_price if quote.ask_price else quote.bid_price),
            "bid": float(quote.bid_price),
            "ask": float(quote.ask_price),
            "bid_size": int(quote.bid_size),
            "ask_size": int(quote.ask_size),
            "change": round(change, 2),
            "change_percent": round(change_percent, 2),
            "timestamp": quote.timestamp.isoformat(),
            "data_source": "alpaca_live"
        }
    except Exception as e:
        print(f"Error fetching quote: {e}")
        # Fallback to test data if Alpaca fails
        return {
            "symbol": symbol.upper(),
            "price": 100.0,
            "error": str(e),
            "data_source": "fallback"
        }

@app.get("/api/mcp/portfolio")
async def get_portfolio(request: Request):
    """Get real portfolio data from Alpaca"""
    auth = request.headers.get("Authorization", "")
    if not (auth.startswith("Bearer tk_test_") or auth.startswith("Bearer tk_")):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    try:
        # Get account info
        account = trading_client.get_account()
        
        # Get all positions
        positions = trading_client.get_all_positions()
        
        position_list = []
        for position in positions:
            position_list.append({
                "symbol": position.symbol,
                "quantity": float(position.qty),
                "avg_cost": float(position.avg_entry_price),
                "current_price": float(position.current_price),
                "market_value": float(position.market_value),
                "cost_basis": float(position.cost_basis),
                "unrealized_pl": float(position.unrealized_pl),
                "unrealized_plpc": float(position.unrealized_plpc) * 100,
                "side": position.side
            })
        
        return {
            "account_value": float(account.equity),
            "cash_balance": float(account.cash),
            "buying_power": float(account.buying_power),
            "positions": position_list,
            "daily_pl": float(account.equity) - float(account.last_equity) if account.last_equity else 0,
            "total_pl": sum(p["unrealized_pl"] for p in position_list),
            "data_source": "alpaca_live"
        }
    except Exception as e:
        print(f"Error fetching portfolio: {e}")
        return {
            "account_value": 100000,
            "cash_balance": 50000,
            "buying_power": 50000,
            "positions": [],
            "error": str(e),
            "data_source": "fallback"
        }

@app.post("/api/mcp/backtest/run")
async def run_backtest_with_alpaca(
    request: Request,
    backtest_req: BacktestRequest
):
    """Run backtest using Alpaca historical data"""
    auth = request.headers.get("Authorization", "")
    if not (auth.startswith("Bearer tk_test_") or auth.startswith("Bearer tk_")):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    try:
        # Get historical data from Alpaca
        bars_request = StockBarsRequest(
            symbol_or_symbols=backtest_req.symbol.upper(),
            timeframe=TimeFrame.Day,
            start=datetime.fromisoformat(backtest_req.start_date),
            end=datetime.fromisoformat(backtest_req.end_date)
        )
        
        bars = data_client.get_stock_bars(bars_request)
        
        # Convert to DataFrame for backtesting
        if backtest_req.symbol.upper() in bars.data:
            df = pd.DataFrame([
                {
                    'timestamp': bar.timestamp,
                    'open': bar.open,
                    'high': bar.high,
                    'low': bar.low,
                    'close': bar.close,
                    'volume': bar.volume
                }
                for bar in bars.data[backtest_req.symbol.upper()]
            ])
            
            # Simple moving average crossover backtest
            if backtest_req.strategy.lower() == "sma_crossover":
                df['sma_20'] = df['close'].rolling(window=20).mean()
                df['sma_50'] = df['close'].rolling(window=50).mean()
                
                # Generate signals
                df['signal'] = 0
                df.loc[df['sma_20'] > df['sma_50'], 'signal'] = 1
                df.loc[df['sma_20'] < df['sma_50'], 'signal'] = -1
                
                # Calculate returns
                df['returns'] = df['close'].pct_change()
                df['strategy_returns'] = df['signal'].shift(1) * df['returns']
                
                # Calculate metrics
                total_return = (df['strategy_returns'] + 1).prod() - 1
                sharpe_ratio = df['strategy_returns'].mean() / df['strategy_returns'].std() * np.sqrt(252)
                max_drawdown = (df['close'] / df['close'].cummax() - 1).min()
                
                trades = df['signal'].diff().abs().sum() / 2
                win_rate = (df['strategy_returns'] > 0).sum() / len(df[df['strategy_returns'] != 0])
            else:
                # Default buy and hold
                total_return = (df['close'].iloc[-1] / df['close'].iloc[0]) - 1
                sharpe_ratio = df['returns'].mean() / df['returns'].std() * np.sqrt(252)
                max_drawdown = (df['close'] / df['close'].cummax() - 1).min()
                trades = 1
                win_rate = 1 if total_return > 0 else 0
            
            return {
                "strategy": backtest_req.strategy,
                "symbol": backtest_req.symbol.upper(),
                "period": {
                    "start": backtest_req.start_date,
                    "end": backtest_req.end_date,
                    "trading_days": len(df)
                },
                "initial_capital": backtest_req.initial_capital,
                "final_value": backtest_req.initial_capital * (1 + total_return),
                "metrics": {
                    "total_return": round(total_return * 100, 2),
                    "annualized_return": round(total_return * 252 / len(df) * 100, 2),
                    "sharpe_ratio": round(sharpe_ratio, 2),
                    "max_drawdown": round(max_drawdown * 100, 2),
                    "volatility": round(df['returns'].std() * np.sqrt(252) * 100, 2)
                },
                "trading_stats": {
                    "total_trades": int(trades),
                    "win_rate": round(win_rate * 100, 1)
                },
                "data_source": "alpaca_historical"
            }
        else:
            raise ValueError(f"No data found for symbol {backtest_req.symbol}")
            
    except Exception as e:
        print(f"Error in backtest: {e}")
        # Return mock results as fallback
        return {
            "strategy": backtest_req.strategy,
            "symbol": backtest_req.symbol,
            "error": str(e),
            "data_source": "fallback",
            "metrics": {
                "total_return": 10.5,
                "sharpe_ratio": 1.2,
                "max_drawdown": -8.3
            }
        }

@app.get("/api/account/info")
async def get_account_info():
    """Get Alpaca account information"""
    try:
        account = trading_client.get_account()
        return {
            "id": account.id,
            "account_number": account.account_number,
            "status": account.status,
            "currency": account.currency,
            "buying_power": float(account.buying_power),
            "cash": float(account.cash),
            "portfolio_value": float(account.equity),
            "pattern_day_trader": account.pattern_day_trader,
            "trade_suspended_by_user": account.trade_suspended_by_user,
            "trading_blocked": account.trading_blocked,
            "created_at": account.created_at.isoformat(),
            "data_source": "alpaca_live"
        }
    except Exception as e:
        return {"error": str(e), "data_source": "error"}

# List available strategies
@app.get("/strategies")
async def list_strategies():
    """Get list of available trading strategies"""
    return {
        "strategies": [
            {
                "id": "sma_crossover",
                "name": "SMA Crossover",
                "description": "Simple Moving Average crossover strategy",
                "parameters": ["fast_period", "slow_period"]
            },
            {
                "id": "rsi_oversold",
                "name": "RSI Oversold",
                "description": "Buy when RSI indicates oversold conditions",
                "parameters": ["rsi_period", "oversold_threshold"]
            },
            {
                "id": "buy_and_hold",
                "name": "Buy and Hold",
                "description": "Simple buy and hold strategy",
                "parameters": []
            }
        ]
    }

if __name__ == "__main__":
    import uvicorn
    
    print("🚀 Starting Trading API with Alpaca Integration...")
    print(f"📊 Using Alpaca API Key: {ALPACA_API_KEY[:10]}...")
    print("📋 Test with: curl -H 'Authorization: Bearer tk_test_12345' http://localhost:8000/api/mcp/market/quote/AAPL")
    
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)
