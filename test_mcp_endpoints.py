"""
Test Implementation for MCP Trading Assistant
This is a simplified version for testing the concept
"""
from fastapi import Request, HTTPException
from datetime import datetime
import random

# Add these test endpoints to your main.py

# Mock data for testing
MOCK_PRICES = {
    "AAPL": {"price": 182.45, "change": 2.3, "volume": 52341234},
    "GOOGL": {"price": 142.78, "change": -1.2, "volume": 23456789},
    "TSLA": {"price": 245.32, "change": 3.5, "volume": 98765432},
    "SPY": {"price": 458.23, "change": 0.8, "volume": 78901234},
}

@app.get("/api/mcp/market/quote/{symbol}")
async def mcp_test_quote(symbol: str, request: Request):
    """Test endpoint for MCP market data"""
    # For testing, accept any auth header
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer tk_test_"):
        raise HTTPException(status_code=401, detail="Invalid test API key")
    
    # Return mock data
    symbol = symbol.upper()
    if symbol in MOCK_PRICES:
        data = MOCK_PRICES[symbol]
        return {
            "symbol": symbol,
            "price": data["price"],
            "change": data["change"],
            "change_percent": round(data["change"] / data["price"] * 100, 2),
            "volume": data["volume"],
            "timestamp": datetime.now().isoformat(),
            "data_type": "test_data"
        }
    else:
        # Generate random data for any symbol
        return {
            "symbol": symbol,
            "price": round(random.uniform(10, 500), 2),
            "change": round(random.uniform(-5, 5), 2),
            "change_percent": round(random.uniform(-3, 3), 2),
            "volume": random.randint(1000000, 100000000),
            "timestamp": datetime.now().isoformat(),
            "data_type": "generated_test_data"
        }

@app.post("/api/mcp/backtest/run")
async def mcp_test_backtest(
    request: Request,
    strategy: str,
    symbol: str,
    start_date: str,
    end_date: str,
    capital: float = 10000
):
    """Test endpoint for MCP backtesting"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer tk_test_"):
        raise HTTPException(status_code=401, detail="Invalid test API key")
    
    # Generate mock backtest results
    base_return = random.uniform(-20, 40)
    sharpe = random.uniform(0.5, 2.5)
    max_dd = random.uniform(-25, -5)
    trades = random.randint(20, 200)
    win_rate = random.uniform(0.4, 0.7)
    
    return {
        "strategy": strategy,
        "symbol": symbol,
        "period": {
            "start": start_date,
            "end": end_date
        },
        "initial_capital": capital,
        "final_value": capital * (1 + base_return/100),
        "metrics": {
            "total_return": round(base_return, 2),
            "annualized_return": round(base_return * 0.8, 2),
            "sharpe_ratio": round(sharpe, 2),
            "sortino_ratio": round(sharpe * 1.2, 2),
            "max_drawdown": round(max_dd, 2),
            "calmar_ratio": round(abs(base_return / max_dd), 2)
        },
        "trading_stats": {
            "total_trades": trades,
            "winning_trades": int(trades * win_rate),
            "losing_trades": int(trades * (1 - win_rate)),
            "win_rate": round(win_rate * 100, 1),
            "avg_win": round(random.uniform(1, 3), 2),
            "avg_loss": round(random.uniform(-2, -0.5), 2)
        },
        "test_note": "This is test data for MCP development"
    }

@app.get("/api/mcp/portfolio")
async def mcp_test_portfolio(request: Request):
    """Test endpoint for portfolio data"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer tk_test_"):
        raise HTTPException(status_code=401, detail="Invalid test API key")
    
    return {
        "account_value": 125430.23,
        "cash_balance": 23456.78,
        "buying_power": 45678.90,
        "positions": [
            {
                "symbol": "AAPL",
                "quantity": 100,
                "avg_cost": 175.50,
                "current_price": 182.45,
                "value": 18245.00,
                "pnl": 695.00,
                "pnl_percent": 3.96
            },
            {
                "symbol": "SPY",
                "quantity": 50,
                "avg_cost": 450.00,
                "current_price": 458.23,
                "value": 22911.50,
                "pnl": 411.50,
                "pnl_percent": 1.83
            }
        ],
        "daily_pnl": 234.56,
        "total_pnl": 3456.78,
        "test_note": "This is test portfolio data"
    }

# Quick test function
if __name__ == "__main__":
    print("Add these endpoints to your main.py to test MCP functionality")
    print("Your test API key format should be: tk_test_XXXXX")
